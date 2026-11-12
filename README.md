# FTP Sync / Backup — Obsidian Plugin `v1.4.0`
>
> - [English](#english)
> - [فارسی](#فارسی)

---

<a id="english"></a>

<div dir="ltr" lang="en">

# English

## Overview

**FTP Sync / Backup** backs up and syncs your Obsidian vault with an FTP server.

It syncs **all vault files**, not just notes: Markdown files, images, PDFs, audio, attachments, and any other file in your vault. Folder structure is preserved, including empty folders.

It runs **only on Obsidian Desktop**. It does not work on mobile.

## Features

### Sync

- **Three sync modes:** Mirror Upload, Two-Way, Mirror Download.
- **Only changed files are copied.** If nothing changed, a sync finishes quickly with `All files are in sync`.
- **Fast check (default) and Precise check.** Fast mode compares name + size only, like `rclone`. Precise mode also compares modification time and asks the server for an exact `MDTM`.
- **Sync memory (`syncState`).** For every file, the plugin remembers the last synced local size / time and remote size / time in `data.json`. If neither side changed since the last sync, the file is skipped, even if the local and remote timestamps differ.
- **Empty folders are synced.** Empty folders are created on the destination and are not lost.
- **Folder sync, not just whole-vault sync.** You can sync only one local folder, for example `Notes/Work`.
- **Remote folder is created automatically.** If the destination folder on the server does not exist, it is created, including nested folders.

### Connection and protocols

- **FTP, FTPS Explicit, and FTPS Implicit.**
- **Passive mode (`PASV`)** and **binary transfer (`TYPE I`)**.
- **FTPS data protection** with `PBSZ 0` / `PROT P` when FTPS is used.
- **Connection test** before syncing.
- **KeepAlive, timeout, and retry.** The plugin sends `NOOP` regularly to keep long syncs alive, retries on timeout / disconnect, and reconnects and continues from the next file.
- **Per-file errors do not stop the whole sync.** If one file fails, the error is logged and sync continues with the next file.
- **Large vault friendly.** The server file list is fetched with a single `LIST -R` request when the server supports it, with an automatic fallback to folder-by-folder listing. Local files are read from Obsidian's cached file list instead of asking the disk for every file one by one.

### Automation and control

- **Auto-sync every N minutes.** `0` means off.
- **Sync on Obsidian startup.**
- **Sync now, Test connection, Show log, and Stop sync** from Settings.
- **Ribbon icon.** Click to start sync. Click again while syncing to stop it.
- **Command Palette commands:**
  - `FTP Sync: Sync Now`
  - `FTP Sync: Show Log`
  - `FTP Sync: Test Connection`
  - `FTP Sync: Stop Sync`
- **Stop works at any time.** The Stop button is always enabled. Sync stops at the next file, and the next sync only does the remaining work.
- **Status bar.** During sync it shows progress, for example `FTP • 45% (9/20)`. When idle it shows the last sync time, for example `FTP • Last sync: ...`, or `FTP • Never synced`.

### Logs

- **Live log in Settings.** New log lines appear in Settings as the sync runs. No refresh button is needed.
- **Log modal.** `Show Log` opens the full log in a popup.
- **Persistent log.** The last **300** log lines are saved in `data.json` and survive restarts.
- **Clear log** button in Settings and in the log modal.
- **Clear summary in the log.** Every sync logs local file count, server file count, number of required operations, and at the end uploads / downloads / deletions.

### Security

- **Password is never stored as plain text in `data.json`.**
- **Priority 1:** Electron `safeStorage` (OS Keychain) when available. Stored as `SAFE:...`.
- **Priority 2:** `AES-256-GCM` encryption. The key is stored in Obsidian's `localStorage`, not in `data.json`. Stored as `AES:...`.
- **Plain-text password exists only in memory (RAM).**
- **Old plain-text passwords are migrated automatically** on first run: they are encrypted and the plain-text field is removed.
- **Password field in Settings is always empty.** If a password is saved, it shows `•••••• (saved)`. Leaving it empty keeps the old password. Typing a new one replaces it.
- **Clear saved password** button removes the password from memory and settings.

### Safety

- **The plugin's own folder is never synced:** `.obsidian/plugins/ftp-sync` is always excluded, so sync can never loop on itself.
- **`.obsidian` and `.trash` are off by default** and are only synced when you explicitly turn them on.
- **`.obsidian` sync includes settings, themes, and plugins** (except this plugin itself).
- **`.trash` sync includes files in Obsidian's trash.**
- **`.obsidian` and `.trash` are only synced when syncing the whole vault** (Local folder is empty). If you sync only one local folder, they are not included.
- **Delete guard.** Files ending with `:` are never deleted, because a real file on Windows cannot end with `:`.
- **Mirror delete is optional.** See [Sync modes](#sync-modes) and [Safety notes](#safety-notes).

## Requirements

- **Obsidian Desktop only.** Mobile is not supported.
- Obsidian `0.15.0` or newer.
- An FTP / FTPS server account with read, write, create-folder, and delete permissions for the destination folder.
- Network access to the FTP server. Passive FTP must not be blocked by a firewall.

## Installation

1. Download / unzip the plugin.
2. Create this folder in your vault:
   - `Vault/.obsidian/plugins/ftp-sync/`
3. Put all 4 files inside it:
   - `manifest.json`
   - `main.js`
   - `styles.css`
   - `README.md`
4. Close and reopen Obsidian.
5. Go to `Settings → Community plugins` and enable **FTP Sync / Backup**.

## Quick Start

1. Open `Settings → FTP Sync / Backup`.
2. Fill in **FTP Host**, **Port**, **Username**, and **Password**.
3. Choose **Protocol**:
   - `FTP` for plain FTP.
   - `FTPS Explicit` if your server supports FTPS (recommended when available).
   - `FTPS Implicit` for port `990`.
4. Set **Destination folder on FTP server**, for example `/obsidian-backup`.
5. Leave **Local folder to sync** empty to sync the whole vault.
6. Choose **Sync mode**. For a simple backup, use **Mirror Upload**.
7. Click **Test Connection**.
8. Click **Sync Now**.

## Sync Modes

| Mode | Direction | What happens | Deletion |
| --- | --- | --- | --- |
| **Mirror Upload** | Local → Server | Vault becomes the source. New and changed local files are uploaded. | If **Delete extra files in Mirror mode** is on, files on the server that are not in the vault are deleted. Extra server folders are removed, deepest first. |
| **Two-Way** | Both directions | New files are copied to the other side. For files on both sides, the **newest file wins**. It does not merge note contents. | **Never deletes.** A file deleted on one side is not deleted on the other side by Two-Way sync. |
| **Mirror Download** | Server → Vault | Server becomes the source. New and changed server files are downloaded. | If **Delete extra files in Mirror mode** is on, local files that are not on the server are deleted. Extra local folders are removed, deepest first. |

### How the winner is decided in Two-Way mode

- If a file exists only on one side, it is copied to the other side.
- If it exists on both sides and the sizes differ, the plugin uses modification time and sync memory to decide which side changed.
- If it exists on both sides and the sizes are equal, in **Fast** mode it is treated as the same file and skipped, unless sync memory shows that only one side changed.
- If both sides changed, the newest file wins and overwrites the other side. There is no content merge and no conflict file. Keep this in mind before editing the same note on both sides.

## How Change Detection Works

1. **Collect local files.** Local files and folders are collected from Obsidian's cached file list. `.obsidian` and `.trash` are collected separately with the vault adapter when their toggles are on.
2. **Collect server files.** The plugin tries `LIST -R` first (whole tree in one request). If the server does not support it, it falls back to listing folder by folder. It also fetches the root listing separately and merges it, so root files and folders are never lost.
3. **Compare.** For each file:
   - If it exists only on one side → copy it.
   - If sizes differ → copy the newer / source side.
   - If sizes are equal and nothing changed since the last sync → skip it.
   - In **Fast** mode, equal name + equal size means skip, with no `MDTM` request per file.
   - In **Precise** mode, modification time is also compared, and an exact `MDTM` is fetched from the server when times are close.
4. **Execute in order.** First create missing folders, then upload / download files, then delete extra files, then remove extra folders.
5. **Update sync memory.** After every successful upload / download, sync memory for that file is updated.
6. **Preserve times where possible.** After upload, the plugin tries to set the server time with `MDTM`. After download, it sets the local file time to the server time.

### Fast vs Precise check

| Check mode | What is compared | Speed | Best for |
| --- | --- | --- | --- |
| **Fast — name + size (rclone-style)** | File name + file size | Very fast. No `MDTM` per file. A large vault can be checked in seconds. | Normal use, large vaults. |
| **Precise — size + time + MDTM** | Size + modification time + exact server `MDTM` | Slower. | When you edit a file without changing its size and want that edit to be detected. |

Default is **Fast**.

### Timestamp tolerance

- Local time tolerance: **2 seconds**.
- Server time from `LIST` has minute precision, so server time tolerance is **120 seconds**.
- When times are close, the plugin fetches an exact `MDTM` from the server before deciding.

## Settings Reference

| Setting | Default | Description |
| --- | --- | --- |
| **FTP Host** | _(empty)_ | Example: `ftp.example.com` or server IP. |
| **Port** | `21` | Default FTP: `21`. FTPS Implicit: `990`. |
| **Username** | _(empty)_ | FTP username. |
| **Password** | _(empty)_ | Stored encrypted only. Field shows `•••••• (saved)` when a password is saved. Leave empty to keep the old password. |
| **Clear saved password** | — | Button. Removes the password from memory and settings. |
| **Protocol** | `FTP` | `FTP` (no encryption) / `FTPS Explicit` (recommended) / `FTPS Implicit` (port 990). |
| **Destination folder on FTP server** | `/obsidian-backup` | Example: `/obsidian-backup`. Created automatically if it does not exist. |
| **Local folder to sync** | _(empty)_ | Empty = whole vault. Example: `Notes/Work`. |
| **Sync mode** | `Mirror Upload` | Mirror Upload / Two-Way / Mirror Download. |
| **Check speed** | `Fast` | Fast (name + size) / Precise (size + time + MDTM). |
| **Delete extra files in Mirror mode** | `On` | In Mirror modes, delete files on the destination that are not on the source. |
| **Sync `.obsidian` folder** | `Off` | On = settings, themes, and plugins are synced too. This plugin's own folder is still never synced. |
| **Sync `.trash` folder** | `Off` | On = files in `.trash` are synced too. |
| **Timeout per command (seconds)** | `120` | Range: `30` to `600`. Use `300` for a large vault or slow internet. |
| **KeepAlive interval (seconds)** | `30` | Range: `10` to `120`. Sends `NOOP` to keep the connection alive. |
| **Retries on disconnect** | `2` | Range: `0` to `5`. Reconnects and continues from the next file. |
| **Auto-sync — every how many minutes?** | `0` | `0` = off. Example: `15` = every 15 minutes. |
| **Sync on Obsidian startup** | `Off` | Syncs shortly after Obsidian opens. |
| **Test and Sync** | — | Buttons: Test Connection / Sync Now / Show Log. |
| **Stop Sync** | — | Button. Always enabled. Stops a running sync. |
| **Sync log — live** | — | Live log box in Settings, plus Clear Log button and last sync time. |

## Running a Sync

- **Settings:** Click **Sync Now**.
- **Ribbon icon:** Click the refresh icon in the left ribbon.
- **Command Palette (`Ctrl/Cmd + P`):** Run `FTP Sync: Sync Now`.
- **Auto-sync:** Set auto-sync minutes and / or turn on sync on startup.

To stop a running sync:

- Click **Stop Sync** in Settings, or
- Click the ribbon icon again, or
- Run `FTP Sync: Stop Sync` from the Command Palette.

## Status Bar and Live Log

- **During sync:** `FTP • 45% (9/20)`
- **Stopping:** `FTP • Stopping…`
- **Idle, after a sync:** `FTP • Last sync: ...`
- **Never synced:** `FTP • Never synced`
- **Log:** The Settings page shows a live log box. `Show Log` opens the same log in a modal. The log shows counts, operations, uploads, downloads, deletions, warnings, and errors.

## Safety Notes

- **Mirror modes can delete.** In Mirror Upload, server files not in the vault are deleted. In Mirror Download, local files not on the server are deleted, if **Delete extra files in Mirror mode** is on. Turn it off if you are not sure.
- **Test on a small folder first.** Before your first full sync, test with a small local folder and a test remote folder.
- **Keep a separate backup before the first Mirror Download.** Mirror Download overwrites local files with server files.
- **Two-Way does not merge.** If the same file changed on both sides, the newest version overwrites the other. There is no merged version.
- **FTP is not encrypted.** Plain FTP sends credentials and data without encryption. Use FTPS when your server supports it.
- **This plugin is a sync tool, not version history.** It does not keep old versions of files. For version history, keep a separate backup.
- **`.obsidian` sync is powerful.** It syncs settings and plugins. Turn it on only if you want your Obsidian setup on the server too.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| **Connection test fails** | Check host, port, username, password, and protocol. Check that FTPS is actually enabled on the server if you chose FTPS. Check firewall / passive FTP. |
| **Sync times out on a large vault** | Increase **Timeout** to `300`, keep **KeepAlive** at `30`, and use **Fast** check mode. |
| **Same files are copied again** | Use **Fast** mode for normal use. If you use **Precise** mode, note that some servers do not accept `MDTM` to set file time, so server time may differ from local time. Sync memory handles this in most cases. |
| **`.obsidian` / `.trash` are not syncing** | Turn on their toggles **and** make sure **Local folder to sync** is empty (whole vault). They are not synced when you sync only one local folder. |
| **Files are deleted unexpectedly** | Check **Sync mode** and **Delete extra files in Mirror mode**. In Mirror modes, destination files not on the source are deleted by design. |
| **Password is not accepted** | Re-enter the password in Settings. If needed, click **Clear saved password** and enter it again. |
| **Server list looks wrong / empty** | Click **Test Connection**. It logs how many items are in the remote folder. Check that **Destination folder** is correct. |
| **Sync is running but seems stuck** | Wait for KeepAlive / timeout handling. You can stop it with **Stop Sync** and run it again; it will continue with the remaining files. |

## What Is Stored Where

- **In `data.json` (inside `.obsidian/plugins/ftp-sync/`):**
  - Settings (host, port, username, paths, modes, timeouts, toggles).
  - Encrypted password only (`SAFE:...` or `AES:...`). Never plain text.
  - Sync memory (`syncState`): per-file last synced size and time.
  - Last sync time.
  - Last 300 log lines.
- **In Obsidian `localStorage`:**
  - AES key, only when `safeStorage` is not available and AES fallback is used. The password itself is not stored there.
- **In memory (RAM) only:**
  - Plain-text password, while Obsidian is running.

## Uninstall

1. Turn off auto-sync and sync on startup.
2. Disable the plugin in `Settings → Community plugins`.
3. Delete the folder `Vault/.obsidian/plugins/ftp-sync/` if you want to remove settings, sync memory, and logs too.

---

## Author

**Mohammad Amir Nazarpour**

Plugin ID: `ftp-sync`

</div>

---

<a id="فارسی"></a>

<div dir="rtl" lang="fa">

# فارسی

## نمای کلی

**FTP Sync / Backup** والت آبسیدین شما را با یک سرور FTP پشتیبان‌گیری و همگام‌سازی می‌کند.

این افزونه **فقط یادداشت‌ها را سینک نمی‌کند**، بلکه همه فایل‌های والت را سینک می‌کند: فایل‌های مارک‌داون، عکس‌ها، PDF، صدا، پیوست‌ها و هر فایل دیگری که در والت باشد. ساختار پوشه‌ها حفظ می‌شود، از جمله پوشه‌های خالی.

این افزونه **فقط روی آبسیدین دسکتاپ** کار می‌کند. روی موبایل کار نمی‌کند.

## قابلیت‌ها

### سینک

- **سه حالت سینک:** میرور آپلود، دوطرفه، میرور دانلود.
- **فقط فایل‌های تغییرکرده کپی می‌شوند.** اگر چیزی عوض نشده باشد، سینک سریع تمام می‌شود و می‌گوید همه فایل‌ها همگام هستند.
- **چک سریع (پیش‌فرض) و چک دقیق.** در حالت سریع فقط اسم + حجم مقایسه می‌شود، مثل `rclone`. در حالت دقیق زمان تغییر هم مقایسه می‌شود و زمان دقیق سرور با `MDTM` پرسیده می‌شود.
- **حافظه سینک (`syncState`).** برای هر فایل، آخرین وضعیت سینک‌شده (حجم و زمان محلی و سرور) در `data.json` ذخیره می‌شود. اگر هیچ‌کدام از دو طرف از آخرین سینک عوض نشده باشند، فایل رد می‌شود، حتی اگر زمان محلی و سرور با هم فرق داشته باشند.
- **پوشه‌های خالی سینک می‌شوند.** پوشه‌های خالی در مقصد ساخته می‌شوند و گم نمی‌شوند.
- **سینک یک پوشه، نه فقط کل والت.** می‌توانید فقط یک پوشه محلی را سینک کنید، مثلاً `Notes/Work`.
- **پوشه مقصد روی سرور خودکار ساخته می‌شود.** اگر پوشه مقصد روی سرور نباشد، ساخته می‌شود، از جمله پوشه‌های تودرتو.

### اتصال و پروتکل‌ها

- **FTP، ‏FTPS Explicit و FTPS Implicit.**
- **حالت Passive (`PASV`)** و **انتقال باینری (`TYPE I`)**.
- **محافظت از داده در FTPS** با `PBSZ 0` و `PROT P` وقتی FTPS استفاده شود.
- **تست اتصال** قبل از سینک.
- **KeepAlive، تایم‌اوت و تلاش مجدد.** افزونه مرتب `NOOP` می‌فرستد تا سینک‌های طولانی قطع نشوند، موقع تایم‌اوت / قطعی دوباره وصل می‌شود و از فایل بعدی ادامه می‌دهد.
- **خطای یک فایل کل سینک را متوقف نمی‌کند.** اگر یک فایل خطا بدهد، خطا در لاگ می‌آید و سینک با فایل بعدی ادامه پیدا می‌کند.
- **مناسب والت‌های بزرگ.** لیست فایل‌های سرور با یک درخواست `LIST -R` گرفته می‌شود وقتی سرور پشتیبانی کند، و اگر پشتیبانی نکند خودکار به روش پوشه‌به‌پوشه برمی‌گردد. فایل‌های محلی هم از لیست کش‌شده آبسیدین خوانده می‌شوند، نه اینکه برای هر فایل جداگانه از دیسک پرسیده شود.

### خودکارسازی و کنترل

- **سینک خودکار هر N دقیقه.** عدد `0` یعنی خاموش.
- **سینک هنگام باز شدن آبسیدین.**
- **سینک اکنون، تست اتصال، نمایش لاگ و توقف سینک** از داخل تنظیمات.
- **آیکون ریبون.** برای شروع سینک کلیک کنید. موقع سینک دوباره کلیک کنید تا متوقف شود.
- **دستورهای Command Palette:**
  - `FTP Sync: همگام‌سازی اکنون`
  - `FTP Sync: نمایش لاگ`
  - `FTP Sync: تست اتصال`
  - `FTP Sync: توقف سینک`
- **توقف همیشه کار می‌کند.** دکمه توقف همیشه فعال است. سینک سر فایل بعدی متوقف می‌شود و سینک بعدی فقط کار باقی‌مانده را انجام می‌دهد.
- **نوار وضعیت.** حین سینک درصد پیشرفت را نشان می‌دهد، مثلاً `FTP • 45% (9/20)`. وقتی سینک نیست، زمان آخرین سینک را نشان می‌دهد، مثلاً `FTP • آخرین سینک: ...` یا `FTP • هرگز سینک نشده`.

### لاگ

- **لاگ زنده در تنظیمات.** خط‌های جدید لاگ حین سینک همان لحظه در تنظیمات می‌آیند. دکمه به‌روزرسانی لازم نیست.
- **پنجره لاگ.** دکمه «نمایش لاگ» لاگ کامل را در یک پنجره باز می‌کند.
- **لاگ ماندگار.** آخرین **۳۰۰** خط لاگ در `data.json` ذخیره می‌شود و با بستن آبسیدین پاک نمی‌شود.
- **دکمه پاک کردن لاگ** در تنظیمات و در پنجره لاگ.
- **خلاصه شفاف در لاگ.** هر سینک تعداد فایل‌های محلی، فایل‌های سرور، تعداد عملیات لازم و در پایان تعداد آپلود / دانلود / حذف را در لاگ می‌نویسد.

### امنیت

- **رمز عبور هرگز در `data.json` به صورت متن ساده ذخیره نمی‌شود.**
- **اولویت ۱:** ‏`safeStorage` الکترون (Keychain سیستم‌عامل) وقتی در دسترس باشد. به صورت `SAFE:...` ذخیره می‌شود.
- **اولویت ۲:** رمزنگاری `AES-256-GCM`. کلید در `localStorage` آبسیدین است، نه در `data.json`. به صورت `AES:...` ذخیره می‌شود.
- **رمز ساده فقط در حافظه (RAM) است.**
- **رمزهای قدیمی ساده خودکار مهاجرت می‌شوند.** در اولین اجرا رمزنگاری می‌شوند و فیلد ساده پاک می‌شود.
- **فیلد رمز در تنظیمات همیشه خالی نشان داده می‌شود.** اگر رمزی ذخیره شده باشد، `•••••• (ذخیره شده)` می‌بینید. خالی گذاشتن یعنی نگه داشتن رمز قبلی. نوشتن رمز جدید یعنی جایگزینی آن.
- **دکمه پاک کردن رمز** رمز را از حافظه و تنظیمات پاک می‌کند.

### ایمنی

- **پوشه خود افزونه هرگز سینک نمی‌شود:** `.obsidian/plugins/ftp-sync` همیشه مستثناست تا سینک روی خودش لوپ نشود.
- **`.obsidian` و `.trash` پیش‌فرض خاموش‌اند** و فقط وقتی سینک می‌شوند که خودتان روشنشان کنید.
- **سینک `.obsidian` یعنی تنظیمات، تم‌ها و پلاگین‌ها هم سینک می‌شوند** (به‌جز خود این افزونه).
- **سینک `.trash` یعنی فایل‌های داخل سطل زباله آبسیدین هم سینک می‌شوند.**
- **`.obsidian` و `.trash` فقط وقتی سینک می‌شوند که کل والت سینک شود** (پوشه محلی خالی باشد). اگر فقط یک پوشه محلی را سینک کنید، این دو شامل نمی‌شوند.
- **محافظ حذف.** فایل‌هایی که با `:` تمام می‌شوند هرگز حذف نمی‌شوند، چون فایل واقعی روی ویندوز نمی‌تواند با `:` تمام شود.
- **حذف در حالت میرور اختیاری است.** بخش [حالت‌های سینک](#حالتهای-سینک) و [نکات ایمنی](#نکات-ایمنی) را ببینید.

## پیش‌نیازها

- **فقط آبسیدین دسکتاپ.** روی موبایل پشتیبانی نمی‌شود.
- آبسیدین `0.15.0` یا جدیدتر.
- یک حساب FTP / FTPS با دسترسی خواندن، نوشتن، ساخت پوشه و حذف برای پوشه مقصد.
- دسترسی شبکه به سرور FTP. FTP Passive نباید توسط فایروال بسته شده باشد.

## نصب

۱. افزونه را دانلود / از زیپ باز کنید.
۲. این پوشه را در والت بسازید:
   - `Vault/.obsidian/plugins/ftp-sync/`
۳. هر ۴ فایل را داخل آن بگذارید:
   - `manifest.json`
   - `main.js`
   - `styles.css`
   - `README.md`
۴. آبسیدین را ببندید و دوباره باز کنید.
۵. به `Settings → Community plugins` بروید و **FTP Sync / Backup** را روشن کنید.

## شروع سریع

۱. به `Settings → FTP Sync / Backup` بروید.
۲. **هاست FTP**، **پورت**، **نام کاربری** و **رمز عبور** را وارد کنید.
۳. **پروتکل** را انتخاب کنید:
   - `FTP` برای FTP ساده.
   - `FTPS Explicit` اگر سرورتان FTPS دارد (وقتی در دسترس است، پیشنهادی است).
   - `FTPS Implicit` برای پورت `990`.
۴. **پوشه مقصد در سرور FTP** را تنظیم کنید، مثلاً `/obsidian-backup`.
۵. **پوشه محلی برای سینک** را خالی بگذارید تا کل والت سینک شود.
۶. **حالت سینک** را انتخاب کنید. برای یک بک‌آپ ساده، **میرور آپلود** را انتخاب کنید.
۷. **تست اتصال** را بزنید.
۸. **سینک اکنون** را بزنید.

## حالت‌های سینک

| حالت | جهت | چه اتفاقی می‌افتد | حذف |
| --- | --- | --- | --- |
| **میرور آپلود** | محلی ← سرور | والت مبدأ است. فایل‌های جدید و تغییرکرده محلی آپلود می‌شوند. | اگر **حذف فایل‌های اضافی در حالت میرور** روشن باشد، فایل‌های روی سرور که در والت نیستند حذف می‌شوند. پوشه‌های اضافی سرور هم از عمیق‌ترین به سطحی حذف می‌شوند. |
| **دوطرفه** | هر دو طرف | فایل‌های جدید به طرف دیگر کپی می‌شوند. برای فایل‌هایی که در هر دو طرف هستند، **جدیدترین فایل برنده است**. محتوای یادداشت با هم ترکیب (merge) نمی‌شود. | **هرگز حذف نمی‌کند.** فایلی که در یک طرف حذف شده باشد، در حالت دوطرفه از طرف دیگر حذف نمی‌شود. |
| **میرور دانلود** | سرور ← محلی | سرور مبدأ است. فایل‌های جدید و تغییرکرده سرور دانلود می‌شوند. | اگر **حذف فایل‌های اضافی در حالت میرور** روشن باشد، فایل‌های محلی که روی سرور نیستند حذف می‌شوند. پوشه‌های اضافی محلی هم از عمیق‌ترین به سطحی حذف می‌شوند. |

### در حالت دوطرفه برنده چطور مشخص می‌شود

- اگر فایل فقط در یک طرف باشد، به طرف دیگر کپی می‌شود.
- اگر در هر دو طرف باشد و حجم‌ها فرق داشته باشند، افزونه با زمان تغییر و حافظه سینک تصمیم می‌گیرد کدام طرف عوض شده است.
- اگر در هر دو طرف باشد و حجم‌ها برابر باشند، در حالت **سریع** همان فایل حساب می‌شود و رد می‌شود، مگر اینکه حافظه سینک نشان بدهد فقط یک طرف عوض شده است.
- اگر هر دو طرف عوض شده باشند، جدیدترین فایل برنده می‌شود و روی طرف دیگر نوشته می‌شود. ترکیب محتوا و فایل تعارض (conflict) وجود ندارد. پس قبل از اینکه یک یادداشت را در هر دو طرف ویرایش کنید، به این نکته توجه کنید.

## نحوه تشخیص تغییرات

۱. **جمع‌آوری فایل‌های محلی.** فایل‌ها و پوشه‌های محلی از لیست کش‌شده آبسیدین خوانده می‌شوند. `.obsidian` و `.trash` وقتی تیکشان روشن باشد، جداگانه با adapter والت خوانده می‌شوند.
۲. **جمع‌آوری فایل‌های سرور.** اول `LIST -R` امتحان می‌شود (کل درخت در یک درخواست). اگر سرور پشتیبانی نکند، به روش پوشه‌به‌پوشه برمی‌گردد. لیست ریشه هم جداگانه گرفته و ترکیب می‌شود تا فایل‌ها و پوشه‌های ریشه هیچ‌وقت گم نشوند.
۳. **مقایسه.** برای هر فایل:
   - اگر فقط در یک طرف باشد ← کپی می‌شود.
   - اگر حجم‌ها فرق داشته باشند ← طرف جدیدتر / مبدأ کپی می‌شود.
   - اگر حجم‌ها برابر باشند و از آخرین سینک چیزی عوض نشده باشد ← رد می‌شود.
   - در حالت **سریع**، اسم برابر + حجم برابر یعنی رد شدن، بدون درخواست `MDTM` برای هر فایل.
   - در حالت **دقیق**، زمان تغییر هم مقایسه می‌شود و وقتی زمان‌ها نزدیک باشند، `MDTM` دقیق از سرور گرفته می‌شود.
۴. **اجرا به ترتیب.** اول پوشه‌های جاافتاده ساخته می‌شوند، بعد آپلود / دانلود فایل‌ها، بعد حذف فایل‌های اضافی، بعد حذف پوشه‌های اضافی.
۵. **به‌روزرسانی حافظه سینک.** بعد از هر آپلود / دانلود موفق، حافظه سینک آن فایل به‌روز می‌شود.
۶. **حفظ زمان تا جایی که ممکن است.** بعد از آپلود، افزونه سعی می‌کند زمان سرور را با `MDTM` تنظیم کند. بعد از دانلود، زمان فایل محلی را روی زمان سرور می‌گذارد.

### چک سریع در برابر چک دقیق

| حالت چک | چه چیزی مقایسه می‌شود | سرعت | بهترین برای |
| --- | --- | --- | --- |
| **سریع — اسم + حجم (مثل rclone)** | اسم فایل + حجم فایل | خیلی سریع. بدون `MDTM` برای هر فایل. چک یک والت بزرگ در چند ثانیه. | استفاده عادی، والت‌های بزرگ. |
| **دقیق — حجم + زمان + MDTM** | حجم + زمان تغییر + `MDTM` دقیق سرور | کندتر. | وقتی فایلی را بدون تغییر حجم ویرایش می‌کنید و می‌خواهید آن ویرایش فهمیده شود. |

پیش‌فرض **سریع** است.

### تلرانس زمان

- تلرانس زمان محلی: **۲ ثانیه**.
- زمان سرور در `LIST` دقت دقیقه دارد، پس تلرانس زمان سرور **۱۲۰ ثانیه** است.
- وقتی زمان‌ها نزدیک باشند، افزونه قبل از تصمیم‌گیری `MDTM` دقیق را از سرور می‌گیرد.

## مرجع تنظیمات

| تنظیم | پیش‌فرض | توضیح |
| --- | --- | --- |
| **هاست FTP** | _(خالی)_ | مثال: `ftp.example.com` یا IP سرور. |
| **پورت** | `21` | پیش‌فرض FTP: `21`. ‏FTPS Implicit: ‏`990`. |
| **نام کاربری** | _(خالی)_ | نام کاربری FTP. |
| **رمز عبور** | _(خالی)_ | فقط رمزنگاری‌شده ذخیره می‌شود. وقتی رمزی ذخیره شده باشد، فیلد `•••••• (ذخیره شده)` را نشان می‌دهد. خالی گذاشتن یعنی نگه داشتن رمز قبلی. |
| **پاک کردن رمز ذخیره‌شده** | — | دکمه. رمز را از حافظه و تنظیمات پاک می‌کند. |
| **پروتکل** | `FTP` | ‏`FTP` (بدون رمزنگاری) / ‏`FTPS Explicit` (پیشنهادی) / ‏`FTPS Implicit` (پورت 990). |
| **پوشه مقصد در سرور FTP** | `/obsidian-backup` | مثال: `/obsidian-backup`. اگر نباشد خودکار ساخته می‌شود. |
| **پوشه محلی برای سینک** | _(خالی)_ | خالی = کل والت. مثال: `Notes/Work`. |
| **حالت سینک** | `میرور آپلود` | میرور آپلود / دوطرفه / میرور دانلود. |
| **سرعت چک اولیه** | `سریع` | سریع (اسم + حجم) / دقیق (حجم + زمان + MDTM). |
| **حذف فایل‌های اضافی در حالت میرور** | `روشن` | در حالت‌های میرور، فایل‌های مقصد که در مبدأ نیستند حذف شوند. |
| **سینک پوشه `.obsidian`** | `خاموش` | روشن = تنظیمات، تم‌ها و پلاگین‌ها هم سینک می‌شوند. پوشه خود این افزونه باز هم هرگز سینک نمی‌شود. |
| **سینک پوشه `.trash`** | `خاموش` | روشن = فایل‌های داخل `.trash` هم سینک می‌شوند. |
| **تایم‌اوت هر دستور (ثانیه)** | `120` | بازه: `30` تا `600`. برای والت بزرگ یا اینترنت کند `300` بگذارید. |
| **فاصله KeepAlive (ثانیه)** | `30` | بازه: `10` تا `120`. برای زنده نگه داشتن اتصال `NOOP` می‌فرستد. |
| **تعداد تلاش مجدد در صورت قطعی** | `2` | بازه: `0` تا `5`. دوباره وصل می‌شود و از فایل بعدی ادامه می‌دهد. |
| **سینک خودکار — هر چند دقیقه؟** | `0` | `0` = خاموش. مثال: `15` یعنی هر ۱۵ دقیقه. |
| **سینک هنگام باز شدن Obsidian** | `خاموش` | کمی بعد از باز شدن آبسیدین سینک می‌کند. |
| **تست و سینک** | — | دکمه‌ها: تست اتصال / سینک اکنون / نمایش لاگ. |
| **توقف سینک** | — | دکمه. همیشه فعال است. سینک در حال انجام را متوقف می‌کند. |
| **لاگ سینک — زنده** | — | باکس لاگ زنده در تنظیمات، به‌علاوه دکمه پاک کردن لاگ و زمان آخرین سینک. |

## روش‌های اجرای سینک

- **تنظیمات:** دکمه **سینک اکنون** را بزنید.
- **آیکون ریبون:** روی آیکون تازه‌سازی در ریبون سمت چپ کلیک کنید.
- **Command Palette (`Ctrl/Cmd + P`):** دستور `FTP Sync: همگام‌سازی اکنون` را اجرا کنید.
- **سینک خودکار:** دقیقه‌های سینک خودکار را تنظیم کنید و / یا سینک هنگام باز شدن را روشن کنید.

برای توقف سینک در حال انجام:

- در تنظیمات **توقف سینک** را بزنید، یا
- دوباره روی آیکون ریبون کلیک کنید، یا
- از Command Palette دستور `FTP Sync: توقف سینک` را اجرا کنید.

## نوار وضعیت و لاگ زنده

- **حین سینک:** `FTP • 45% (9/20)`
- **در حال توقف:** `FTP • در حال توقف…`
- **بعد از سینک:** `FTP • آخرین سینک: ...`
- **هرگز سینک نشده:** `FTP • هرگز سینک نشده`
- **لاگ:** صفحه تنظیمات یک باکس لاگ زنده دارد. «نمایش لاگ» همان لاگ را در یک پنجره باز می‌کند. لاگ تعدادها، عملیات‌ها، آپلودها، دانلودها، حذف‌ها، هشدارها و خطاها را نشان می‌دهد.

## نکات ایمنی

- **حالت‌های میرور می‌توانند حذف کنند.** در میرور آپلود، فایل‌های روی سرور که در والت نیستند حذف می‌شوند. در میرور دانلود، فایل‌های محلی که روی سرور نیستند حذف می‌شوند، اگر **حذف فایل‌های اضافی در حالت میرور** روشن باشد. اگر مطمئن نیستید، آن را خاموش کنید.
- **اول روی یک پوشه کوچک تست کنید.** قبل از اولین سینک کامل، با یک پوشه محلی کوچک و یک پوشه مقصد تستی امتحان کنید.
- **قبل از اولین میرور دانلود یک بک‌آپ جداگانه نگه دارید.** میرور دانلود فایل‌های محلی را با فایل‌های سرور بازنویسی می‌کند.
- **دوطرفه ترکیب نمی‌کند.** اگر یک فایل در هر دو طرف عوض شده باشد، نسخه جدیدتر روی دیگری نوشته می‌شود. نسخه ترکیبی وجود ندارد.
- **FTP ساده رمزنگاری نمی‌شود.** در FTP ساده، رمز و داده بدون رمزنگاری فرستاده می‌شوند. وقتی سرورتان پشتیبانی می‌کند، از FTPS استفاده کنید.
- **این افزونه ابزار سینک است، نه تاریخچه نسخه.** نسخه‌های قدیمی فایل‌ها را نگه نمی‌دارد. برای تاریخچه نسخه، یک بک‌آپ جداگانه داشته باشید.
- **سینک `.obsidian` قدرتمند است.** تنظیمات و پلاگین‌ها را سینک می‌کند. فقط وقتی روشنش کنید که می‌خواهید تنظیمات آبسیدینتان هم روی سرور باشد.

## رفع اشکال

| مشکل | چه کار کنیم |
| --- | --- |
| **تست اتصال ناموفق است** | هاست، پورت، نام کاربری، رمز و پروتکل را چک کنید. اگر FTPS انتخاب کردید، مطمئن شوید سرور واقعاً FTPS دارد. فایروال / ‏FTP Passive را چک کنید. |
| **سینک روی والت بزرگ تایم‌اوت می‌خورد** | **تایم‌اوت** را `300` بگذارید، **KeepAlive** را روی `30` نگه دارید و از حالت **سریع** استفاده کنید. |
| **فایل‌های تکراری دوباره کپی می‌شوند** | برای استفاده عادی از حالت **سریع** استفاده کنید. در حالت **دقیق** توجه کنید بعضی سرورها `MDTM` را برای تنظیم زمان فایل قبول نمی‌کنند، پس زمان سرور ممکن است با زمان محلی فرق داشته باشد. حافظه سینک در بیشتر حالت‌ها این را مدیریت می‌کند. |
| **`.obsidian` / `.trash` سینک نمی‌شوند** | تیکشان را روشن کنید **و** مطمئن شوید **پوشه محلی برای سینک** خالی است (کل والت). وقتی فقط یک پوشه محلی را سینک می‌کنید، این دو سینک نمی‌شوند. |
| **فایل‌ها بی‌خبر حذف شدند** | **حالت سینک** و **حذف فایل‌های اضافی در حالت میرور** را چک کنید. در حالت‌های میرور، فایل‌های مقصد که در مبدأ نیستند به‌صورت طراحی‌شده حذف می‌شوند. |
| **رمز قبول نمی‌شود** | رمز را در تنظیمات دوباره وارد کنید. اگر لازم شد، **پاک کردن رمز** را بزنید و دوباره وارد کنید. |
| **لیست سرور خالی / اشتباه به نظر می‌رسد** | **تست اتصال** را بزنید. در لاگ می‌نویسد پوشه مقصد چند مورد دارد. چک کنید **پوشه مقصد** درست باشد. |
| **سینک در حال انجام است ولی انگار گیر کرده** | صبر کنید تا KeepAlive / تایم‌اوت مدیریت شود. می‌توانید با **توقف سینک** متوقفش کنید و دوباره اجرا کنید؛ با فایل‌های باقی‌مانده ادامه می‌دهد. |

## چه چیزی کجا ذخیره می‌شود

- **در `data.json` (داخل `.obsidian/plugins/ftp-sync/`):**
  - تنظیمات (هاست، پورت، نام کاربری، مسیرها، حالت‌ها، تایم‌اوت‌ها، تیک‌ها).
  - فقط رمز رمزنگاری‌شده (`SAFE:...` یا `AES:...`). هرگز متن ساده.
  - حافظه سینک (`syncState`): حجم و زمان آخرین سینک هر فایل.
  - زمان آخرین سینک.
  - آخرین ۳۰۰ خط لاگ.
- **در `localStorage` آبسیدین:**
  - کلید AES، فقط وقتی `safeStorage` در دسترس نباشد و از روش جایگزین AES استفاده شود. خود رمز آنجا ذخیره نمی‌شود.
- **فقط در حافظه (RAM):**
  - رمز ساده، تا وقتی آبسیدین باز است.

## حذف افزونه

۱. سینک خودکار و سینک هنگام باز شدن را خاموش کنید.
۲. افزونه را در `Settings → Community plugins` خاموش کنید.
۳. اگر می‌خواهید تنظیمات، حافظه سینک و لاگ‌ها هم پاک شوند، پوشه `Vault/.obsidian/plugins/ftp-sync/` را حذف کنید.

---

## سازنده

**Mohammad Amir Nazarpour**

شناسه افزونه: `ftp-sync`

</div>
