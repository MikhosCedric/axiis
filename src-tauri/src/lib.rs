//! The Axiis desktop shell: the hosted web app in a native window, plus what a browser tab cannot do.
//!
//! The page is never given a native API (see `capabilities/default.json`). Everything native here, the tray,
//! the capture hotkey and the navigation rules, is driven from Rust.

use std::collections::HashSet;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::image::Image;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

/// The one origin the window may show. Anything else opens in the system browser.
const HOST: &str = "axiis-lovat.vercel.app";
const START: &str = "https://axiis-lovat.vercel.app/";

/// Pressed anywhere in Windows: bring Axiis forward with the capture field ready.
const CAPTURE_HOTKEY: &str = "ctrl+alt+a";

/// Focuses the capture field the Today, Week, Month and Inbox pages carry; on any other page it goes to Today.
const FOCUS_CAPTURE: &str = "(() => { const f = document.getElementById('capture'); if (f) { f.focus(); f.select && f.select(); } else { location.assign('/today'); } })()";

/// Marks our pages as shown in the app. It carries no authority: anyone can set the cookie, and all it changes is
/// where a sign-in link returns to.
const DESKTOP_COOKIE_SCRIPT: &str = "(() => { const https = location.protocol === 'https:'; if (https || location.hostname === 'localhost') document.cookie = 'axiis_desktop=1; path=/; max-age=31536000; SameSite=Lax' + (https ? '; Secure' : ''); })();";

/// Reads what the app shell carries (`data-inbox`, `data-overdue`, `data-tray` for today's list, `data-reminders` for the
/// items still to start) and tells Rust, which draws the taskbar badge and the tray menu and speaks the reminders. Our pages can call this one command and nothing else (see `capabilities/default.json`).
const BADGE_SCRIPT: &str = "(() => { if (!window.__TAURI_INTERNALS__) return; let last = ''; let lastR = ''; let queued = false; const send = () => { queued = false; if (document.readyState === 'loading') return; const shell = document.getElementById('app-shell'); const inbox = shell ? Number(shell.dataset.inbox) || 0 : 0; const overdue = shell ? Number(shell.dataset.overdue) || 0 : 0; const raw = shell ? shell.dataset.tray || '' : ''; let rows = []; try { const v = JSON.parse(raw || '[]'); if (Array.isArray(v)) rows = v.filter((r) => typeof r === 'string'); } catch (e) {} const rraw = shell ? shell.dataset.reminders || '' : ''; if (rraw !== lastR) { lastR = rraw; let items = []; try { const v = JSON.parse(rraw || '[]'); if (Array.isArray(v)) items = v.filter((r) => r && typeof r.id === 'string' && typeof r.title === 'string' && Number.isFinite(r.at)); } catch (e) {} window.__TAURI_INTERNALS__.invoke('set_reminders', { items }).catch(() => {}); } const key = inbox + ',' + overdue + ',' + raw; if (key === last) return; last = key; window.__TAURI_INTERNALS__.invoke('set_badge', { inbox, overdue, rows }).catch(() => {}); }; const queue = () => { if (!queued) { queued = true; requestAnimationFrame(send); } }; new MutationObserver(queue).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-inbox', 'data-overdue', 'data-tray', 'data-reminders'] }); document.addEventListener('DOMContentLoaded', queue); queue(); })();";

/// Settings' "Download export" link, in the app: the page fetches the file as usual and hands its text to
/// `save_export`, which asks where to save it with the system dialog. In a browser this script is absent and the link
/// downloads as before; if anything here fails before the hand-off, the link is followed as a normal download.
const EXPORT_SCRIPT: &str = "(() => { if (!window.__TAURI_INTERNALS__) return; let busy = false; document.addEventListener('click', (e) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; const a = e.target instanceof Element ? e.target.closest('a[href]') : null; if (!a || a.dataset.nativeSave === 'skip') return; let url; try { url = new URL(a.href, location.href); } catch (err) { return; } if (url.origin !== location.origin || url.pathname !== '/settings/export') return; e.preventDefault(); if (busy) return; busy = true; let handed = false; fetch(url.href, { credentials: 'same-origin', cache: 'no-store' }).then(async (res) => { if (!res.ok) throw new Error('export ' + res.status); const m = /filename=\"?([^\";]+)\"?/i.exec(res.headers.get('Content-Disposition') || ''); const text = await res.text(); handed = true; return window.__TAURI_INTERNALS__.invoke('save_export', { name: m ? m[1] : '', text }); }).catch(() => { if (handed) return; a.dataset.nativeSave = 'skip'; a.click(); delete a.dataset.nativeSave; }).finally(() => { busy = false; }); }, true); })();";

/// The longest export the shell will write. An export at the account quotas is well under this; anything larger is
/// refused rather than held twice in memory.
const EXPORT_MAX_BYTES: usize = 128 * 1024 * 1024;
const EXPORT_NAME_CHARS: usize = 80;
const EXPORT_DEFAULT_NAME: &str = "axiis-export.json";

/// How often a shell left running in the tray looks for a new version.
const UPDATE_EVERY_SECS: u64 = 6 * 60 * 60;
static LAST_UPDATE_CHECK: AtomicU64 = AtomicU64::new(0);

/// Whether the window may navigate to `url`: our own origin and the bundled offline page, nothing else.
fn allowed(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        // Our own site only over https: a plain http address to it is never followed, so a hostile network
        // cannot sit in the gap before the redirect to https.
        "https" => {
            let host = url.host_str();
            host == Some("tauri.localhost") || host == Some(HOST)
        }
        "http" => {
            let host = url.host_str();
            host == Some("tauri.localhost")
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

/// Most lines of today's list the tray menu shows, and the longest one. The page already keeps to this; the shell does
/// not take its word for it.
const TRAY_ROWS: usize = 4;
const TRAY_ROW_CHARS: usize = 80;

/// The lines the page sent, made safe for a menu: no control characters, trimmed, cut short, none empty, few.
fn clean_rows(rows: Vec<String>) -> Vec<String> {
    rows.into_iter()
        .map(|r| r.chars().filter(|c| !c.is_control()).take(TRAY_ROW_CHARS).collect::<String>().trim().to_string())
        .filter(|r| !r.is_empty())
        .take(TRAY_ROWS)
        .collect()
}

/// The tray menu: today's lines when there are any, then the three fixed entries.
fn tray_menu(app: &AppHandle, rows: &[String]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for row in rows {
        menu.append(&MenuItem::with_id(app, "today", row, true, None::<&str>)?)?;
    }
    if !rows.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(app, "open", "Open Axiis", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "capture", "Capture (Ctrl+Alt+A)", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    Ok(menu)
}

/// The one thing our pages may ask of the shell: show these counts on the taskbar button and in the tray tooltip, and
/// today's lines in the tray menu.
#[tauri::command]
fn set_badge(app: AppHandle, inbox: u32, overdue: u32, rows: Vec<String>) {
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
        if let Ok(menu) = tray_menu(&app, &clean_rows(rows)) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// How long before an item starts the shell speaks, and how often it looks. A reminder is spoken once per item and start.
const REMINDER_LEAD_MS: u64 = 10 * 60 * 1000;
const REMINDER_LOOK_SECS: u64 = 20;
const REMINDER_MAX: usize = 50;
const REMINDER_TITLE_CHARS: usize = 80;
const REMINDER_ID_CHARS: usize = 64;
/// More than this many spoken keys and the memory is cleared, so a shell left running for weeks stays small.
const SPOKEN_MAX: usize = 500;

/// What a page may report for one item: who it is, when it starts (milliseconds since 1970), and what to call it.
#[derive(serde::Deserialize)]
struct ReminderIn {
    id: String,
    at: u64,
    title: String,
}

#[derive(Clone, Debug, PartialEq)]
struct Reminder {
    id: String,
    at: u64,
    title: String,
}

impl Reminder {
    fn key(&self) -> String {
        format!("{}@{}", self.id, self.at)
    }
}

/// The reminders the page last reported, and the ones already spoken. Kept here, not in the page, so a page that
/// reloads does not make the shell speak twice, and a hidden window that cannot refresh still reminds from what it knew.
#[derive(Default)]
struct Reminders {
    list: Vec<Reminder>,
    spoken: HashSet<String>,
}

fn plain(text: &str, max: usize) -> String {
    text.chars().filter(|c| !c.is_control()).take(max).collect::<String>().trim().to_string()
}

/// The page's reports made safe: plain short text, a real time, few of them. Nothing the page says is run.
fn clean_reminders(items: Vec<ReminderIn>) -> Vec<Reminder> {
    items
        .into_iter()
        .filter(|r| r.at > 0)
        .map(|r| Reminder { id: plain(&r.id, REMINDER_ID_CHARS), at: r.at, title: plain(&r.title, REMINDER_TITLE_CHARS) })
        .filter(|r| !r.id.is_empty() && !r.title.is_empty())
        .take(REMINDER_MAX)
        .collect()
}

/// The reminders to speak at `now`: starting within the lead time and not yet started, and not spoken before.
fn due(list: &[Reminder], spoken: &HashSet<String>, now: u64) -> Vec<Reminder> {
    list.iter()
        .filter(|r| r.at > now && r.at - now <= REMINDER_LEAD_MS && !spoken.contains(&r.key()))
        .cloned()
        .collect()
}

fn minutes_words(ms: u64) -> String {
    let minutes = ms.div_ceil(60_000).max(1);
    if minutes == 1 {
        "Starts in 1 minute".to_string()
    } else {
        format!("Starts in {minutes} minutes")
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// The second thing our pages may ask of the shell: here are the items still to start today. The shell, not the page,
/// decides when to notify (`speak_reminders`).
#[tauri::command]
fn set_reminders(app: AppHandle, items: Vec<ReminderIn>) {
    let state = app.state::<Mutex<Reminders>>();
    if let Ok(mut reminders) = state.lock() {
        reminders.list = clean_reminders(items);
    };
}

/// Whether `id` is an item key the app's `?item=` takes: a stored item's uuid, or `<series uuid>~<YYYY-MM-DD>` for an
/// occurrence. Anything else from the page is never put in an address.
fn item_key(id: &str) -> bool {
    fn uuid(s: &str) -> bool {
        let groups: Vec<&str> = s.split('-').collect();
        groups.len() == 5
            && groups.iter().zip([8, 4, 4, 4, 12]).all(|(g, n)| g.len() == n && g.chars().all(|c| c.is_ascii_hexdigit()))
    }
    fn date(s: &str) -> bool {
        let b = s.as_bytes();
        b.len() == 10
            && b[4] == b'-'
            && b[7] == b'-'
            && b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    }
    match id.split_once('~') {
        None => uuid(id),
        Some((series, day)) => uuid(series) && date(day),
    }
}

/// Where a click on a reminder goes: Today with that item open, as the app's own links do (`/today?item=<key>`).
fn reminder_target(origin: &Url, id: &str) -> Option<Url> {
    if !item_key(id) {
        return None;
    }
    let mut target = origin.clone();
    target.set_path("/today");
    target.query_pairs_mut().append_pair("item", id);
    Some(target)
}

/// A click on a reminder (the toast itself, while it is on screen) brings the window forward on that item. Windows
/// reports no click once the toast has gone to the Action Center; the tray icon still brings the window back.
fn open_reminder(app: &AppHandle, performed: &tauri_plugin_notification::ActionPerformed) {
    let id = performed.notification().and_then(|n| n.extra().get("item")).and_then(|v| v.as_str());
    if let (Some(target), Some(window)) = (id.and_then(|id| reminder_target(&site_origin(), id)), app.get_webview_window("main")) {
        let _ = window.navigate(target);
    }
    show_main(app);
}

/// A page of ours (not the bundled offline page), which is the only place an export can come from.
fn is_our_page(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https") && allowed(url) && url.host_str() != Some("tauri.localhost")
}

/// The name the save dialog suggests, from what the page sent: letters, digits, `-`, `_` and `.` only, no folder, no
/// name Windows reserves, cut short, always `.json`.
fn export_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let kept: String = base.chars().filter(|c| c.is_ascii_alphanumeric() || "-_.".contains(*c)).collect();
    let stem = if kept.to_ascii_lowercase().ends_with(".json") { &kept[..kept.len() - 5] } else { &kept[..] };
    let stem: String = stem.trim_matches('.').chars().take(EXPORT_NAME_CHARS - 5).collect();
    let stem = stem.trim_end_matches('.');
    let reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
    let device = stem.split('.').next().is_some_and(|first| reserved.contains(&first.to_ascii_uppercase().as_str()));
    if stem.is_empty() || device {
        EXPORT_DEFAULT_NAME.to_string()
    } else {
        format!("{stem}.json")
    }
}

/// Whether an export of `len` bytes may be written: something, and not more than the cap.
fn export_fits(len: usize) -> bool {
    len > 0 && len <= EXPORT_MAX_BYTES
}

fn say_export_failed(app: &AppHandle, window: &tauri::WebviewWindow, text: &str) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    app.dialog().message(text).title("Axiis").kind(MessageDialogKind::Error).parent(window).show(|_| {});
}

/// The third thing our pages may ask of the shell, and the only one that touches the disk: save this export where the
/// user picks in the system dialog. Main window, our origin, a size cap and a cleaned name; the page never names the
/// folder or sees the path. `false` when the user cancels.
#[tauri::command]
async fn save_export(app: AppHandle, window: tauri::WebviewWindow, name: String, text: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    if window.label() != "main" || !window.url().is_ok_and(|u| is_our_page(&u)) {
        return Err("not allowed here".into());
    }
    if !export_fits(text.len()) {
        say_export_failed(&app, &window, "This export is too large for the app to save. Download it from axiis-lovat.vercel.app in a browser instead.");
        return Err("too large".into());
    }
    let Some(path) = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Save your Axiis export")
        .set_file_name(export_name(&name))
        .add_filter("JSON", &["json"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let written = path.into_path().map_err(|e| e.to_string()).and_then(|p| std::fs::write(p, text.as_bytes()).map_err(|e| e.to_string()));
    if let Err(e) = written {
        say_export_failed(&app, &window, "The export could not be saved there. Nothing was changed. Try another folder.");
        return Err(e);
    }
    Ok(true)
}

/// Looks every few seconds and speaks what has come due. Runs for as long as the shell does, window or no window.
fn speak_reminders(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(REMINDER_LOOK_SECS));
        let now = now_ms();
        let state = app.state::<Mutex<Reminders>>();
        let Ok(mut reminders) = state.lock() else { continue };
        let ready = due(&reminders.list, &reminders.spoken, now);
        if reminders.spoken.len() > SPOKEN_MAX {
            reminders.spoken.clear();
        }
        for r in &ready {
            reminders.spoken.insert(r.key());
        }
        drop(reminders);
        for r in ready {
            let mut note = app.notification().builder().title(&r.title).body(minutes_words(r.at - now));
            if item_key(&r.id) {
                note = note.extra("item", &r.id);
            }
            let _ = note.show();
        }
    });
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
        .invoke_handler(tauri::generate_handler![set_badge, set_reminders, save_export])
        .plugin(tauri_plugin_updater::Builder::new().build())
        // A second launch brings the running app forward instead of opening another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Used from Rust only, for the export's Save dialog; the page gets no dialog API.
        .plugin(tauri_plugin_dialog::init())
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
            app.manage(Mutex::new(Reminders::default()));
            // Registered before the first reminder, since a notification shown with no handler reports no click.
            let click_handle = handle.clone();
            let _ = app.notification().on_action(move |performed| open_reminder(&click_handle, performed));
            speak_reminders(handle.clone());

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
                .initialization_script(EXPORT_SCRIPT)
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

            let menu = tray_menu(&handle, &[])?;

            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("Axiis")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" | "today" => show_main(app),
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
    fn the_tray_list_is_kept_short_and_plain() {
        let long = "x".repeat(200);
        let rows = clean_rows(vec!["  Today · 1 of 2 done ".into(), "".into(), "bell\x07ing\n".into(), long, "d".into(), "e".into(), "f".into()]);
        assert_eq!(rows.len(), TRAY_ROWS);
        assert_eq!(rows[0], "Today · 1 of 2 done");
        assert_eq!(rows[1], "belling");
        assert_eq!(rows[2].chars().count(), TRAY_ROW_CHARS);
        assert!(rows.iter().all(|r| !r.chars().any(|c| c.is_control())));
    }

    fn rem(id: &str, at: u64) -> Reminder {
        Reminder { id: id.into(), at, title: id.into() }
    }

    #[test]
    fn a_reminder_is_spoken_inside_its_lead_time_once() {
        let now = 1_000_000_000;
        let list = vec![rem("soon", now + 5 * 60_000), rem("later", now + 30 * 60_000), rem("started", now - 1), rem("edge", now + REMINDER_LEAD_MS)];
        let ready = due(&list, &HashSet::new(), now);
        assert_eq!(ready.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), ["soon", "edge"]);

        let spoken: HashSet<String> = ready.iter().map(Reminder::key).collect();
        assert!(due(&list, &spoken, now).is_empty());
        // The same item moved to another time is a new reminder.
        assert_eq!(due(&[rem("soon", now + 6 * 60_000)], &spoken, now).len(), 1);
    }

    #[test]
    fn what_the_page_reports_is_kept_plain_short_and_few() {
        let item = |id: &str, at: u64, title: &str| ReminderIn { id: id.into(), at, title: title.into() };
        let mut items = vec![item("a", 5, "  Call\x07 the vet\n "), item("", 5, "no id"), item("b", 0, "no time"), item("c", 5, "")];
        items.extend((0..80).map(|i| item(&format!("n{i}"), 9, &"y".repeat(200))));
        let kept = clean_reminders(items);
        assert_eq!(kept.len(), REMINDER_MAX);
        assert_eq!(kept[0], Reminder { id: "a".into(), at: 5, title: "Call the vet".into() });
        assert!(kept.iter().all(|r| r.title.chars().count() <= REMINDER_TITLE_CHARS));
    }

    #[test]
    fn the_wait_is_said_in_whole_minutes_rounded_up() {
        assert_eq!(minutes_words(1), "Starts in 1 minute");
        assert_eq!(minutes_words(60_001), "Starts in 2 minutes");
        assert_eq!(minutes_words(REMINDER_LEAD_MS), "Starts in 10 minutes");
    }

    #[test]
    fn only_an_item_key_is_put_in_a_reminder_address() {
        let id = "0b7c1d2e-1111-4222-8333-444455556666";
        assert!(item_key(id));
        assert!(item_key(&format!("{id}~2026-11-09")));
        for bad in ["", "abc", &format!("{id}~"), &format!("{id}~2026-1-09"), &format!("{id}&next=x"), "0b7c1d2e-1111-4222-8333-44445555666g", &format!("{id}~2026-11-09~x")] {
            assert!(!item_key(bad), "{bad}");
        }
        assert_eq!(
            reminder_target(&origin(), &format!("{id}~2026-11-09")).map(|u| u.to_string()).as_deref(),
            Some("https://axiis-lovat.vercel.app/today?item=0b7c1d2e-1111-4222-8333-444455556666%7E2026-11-09")
        );
        assert_eq!(reminder_target(&origin(), "../settings"), None);
    }

    #[test]
    fn the_export_name_is_plain_and_ends_in_json() {
        assert_eq!(export_name("axiis-export-2026-11-10.json"), "axiis-export-2026-11-10.json");
        assert_eq!(export_name("..\\..\\Windows\\evil.exe"), "evil.exe.json");
        assert_eq!(export_name("/etc/passwd"), "passwd.json");
        assert_eq!(export_name("a b<c>:\"d|?*.JSON"), "abcd.json");
        assert_eq!(export_name(""), EXPORT_DEFAULT_NAME);
        assert_eq!(export_name("...json"), EXPORT_DEFAULT_NAME);
        assert_eq!(export_name("con.json"), EXPORT_DEFAULT_NAME);
        assert_eq!(export_name("Nul.tar.json"), EXPORT_DEFAULT_NAME);
        assert_eq!(export_name("console.json"), "console.json");
        let long = export_name(&"x".repeat(500));
        assert_eq!(long.len(), EXPORT_NAME_CHARS);
        assert!(long.ends_with(".json"));
    }

    #[test]
    fn an_export_is_written_only_within_the_cap() {
        assert!(!export_fits(0));
        assert!(export_fits(1));
        assert!(export_fits(EXPORT_MAX_BYTES));
        assert!(!export_fits(EXPORT_MAX_BYTES + 1));
    }

    #[test]
    fn an_export_comes_only_from_our_pages() {
        assert!(is_our_page(&"https://axiis-lovat.vercel.app/settings".parse().unwrap()));
        assert!(!is_our_page(&"http://tauri.localhost/index.html".parse().unwrap()));
        assert!(!is_our_page(&"https://evil.example/settings".parse().unwrap()));
        assert!(!is_our_page(&"tauri://localhost/".parse().unwrap()));
    }

    #[test]
    fn navigation_stays_on_our_origin() {
        assert!(allowed(&"https://axiis-lovat.vercel.app/today".parse().unwrap()));
        assert!(allowed(&"http://tauri.localhost/index.html".parse().unwrap()));
        assert!(!allowed(&"https://evil.example/".parse().unwrap()));
        assert!(!allowed(&"axiis://auth/callback".parse().unwrap()));
    }

    #[test]
    fn our_site_is_only_followed_over_https() {
        assert!(!allowed(&"http://axiis-lovat.vercel.app/today".parse().unwrap()));
        assert!(!allowed(&"http://axiis-lovat.vercel.app:80/".parse().unwrap()));
        assert!(allowed(&"https://axiis-lovat.vercel.app/today".parse().unwrap()));
        // Not a look-alike host either.
        assert!(!allowed(&"https://axiis-lovat.vercel.app.evil.example/".parse().unwrap()));
    }
}
