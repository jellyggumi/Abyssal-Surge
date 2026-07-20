# Abyssal Surge — TWA (APK) Build Kit

Packages https://jellyggumi.github.io/Abyssal-Surge/ as a Trusted Web Activity
Android app. **No APK is built in this repo's environment** — it lacks Android
tooling (JDK/SDK). This kit makes it a one-command build on any machine with:
Node.js 18+, JDK 17, and the Android SDK build tools (bubblewrap offers to
auto-download the JDK and SDK on first run if they are missing).

## 1. Install bubblewrap and initialize

```sh
npm i -g @bubblewrap/cli
mkdir abyssal-surge-twa && cd abyssal-surge-twa
cp /path/to/repo/apk/twa-manifest.json .
bubblewrap init --manifest https://jellyggumi.github.io/Abyssal-Surge/manifest.json
```

With `twa-manifest.json` copied in first, bubblewrap pre-fills its answers from
it (packageId `io.github.jellyggumi.abyssalsurge`, name "Abyssal Surge", theme
`#0b0d14`, start URL `/Abyssal-Surge/`, icon
`https://jellyggumi.github.io/Abyssal-Surge/assets/icons/icon-512.png`).

## 2. Generate a signing keystore (first time only)

```sh
keytool -genkey -v -keystore android.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep `android.keystore` and its passwords private; never commit them.

## 3. Build

```sh
bubblewrap build
```

Output: `app-release-signed.apk` (plus an `.aab` bundle for Play Store).

## 4. Publish Digital Asset Links (removes the URL bar)

Extract the signing cert SHA-256 fingerprint, copy
`apk/assetlinks-template.json` to `assetlinks.json`, and replace the
placeholder with it (colon-separated hex, as printed):

```sh
keytool -list -v -keystore android.keystore -alias android | grep SHA256
```

### Origin-scoped verification (critical)

Digital Asset Links are **origin-scoped**: Chrome fetches
`https://jellyggumi.github.io/.well-known/assetlinks.json` at the **host
root — never under `/Abyssal-Surge/`. This project-Pages repo cannot publish
that path, so committing `.well-known/` here does NOT work. Two real options:

1. **User-site repo:** create a GitHub repo literally named
   `jellyggumi.github.io` (serves at the origin root; create it if absent) and
   commit the file there as `.well-known/assetlinks.json`.
2. **Custom domain:** move the game to a domain whose root you control and
   publish `/.well-known/assetlinks.json` there.

If verification fails, the APK still builds, installs, and launches — but it
silently falls back to Custom Tabs and the browser URL bar stays visible.

## 5. Install

- **Sideload:** `adb install app-release-signed.apk` (enable "install unknown
  apps"). Verification is online — publish step 4 first.
- **Play Store:** upload the `.aab`. With Play App Signing, Google re-signs the
  app — use the SHA-256 from Play Console → Setup → App integrity instead of
  your upload key's fingerprint.

## Verification checklist

- [ ] `https://jellyggumi.github.io/.well-known/assetlinks.json` returns HTTP 200 valid JSON (host root, not /Abyssal-Surge/)
- [ ] Statement List Tester passes: https://developers.google.com/digital-asset-links/tools/generator (site + package + fingerprint)
- [ ] On device: launch the app — no URL bar. For verbose logs, `chrome://flags` → "Enable TWA verification debugging"
- [ ] App opens full-screen to the game; offline relaunch works (service worker cache abyssal-surge-static-v54)

