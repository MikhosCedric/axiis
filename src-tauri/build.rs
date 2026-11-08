fn main() {
    // The one command the page may call: it sets the taskbar badge. See `capabilities/default.json`.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["set_badge"])),
    )
    .expect("failed to run the Tauri build script");
}
