# Rolodex — Tauri desktop app

A native-feeling macOS contacts widget. This folder is a complete Tauri v2
project; it just hasn't been built into a `.app` yet, since that step needs
to happen on your Mac (this scaffold was written on a Linux machine without
Xcode or Rust installed).

## One-time setup on your iMac

1. **Install Rust** (Tauri's backend is Rust):
   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   Restart Terminal after this finishes.

2. **Install Xcode Command Line Tools** (if you don't already have them):
   ```
   xcode-select --install
   ```

3. **Confirm Node is installed.** You likely already have it; check with
   `node --version`. If missing, install from nodejs.org or via Homebrew.

## Get the project running

1. Unzip this project and `cd` into it in Terminal.
2. Install JS dependencies:
   ```
   npm install
   ```
3. Generate app icons from a square image (1024x1024 PNG recommended —
   your JOE Design mark, or any placeholder square image for now):
   ```
   npx tauri icon path/to/your-icon.png
   ```
   This fills in `src-tauri/icons/` automatically. Skip this step to test
   first with default gray placeholder icons — Tauri will warn but still run.
4. Run it in dev mode (opens a live window, reloads on file changes):
   ```
   npm run tauri dev
   ```
5. When it opens, click **Import** in the title bar and select your `.vcf`
   file. Contacts are parsed and cached to the app's local data folder, so
   next time you launch it, they're already there — no re-import needed
   unless your contacts change.

## Building the installable app

```
npm run tauri build
```

This produces a signed-for-local-use `.app` in
`src-tauri/target/release/bundle/macos/` and a `.dmg` installer in the
neighboring `bundle/dmg/` folder. Drag the `.app` into `/Applications` and
it behaves like any other Mac app — Dock icon, Cmd+Tab, the works.

Note: this build is not notarized or Apple-signed with a paid developer
certificate, so on first launch macOS Gatekeeper may show a warning.
Right-click the app → **Open** the first time to bypass it. If you want a
fully notarized build (no warning at all, safe to share with others), that
needs an Apple Developer account ($99/year) — say the word and I'll walk
through that step when you're ready.

## If something doesn't compile

Tauri's plugin APIs shift between minor versions. If `npm install` pulls a
newer `@tauri-apps/plugin-fs` or `plugin-dialog` than what this scaffold
was written against, you may see a permission or import error on first
`tauri dev` run. Paste the exact error back to me and I'll patch the
`capabilities/default.json` or `main.js` call to match — this is common
with Tauri v2 and not a sign anything is fundamentally wrong.

## What's in here

```
rolodex-tauri/
  package.json              JS dependencies (Tauri CLI + plugin APIs)
  src-tauri/                 Rust backend
    Cargo.toml
    tauri.conf.json          window size, title, bundle target config
    capabilities/default.json  permissions: dialog + filesystem access
    src/main.rs               registers the dialog and fs plugins
    icons/                    generate with `npx tauri icon`
  src/                        frontend (what you actually see)
    index.html
    styles.css
    main.js                   window controls, import flow, card/index logic
    vcard.js                  vCard parser (JS port of the earlier Python one)
```
