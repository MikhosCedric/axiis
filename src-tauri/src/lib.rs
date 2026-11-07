//! The Axiis desktop shell: the hosted web app in a native window, plus what a browser tab cannot do.
//!
//! The page is never given a native API (see `capabilities/default.json`). Everything native here, the tray,
//! the capture hotkey and the navigation rules, is driven from Rust.

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_opener::OpenerExt;

/// The one origin the window may show. Anything else opens in the system browser.
const HOST: &str = "axiis-lovat.vercel.app";
const START: &str = "https://axiis-lovat.vercel.app/today";

/// Pressed anywhere in Windows: bring Axiis forward with the capture field ready.
const CAPTURE_HOTKEY: &str = "ctrl+alt+a";

/// Focuses the capture field the Today, Week, Month and Inbox pages carry; on any other page it goes to Today.
const FOCUS_CAPTURE: &str = "(() => { const f = document.getElementById('capture'); if (f) { f.focus(); f.select && f.select(); } else { location.assign('/today'); } })()";

/// Whether the window may navigate to `url`: our own origin and the bundled offline page, nothing else.
fn allowed(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        "http" | "https" => {
            let host = url.host_str();
            host == Some("tauri.localhost")
                || host == Some(HOST)
                // A debug build can point at a local dev server; a release build never can.
                || (cfg!(debug_assertions) && host == Some("localhost"))
        }
        _ => false,
    }
}

/// Whether the server answers at all, so a missing connection shows our own page instead of the browser's error.
fn online() -> bool {
    (HOST, 443)
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
        .map(|addr| TcpStream::connect_timeout(&addr, Duration::from_secs(3)).is_ok())
        .unwrap_or(false)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn capture(app: &AppHandle) {
    show_main(app);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(FOCUS_CAPTURE);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch brings the running app forward instead of opening another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([CAPTURE_HOTKEY])
                .expect("the capture hotkey is a valid shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        capture(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            // The address to open. A debug build may be pointed at a dev server; a release build never reads this.
            let start = if cfg!(debug_assertions) {
                std::env::var("AXIIS_URL").unwrap_or_else(|_| START.to_string())
            } else {
                START.to_string()
            };
            let target = if online() || cfg!(debug_assertions) {
                WebviewUrl::External(start.parse().expect("the start address is a valid URL"))
            } else {
                WebviewUrl::App("index.html".into())
            };

            let nav_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", target)
                .title("Axiis")
                .inner_size(1280.0, 840.0)
                .min_inner_size(420.0, 560.0)
                .on_navigation(move |url| {
                    if allowed(url) {
                        return true;
                    }
                    // A link out of the app goes to the system browser, never into this window.
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = nav_handle.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .build()?;

            // Closing the window keeps Axiis running in the tray, so the hotkey still works.
            if let Some(window) = app.get_webview_window("main") {
                let hide = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hide.hide();
                    }
                });
            }

            let open = MenuItem::with_id(app, "open", "Open Axiis", true, None::<&str>)?;
            let quick = MenuItem::with_id(app, "capture", "Capture (Ctrl+Alt+A)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quick, &quit])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("Axiis")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "capture" => capture(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Axiis desktop shell");
}
