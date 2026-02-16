# CI/CD Setup Guide

This guide explains how to set up GitHub Actions secrets for automated signing, notarization, and distribution of your Tauri application across macOS and Windows.

## GitHub Secrets Overview

To enable automated releases, you must configure the following secrets in your GitHub repository (**Settings > Secrets and variables > Actions**).

### Updater Signing (Required for all platforms)

These secrets are used by the Tauri updater to verify the authenticity of update bundles.

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Ed25519 private key for update signing | Run `bunx tauri signer generate` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used to encrypt the private key | Your choice (must match what you entered during generation) |

### macOS Code Signing & Notarization

Required for distributing macOS applications outside the App Store and avoiding "unidentified developer" warnings.

| Secret | Description | How to Get |
|--------|-------------|------------|
| `APPLE_CERTIFICATE` | Base64 encoded `.p12` certificate | Export "Developer ID Application" from Keychain Access |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file | Set during export from Keychain |
| `KEYCHAIN_PASSWORD` | Temporary keychain password for CI | Generate a random string |
| `APPLE_ID` | Your Apple ID email | Your Apple Developer account email |
| `APPLE_PASSWORD` | App-specific password | Generate at [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-character Team ID | Found in [Apple Developer Portal](https://developer.apple.com/account/) |

### Windows Code Signing

Required to avoid "Windows protected your PC" (SmartScreen) warnings.

| Secret | Description | How to Get |
|--------|-------------|------------|
| `WINDOWS_CERTIFICATE` | Base64 encoded `.pfx` certificate | Export from your certificate store |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the `.pfx` file | Set during export |

---

## Platform Setup Instructions

### 1. Generate Updater Keys

The Tauri updater requires a public/private key pair.

1. Run the following command:
   ```bash
   bunx tauri signer generate
   ```
2. Save the **Public Key** in your `tauri.conf.json` under `plugins > updater > pubkey`.
3. Add the **Private Key** to GitHub as `TAURI_SIGNING_PRIVATE_KEY`.
4. Add the **Password** to GitHub as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### 2. Configure macOS Signing

#### Exporting the Certificate
1. Open **Keychain Access** on your Mac.
2. Find your **Developer ID Application** certificate.
3. Right-click and select **Export...**.
4. Save as a `.p12` file and set a password.
5. Convert the file to Base64:
   ```bash
   base64 -i YourCert.p12 | pbcopy
   ```
6. Paste the result into the `APPLE_CERTIFICATE` secret on GitHub.

#### App-Specific Password
1. Go to [appleid.apple.com](https://appleid.apple.com).
2. Sign in and go to **App-Specific Passwords**.
3. Generate a new password (e.g., "GitHub Actions Release").
4. Add this to the `APPLE_PASSWORD` secret.

### 3. Configure Windows Signing

1. Obtain a code signing certificate from a CA (Certificate Authority).
2. Export the certificate as a `.pfx` file.
3. Convert the file to Base64:
   ```powershell
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("YourCert.pfx")) | clip
   ```
   Or on macOS/Linux:
   ```bash
   base64 -i YourCert.pfx | pbcopy
   ```
4. Paste the result into the `WINDOWS_CERTIFICATE` secret on GitHub.

---

## Troubleshooting

### "No signing identity found"
- **Cause:** The `APPLE_CERTIFICATE` or `WINDOWS_CERTIFICATE` is missing, expired, or incorrectly encoded.
- **Fix:** Verify the Base64 string is correct and the certificate hasn't expired. Ensure `APPLE_CERTIFICATE_PASSWORD` matches the one set during export.

### "Notarization failed"
- **Cause:** Incorrect Apple ID, Team ID, or App-specific password.
- **Fix:** Double-check `APPLE_ID`, `APPLE_TEAM_ID`, and ensure you are using an **App-specific password**, not your primary Apple ID password.

### "Windows signing failed"
- **Cause:** Incorrect certificate format or password.
- **Fix:** Ensure the certificate is a valid `.pfx` file and `WINDOWS_CERTIFICATE_PASSWORD` is correct.

### "Updater signature verification failed"
- **Cause:** Mismatch between the private key used for signing and the public key in `tauri.conf.json`.
- **Fix:** Ensure `TAURI_SIGNING_PRIVATE_KEY` matches the public key configured in your app.
