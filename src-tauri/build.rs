fn main() {
    // The three commands the page may call: the taskbar badge, the items still to start, and saving an export. See `capabilities/default.json`.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["set_badge", "set_reminders", "save_export"])),
    )
    .expect("failed to run the Tauri build script");
}
