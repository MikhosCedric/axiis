fn main() {
    // The two commands the page may call: the taskbar badge and the items still to start. See `capabilities/default.json`.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["set_badge", "set_reminders"])),
    )
    .expect("failed to run the Tauri build script");
}
