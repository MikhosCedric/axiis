//! The Axiis desktop shell: the hosted web app in a native window, plus what a browser tab cannot do.
//!
//! The page is never given a native API (see `capabilities/default.json`). Everything native here, the tray,
//! the capture hotkey and the navigation rules, is driven from Rust.

use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::image::Image;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

/// The one origin the window may show. Anything else opens in the system browser.
const HOST: &str = "axiis-lovat.vercel.app";
const START: &str = "https://axiis-lovat.vercel.app/today";

/// Pressed anywhere in Windows: bring Axiis forward with the capture field ready.
const CAPTURE_HOTKEY: &str = "ctrl+alt+a";

/// Focuses the capture field the Today, Week, Month and Inbox pages carry; on any other page it goes to Today.
const FOCUS_CAPTURE: &str = "(() => { const f = document.getElementById('capture'); if (f) { f.focus(); f.select && f.select(); } else { location.assign('/today'); } })()";

/// Marks our pages as shown in the app. It carries no authority: anyone can set the cookie, and all it changes is
/// where a sign-in link returns to.
const DESKTOP_COOKIE_SCRIPT: &str = "(() => { const https = location.protocol === 'https:'; if (https || location.hostname === 'localhost') document.cookie = 'axiis_desktop=1; path=/; max-age=31536000; SameSite=Lax' + (https ? '; Secure' : ''); })();";

/// Reads the two counts the app shell carries (`data-inbox`, `data-overdue`) and tells Rust, which draws the taskbar
/// badge. Our pages can call this one command and nothing else (see `capabilities/default.json`).
const BADGE_SCRIPT: &str = "(() => { if (!window.__TAURI_INTERNALS__) return; let last = ''; let queued = false; const send = () => { queued = false; if (document.readyState === 'loading') return; const shell = document.getElementById('app-shell'); const inbox = shell ? Number(shell.dataset.inbox) || 0 : 0; const overdue = shell ? Number(shell.dataset.overdue) || 0 : 0; const key = inbox + ',' + overdue; if (key === last) return; last = key; window.__TAURI_INTERNALS__.invoke('set_badge', { inbox, overdue }).catch(() => {}); }; const queue = () => { if (!queued) { queued = true; requestAnimationFrame(send); } }; new MutationObserver(queue).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-inbox', 'data-overdue'] }); document.addEventListener('DOMContentLoaded', queue); queue(); })();";

/// How often a shell left running in the tray looks for a new version.
const UPDATE_EVERY_SECS: u64 = 6 * 60 * 60;
static LAST_UPDATE_CHECK: AtomicU64 = AtomicU64::new(0);

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

/// A window may go to our own pages; a link out of the app goes to the system browser, never into a window.
fn route_navigation(app: &AppHandle, url: &Url) -> bool {
    if allowed(url) {
        return true;
    }
    if matches!(url.scheme(), "http" | "https") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
    false
}

/// A page on our origin that shows one item by itself (`/item/<id>`), which is what "Open in a new window" links to.
fn is_item_page(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && allowed(url)
        && url.path().strip_prefix("/item/").is_some_and(|id| !id.is_empty() && !id.contains('/'))
}

static ITEM_WINDOWS: AtomicU64 = AtomicU64::new(0);

/// What a link that asks for a new window gets: an item page opens as its own window, a smaller one with no
/// native access; any other address goes to the system browser. A window is never opened onto another site.
fn open_new_window(
    app: &AppHandle,
    url: Url,
    features: tauri::webview::NewWindowFeatures,
) -> tauri::webview::NewWindowResponse<tauri::Wry> {
    use tauri::webview::NewWindowResponse;
    if !is_item_page(&url) {
        route_navigation(app, &url);
        return NewWindowResponse::Deny;
    }
    let label = format!("item-{}", ITEM_WINDOWS.fetch_add(1, Ordering::Relaxed));
    let nav_handle = app.clone();
    let built = WebviewWindowBuilder::new(app, label, WebviewUrl::External("about:blank".parse().expect("a valid URL")))
        .window_features(features)
        .title("Axiis")
        .inner_size(520.0, 760.0)
        .min_inner_size(360.0, 480.0)
        .initialization_script(DESKTOP_COOKIE_SCRIPT)
        .on_navigation(move |url| route_navigation(&nav_handle, url))
        .build();
    match built {
        Ok(window) => NewWindowResponse::Create { window },
        Err(_) => NewWindowResponse::Deny,
    }
}

/// The address of the site this build shows: ours, or in a debug build the dev server named by `AXIIS_URL`.
fn site_origin() -> Url {
    let start = if cfg!(debug_assertions) {
        std::env::var("AXIIS_URL").unwrap_or_else(|_| START.to_string())
    } else {
        START.to_string()
    };
    let mut url: Url = start.parse().expect("the start address is a valid URL");
    url.set_path("/");
    url.set_query(None);
    url
}

/// Where the window goes when the OS hands the app `axiis://auth/callback?code=...`: our own callback route with
/// that one code, which finishes the sign-in with the verifier this window holds. Anything else, and any other
/// parameter, is ignored, so a link made by another app cannot steer the window.
fn auth_callback_target(link: &Url, origin: &Url) -> Option<Url> {
    if link.scheme() != "axiis" || link.host_str() != Some("auth") || link.path() != "/callback" {
        return None;
    }
    let mut target = origin.clone();
    target.set_path("/auth/callback");
    let code = link.query_pairs().find(|(key, _)| key == "code").map(|(_, value)| value.into_owned());
    match code {
        Some(code) if !code.is_empty() && code.len() <= 256 && code.chars().all(|c| c.is_ascii_alphanumeric() || "-._~".contains(c)) => {
            target.query_pairs_mut().append_pair("code", &code);
            Some(target)
        }
        // A refused or failed sign-in comes back without a code: show the page that says so.
        _ => {
            target.set_path("/login");
            target.query_pairs_mut().append_pair("error", "link");
            Some(target)
        }
    }
}

fn handle_deep_link(app: &AppHandle, link: &Url) {
    if let Some(target) = auth_callback_target(link, &site_origin()) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.navigate(target);
        }
        show_main(app);
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

/// Looks for a signed update and installs it. Release builds only, and at most every six hours, so a window kept in
/// the tray picks up a new version without a timer running while nobody is looking.
fn check_for_update(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if now.saturating_sub(LAST_UPDATE_CHECK.load(Ordering::Relaxed)) < UPDATE_EVERY_SECS {
        return;
    }
    LAST_UPDATE_CHECK.store(now, Ordering::Relaxed);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Ok(updater) = app.updater() else { return };
        // The signature is checked against the key in tauri.conf.json before anything is installed. On Windows the
        // installer closes the app and starts the new version.
        if let Ok(Some(update)) = updater.check().await {
            let _ = update.download_and_install(|_, _| {}, || {}).await;
        }
    });
}

fn show_main(app: &AppHandle) {
    check_for_update(app);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// 3 by 5 pixel glyphs for 0 to 9 and "+", three bits a row.
const GLYPHS: [[u8; 5]; 11] = [
    [7, 5, 5, 5, 7],
    [2, 6, 2, 2, 7],
    [7, 1, 7, 4, 7],
    [7, 1, 7, 1, 7],
    [5, 5, 7, 1, 1],
    [7, 4, 7, 1, 7],
    [7, 4, 7, 5, 7],
    [7, 1, 1, 1, 1],
    [7, 5, 7, 5, 7],
    [7, 5, 7, 1, 7],
    [0, 2, 7, 2, 0],
];

const BADGE_SIZE: u32 = 32;

/// A round badge with the count in white: red for what is past due, dark for the Inbox. Counts above 9 read "9+".
fn badge_pixels(count: u32, hot: bool) -> Vec<u8> {
    let glyphs: Vec<usize> = if count > 9 { vec![9, 10] } else { vec![count as usize] };
    let scale: i32 = if glyphs.len() == 1 { 4 } else { 3 };
    let width = glyphs.len() as i32 * 3 * scale + (glyphs.len() as i32 - 1) * scale;
    let (left, top) = ((BADGE_SIZE as i32 - width) / 2, (BADGE_SIZE as i32 - 5 * scale) / 2);
    let fill: [u8; 4] = if hot { [0xd9, 0x2d, 0x20, 0xff] } else { [0x2b, 0x2b, 0x33, 0xff] };
    let mut rgba = vec![0u8; (BADGE_SIZE * BADGE_SIZE * 4) as usize];
    let mid = (BADGE_SIZE as f32 - 1.0) / 2.0;
    for y in 0..BADGE_SIZE as i32 {
        for x in 0..BADGE_SIZE as i32 {
            let (dx, dy) = (x as f32 - mid, y as f32 - mid);
            if dx * dx + dy * dy > 15.5 * 15.5 {
                continue;
            }
            let mut pixel = fill;
            for (i, glyph) in glyphs.iter().enumerate() {
                let gx = (x - left - i as i32 * 4 * scale).div_euclid(scale);
                let gy = (y - top).div_euclid(scale);
                let inside = x >= left + i as i32 * 4 * scale && (0..3).contains(&gx) && (0..5).contains(&gy);
                if inside && GLYPHS[*glyph][gy as usize] >> (2 - gx) & 1 == 1 {
                    pixel = [0xff, 0xff, 0xff, 0xff];
                }
            }
            let at = ((y as u32 * BADGE_SIZE + x as u32) * 4) as usize;
            rgba[at..at + 4].copy_from_slice(&pixel);
        }
    }
    rgba
}

/// The one thing our pages may ask of the shell: show these two counts on the taskbar button and in the tray tooltip.
#[tauri::command]
fn set_badge(app: AppHandle, inbox: u32, overdue: u32) {
    let (inbox, overdue) = (inbox.min(9999), overdue.min(9999));
    if let Some(window) = app.get_webview_window("main") {
        let icon = match (overdue, inbox) {
            (0, 0) => None,
            (0, n) => Some(Image::new_owned(badge_pixels(n, false), BADGE_SIZE, BADGE_SIZE)),
            (n, _) => Some(Image::new_owned(badge_pixels(n, true), BADGE_SIZE, BADGE_SIZE)),
        };
        let _ = window.set_overlay_icon(icon);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let mut tip = String::from("Axiis");
        if overdue > 0 {
            tip.push_str(&format!(" · {overdue} past due"));
        }
        if inbox > 0 {
            tip.push_str(&format!(" · {inbox} in Inbox"));
        }
        let _ = tray.set_tooltip(Some(tip));
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
        .invoke_handler(tauri::generate_handler![set_badge])
        .plugin(tauri_plugin_updater::Builder::new().build())
        // A second launch brings the running app forward instead of opening another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
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
            let window_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", target)
                .title("Axiis")
                .inner_size(1280.0, 840.0)
                .min_inner_size(420.0, 560.0)
                // Tells the sign-in page this is the app, so it returns to the app by deep link instead of a web page.
                .initialization_script(DESKTOP_COOKIE_SCRIPT)
                .initialization_script(BADGE_SCRIPT)
                .on_navigation(move |url| route_navigation(&nav_handle, url))
                .on_new_window(move |url, features| open_new_window(&window_handle, url, features))
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

            // A debug build registers the axiis:// link itself; an installed build gets it from the installer.
            #[cfg(any(windows, target_os = "linux"))]
            if cfg!(debug_assertions) {
                let _ = app.deep_link().register_all();
            }
            // A link that launched the app, and links that arrive while it runs.
            if let Ok(Some(links)) = app.deep_link().get_current() {
                for link in links {
                    handle_deep_link(&handle, &link);
                }
            }
            let link_handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for link in event.urls() {
                    handle_deep_link(&link_handle, &link);
                }
            });

            let open = MenuItem::with_id(app, "open", "Open Axiis", true, None::<&str>)?;
            let quick = MenuItem::with_id(app, "capture", "Capture (Ctrl+Alt+A)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quick, &quit])?;

            let mut tray = TrayIconBuilder::with_id("main")
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

            check_for_update(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Axiis desktop shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn origin() -> Url {
        "https://axiis-lovat.vercel.app/".parse().unwrap()
    }

    fn target(link: &str) -> Option<String> {
        auth_callback_target(&link.parse().unwrap(), &origin()).map(|u| u.to_string())
    }

    #[test]
    fn a_code_goes_to_our_own_callback_route() {
        assert_eq!(
            target("axiis://auth/callback?code=abc-123_DEF.x~y").as_deref(),
            Some("https://axiis-lovat.vercel.app/auth/callback?code=abc-123_DEF.x%7Ey")
        );
    }

    #[test]
    fn only_the_code_is_carried_over() {
        assert_eq!(
            target("axiis://auth/callback?code=abc&next=https://evil.example&token=t").as_deref(),
            Some("https://axiis-lovat.vercel.app/auth/callback?code=abc")
        );
    }

    #[test]
    fn a_failed_sign_in_shows_the_login_page_with_its_error() {
        let want = Some("https://axiis-lovat.vercel.app/login?error=link");
        assert_eq!(target("axiis://auth/callback?error=access_denied").as_deref(), want);
        assert_eq!(target("axiis://auth/callback").as_deref(), want);
    }

    #[test]
    fn an_odd_code_is_not_passed_on() {
        let want = Some("https://axiis-lovat.vercel.app/login?error=link");
        assert_eq!(target("axiis://auth/callback?code=a%20b%2Fc").as_deref(), want);
        assert_eq!(target(&format!("axiis://auth/callback?code={}", "a".repeat(257))).as_deref(), want);
    }

    #[test]
    fn other_links_are_ignored() {
        assert_eq!(target("axiis://other/callback?code=abc"), None);
        assert_eq!(target("axiis://auth/elsewhere?code=abc"), None);
        assert_eq!(target("https://axiis-lovat.vercel.app/auth/callback?code=abc"), None);
    }

    #[test]
    fn the_badge_is_a_round_icon_with_the_count_in_white() {
        for (count, hot) in [(1, true), (7, false), (12, true), (9999, false)] {
            let rgba = badge_pixels(count, hot);
            assert_eq!(rgba.len(), (BADGE_SIZE * BADGE_SIZE * 4) as usize);
            let at = |x: usize, y: usize| &rgba[(y * BADGE_SIZE as usize + x) * 4..][..4];
            assert_eq!(at(0, 0)[3], 0, "corners stay clear");
            assert_eq!(at(4, 16)[3], 255, "the disc is filled");
            assert!(rgba.chunks(4).any(|p| p == [255, 255, 255, 255]), "the digits are drawn");
        }
        assert_eq!(badge_pixels(3, true)[(16 * 32 + 4) * 4..][..3], [0xd9, 0x2d, 0x20]);
    }

    #[test]
    fn only_an_item_page_on_our_origin_opens_a_window() {
        let item = |u: &str| is_item_page(&u.parse().unwrap());
        assert!(item("https://axiis-lovat.vercel.app/item/0b7c1d2e-1111-4222-8333-444455556666"));
        assert!(item("https://axiis-lovat.vercel.app/item/0b7c1d2e-1111-4222-8333-444455556666~2026-11-09"));
        assert!(!item("https://axiis-lovat.vercel.app/item/"));
        assert!(!item("https://axiis-lovat.vercel.app/item/a/b"));
        assert!(!item("https://axiis-lovat.vercel.app/today"));
        assert!(!item("https://evil.example/item/0b7c1d2e-1111-4222-8333-444455556666"));
    }

    #[test]
    fn navigation_stays_on_our_origin() {
        assert!(allowed(&"https://axiis-lovat.vercel.app/today".parse().unwrap()));
        assert!(allowed(&"http://tauri.localhost/index.html".parse().unwrap()));
        assert!(!allowed(&"https://evil.example/".parse().unwrap()));
        assert!(!allowed(&"axiis://auth/callback".parse().unwrap()));
    }
}
