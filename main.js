/* FTP Sync / Backup for Obsidian - v1.4.0
 * Multi-language support (Persian & English)
 */

const { Plugin, PluginSettingTab, Setting, Notice, Modal } = require('obsidian');

let _net = null, _tls = null, _fs = null, _path = null, _crypto = null;
try { _net = require('net'); } catch (e) {}
try { _tls = require('tls'); } catch (e) {}
try { _fs = require('fs'); } catch (e) {}
try { _path = require('path'); } catch (e) {}
try { _crypto = require('crypto'); } catch (e) {}

// ---------- دیکشنری دوزبانه (i18n) ----------
const TRANSLATIONS = {
  fa: {
    ribbonTitle: 'FTP Sync — همگام‌سازی (کلیک دوباره = توقف)',
    cmdSyncNow: 'FTP Sync: همگام‌سازی اکنون',
    cmdShowLog: 'FTP Sync: نمایش لاگ',
    cmdTestConn: 'FTP Sync: تست اتصال',
    cmdStopSync: 'FTP Sync: توقف سینک',
    noticeNoSyncRunning: 'سینکی در حال انجام نیست.',
    noticeStoppingSync: 'در حال توقف سینک…',
    noticeSyncStopped: 'سینک متوقف شد ⏹️',
    noticeEnterHostUser: 'ابتدا هاست و نام کاربری را وارد کنید.',
    noticeNoPassword: 'رمز عبور ذخیره نشده است. در تنظیمات رمز را وارد کنید.',
    noticeTestingConn: 'در حال تست اتصال FTP…',
    noticeConnSuccess: (root, count) => `اتصال موفق ✅ پوشه ${root}: ${count} مورد`,
    noticeConnFailed: (err) => `تست اتصال ناموفق: ${err}`,
    noticeSyncRunningWait: 'سینک در حال انجام است… برای توقف از تنظیمات یا ریبون استفاده کنید.',
    noticeIncompleteSettings: 'تنظیمات FTP کامل نیست.',
    noticePasswordCleared: 'رمز عبور پاک شد.',
    noticeSyncComplete: (up, down, del) => `FTP Sync کامل شد ✅ آپلود: ${up} دانلود: ${down} حذف: ${del}`,
    noticeSyncError: (err) => `خطای FTP Sync: ${err}`,
    statusStopping: 'FTP • در حال توقف…',
    statusSyncingPct: (pct, done, total) => `FTP • ${pct}% (${done}/${total})`,
    statusSyncing: 'FTP • در حال سینک…',
    statusLastSync: (dateStr) => `FTP • آخرین سینک: ${dateStr}`,
    statusNeverSynced: 'FTP • هرگز سینک نشده',
    modalLogTitle: 'لاگ FTP Sync',
    modalNoLogs: 'لاگی وجود ندارد.',
    modalClearLog: 'پاک کردن لاگ',
    modalLogCleared: 'لاگ پاک شد.',
    modalClose: 'بستن',
    settingsTitle: 'FTP Sync / Backup — تنظیمات',
    settingsDesc: 'فقط روی Obsidian دسکتاپ کار می‌کند. پسورد به صورت رمزنگاری‌شده ذخیره می‌شود و در فایل data.json قابل خواندن نیست.',
    langName: 'زبان / Language',
    langDesc: 'زبان رابط کاربری و تنظیمات را انتخاب کنید / Choose interface language',
    hostName: 'هاست FTP',
    hostDesc: 'مثال: ftp.example.com یا IP سرور',
    portName: 'پورت',
    portDesc: 'پیش‌فرض FTP: 21 ، FTPS Implicit: 990',
    userName: 'نام کاربری',
    passName: 'رمز عبور',
    passDescSaved: 'رمز عبور ذخیره شده و رمزنگاری‌شده است (در data.json قابل خواندن نیست). برای تغییر، رمز جدید را بنویسید. خالی گذاشتن یعنی نگه داشتن رمز قبلی.',
    passDescNotSaved: 'رمز عبور را وارد کنید — به صورت رمزنگاری‌شده ذخیره می‌شود و در data.json قابل خواندن نیست.',
    passPlaceholderSaved: '•••••• (ذخیره شده)',
    passPlaceholderEmpty: 'رمز عبور',
    clearPassName: 'پاک کردن رمز ذخیره‌شده',
    clearPassDesc: 'رمز عبور را از حافظه و فایل تنظیمات پاک می‌کند.',
    clearPassBtn: 'پاک کردن رمز',
    protoName: 'پروتکل',
    protoDesc: 'اگر سرورتان FTPS پشتیبانی می‌کند، Explicit را انتخاب کنید.',
    protoOptFtp: 'FTP (بدون رمزنگاری)',
    protoOptExplicit: 'FTPS Explicit (پیشنهادی)',
    protoOptImplicit: 'FTPS Implicit (پورت 990)',
    remotePathName: 'پوشه مقصد در سرور FTP',
    remotePathDesc: 'مثال: /obsidian-backup — اگر وجود نداشته باشد ساخته می‌شود.',
    localFolderName: 'پوشه محلی برای سینک',
    localFolderDesc: 'خالی = کل والت. مثال: Notes/Work',
    localFolderPlaceholder: 'خالی = کل والت',
    syncModeName: 'حالت سینک',
    syncModeDesc: 'میرور آپلود: والت → سرور. دوطرفه: جدیدترین برنده است. میرور دانلود: سرور → والت.',
    syncModeUpload: 'میرور آپلود — بک‌آپ به سرور (محلی → سرور)',
    syncModeTwoWay: 'دوطرفه — جدیدترین فایل برنده است',
    syncModeDownload: 'میرور دانلود — از سرور به والت (سرور → محلی)',
    checkSpeedName: 'سرعت چک اولیه',
    checkSpeedDesc: 'سریع (پیش‌فرض، مثل rclone): فقط اسم + حجم چک می‌شود، بدون MDTM برای هر فایل — چک اولیه 1340 فایل در چند ثانیه. دقیق: سایز + زمان تغییر + MDTM — کندتر ولی اگر فایلی را بدون تغییر سایز ویرایش کنی هم می‌فهمد.',
    checkSpeedFast: 'سریع — اسم + حجم (مثل rclone)',
    checkSpeedPrecise: 'دقیق — سایز + زمان + MDTM',
    delOrphanName: 'حذف فایل‌های اضافی در حالت میرور',
    delOrphanDesc: 'اگر روشن باشد، در حالت میرور فایل‌هایی که در طرف مبدأ نیستند از طرف مقصد حذف می‌شوند.',
    secSysFolders: 'پوشه‌های سیستمی — انتخابی',
    syncObsidianName: 'سینک پوشه .obsidian',
    syncObsidianDesc: 'خاموش = پیش‌فرض، .obsidian سینک نمی‌شود. روشن = تنظیمات و تم و پلاگین‌ها هم سینک می‌شوند. پوشه خود این افزونه هرگز سینک نمی‌شود تا لوپ نشود.',
    syncTrashName: 'سینک پوشه .trash',
    syncTrashDesc: 'خاموش = پیش‌فرض. روشن = فایل‌های داخل .trash هم سینک می‌شوند.',
    secConnStability: 'پایداری اتصال — رفع تایم‌اوت',
    timeoutName: 'تایم‌اوت هر دستور (ثانیه)',
    timeoutDesc: 'پیش‌فرض 120. اگر والت بزرگ است یا اینترنت کند است، بگذارید 300.',
    keepAliveName: 'فاصله KeepAlive (ثانیه)',
    keepAliveDesc: 'هر چند ثانیه NOOP بفرستد تا اتصال قطع نشود. پیش‌فرض 30.',
    retriesName: 'تعداد تلاش مجدد در صورت قطعی',
    retriesDesc: 'اگر وسط سینک قطع شود، چند بار وصل شود و از همان فایل ادامه دهد. پیش‌فرض 2.',
    autoSyncName: 'سینک خودکار — هر چند دقیقه؟',
    autoSyncDesc: '0 = خاموش. مثال: 15 یعنی هر 15 دقیقه.',
    autoSyncStartupName: 'سینک هنگام باز شدن Obsidian',
    testAndSyncName: 'تست و سینک',
    testAndSyncDesc: 'ابتدا تست اتصال را بزنید، بعد سینک کنید.',
    btnTestConn: 'تست اتصال',
    btnSyncNow: 'سینک اکنون',
    btnShowLog: 'نمایش لاگ',
    stopSyncName: 'توقف سینک',
    stopSyncDescRunning: 'سینک در حال انجام است — برای توقف کلیک کنید.',
    stopSyncDescIdle: 'اگر سینکی در حال انجام باشد، با این دکمه متوقفش کنید. نیازی به رفرش تنظیمات نیست.',
    btnStopSync: '⏹️ توقف سینک',
    secLiveLog: 'لاگ سینک — زنده',
    liveLogNote: 'لاگ به صورت زنده سینک می‌شود، نیازی به دکمه به‌روزرسانی نیست. حین سینک همینجا خط‌به‌خط می‌آید.',
    noLogsYet: 'هنوز لاگی وجود ندارد.',
    btnClearLog: 'پاک کردن لاگ',
    lastSyncText: (dateStr) => `آخرین سینک: ${dateStr}`,
    neverSyncedText: 'هنوز سینکی انجام نشده است.',
    bottomNote: 'نکته: نوار وضعیت پایین راست همیشه آخرین سینک را نشان می‌دهد و حین سینک درصد پیشرفت را نمایش می‌دهد.'
  },
  en: {
    ribbonTitle: 'FTP Sync — Synchronize (Click again to Stop)',
    cmdSyncNow: 'FTP Sync: Sync now',
    cmdShowLog: 'FTP Sync: Show log',
    cmdTestConn: 'FTP Sync: Test connection',
    cmdStopSync: 'FTP Sync: Stop sync',
    noticeNoSyncRunning: 'No sync in progress.',
    noticeStoppingSync: 'Stopping sync…',
    noticeSyncStopped: 'Sync stopped ⏹️',
    noticeEnterHostUser: 'Please enter FTP host and username first.',
    noticeNoPassword: 'Password not set. Enter password in settings.',
    noticeTestingConn: 'Testing FTP connection…',
    noticeConnSuccess: (root, count) => `Connected successfully ✅ Folder ${root}: ${count} items`,
    noticeConnFailed: (err) => `Connection failed: ${err}`,
    noticeSyncRunningWait: 'Sync already in progress… Click Ribbon or Settings button to stop.',
    noticeIncompleteSettings: 'FTP settings are incomplete.',
    noticePasswordCleared: 'Password cleared.',
    noticeSyncComplete: (up, down, del) => `FTP Sync completed ✅ Uploaded: ${up} Downloaded: ${down} Deleted: ${del}`,
    noticeSyncError: (err) => `FTP Sync error: ${err}`,
    statusStopping: 'FTP • Stopping…',
    statusSyncingPct: (pct, done, total) => `FTP • ${pct}% (${done}/${total})`,
    statusSyncing: 'FTP • Syncing…',
    statusLastSync: (dateStr) => `FTP • Last sync: ${dateStr}`,
    statusNeverSynced: 'FTP • Never synced',
    modalLogTitle: 'FTP Sync Log',
    modalNoLogs: 'No logs available.',
    modalClearLog: 'Clear Log',
    modalLogCleared: 'Log cleared.',
    modalClose: 'Close',
    settingsTitle: 'FTP Sync / Backup — Settings',
    settingsDesc: 'Works on Obsidian Desktop only. Password is encrypted and never stored in plain text in data.json.',
    langName: 'Language / زبان',
    langDesc: 'Choose interface language / زبان رابط کاربری را انتخاب کنید',
    hostName: 'FTP Host',
    hostDesc: 'e.g. ftp.example.com or server IP',
    portName: 'Port',
    portDesc: 'Default FTP: 21, FTPS Implicit: 990',
    userName: 'Username',
    passName: 'Password',
    passDescSaved: 'Password is saved and encrypted (unreadable in data.json). Enter new password to change. Leave empty to keep current.',
    passDescNotSaved: 'Enter password — it will be encrypted and will not appear in plain text.',
    passPlaceholderSaved: '•••••• (saved)',
    passPlaceholderEmpty: 'Password',
    clearPassName: 'Clear Saved Password',
    clearPassDesc: 'Removes the saved password from memory and settings file.',
    clearPassBtn: 'Clear Password',
    protoName: 'Protocol',
    protoDesc: 'Choose Explicit FTPS if your server supports TLS encryption.',
    protoOptFtp: 'FTP (Plain / Insecure)',
    protoOptExplicit: 'FTPS Explicit (Recommended)',
    protoOptImplicit: 'FTPS Implicit (Port 990)',
    remotePathName: 'Remote Directory on FTP',
    remotePathDesc: 'e.g. /obsidian-backup — will be created if not exists.',
    localFolderName: 'Local Folder to Sync',
    localFolderDesc: 'Empty = entire vault. e.g. Notes/Work',
    localFolderPlaceholder: 'Empty = whole vault',
    syncModeName: 'Sync Mode',
    syncModeDesc: 'Mirror Upload: Vault → Server. Two-way: newest wins. Mirror Download: Server → Vault.',
    syncModeUpload: 'Mirror Upload — Backup to server (Local → Remote)',
    syncModeTwoWay: 'Two-Way — Newest file wins',
    syncModeDownload: 'Mirror Download — From server to vault (Remote → Local)',
    checkSpeedName: 'Initial Check Speed',
    checkSpeedDesc: 'Fast (Default, rclone style): checks name + size only without per-file MDTM. Precise: size + mtime + MDTM — slower, but detects in-place edits.',
    checkSpeedFast: 'Fast — Name + Size (rclone-style)',
    checkSpeedPrecise: 'Precise — Size + Timestamp + MDTM',
    delOrphanName: 'Delete Orphan Files in Mirror Mode',
    delOrphanDesc: 'If enabled, files deleted from source are also deleted from target in mirror mode.',
    secSysFolders: 'System Folders — Optional',
    syncObsidianName: 'Sync .obsidian Folder',
    syncObsidianDesc: 'Disabled by default. When enabled, settings, themes, and plugins sync too. The ftp-sync plugin directory is excluded to avoid loops.',
    syncTrashName: 'Sync .trash Folder',
    syncTrashDesc: 'Disabled by default. When enabled, files inside .trash are also synced.',
    secConnStability: 'Connection Stability — Prevent Timeouts',
    timeoutName: 'Command Timeout (seconds)',
    timeoutDesc: 'Default 120. If vault is huge or network is slow, increase to 300.',
    keepAliveName: 'KeepAlive Interval (seconds)',
    keepAliveDesc: 'Seconds between NOOP signals to prevent idle timeouts. Default 30.',
    retriesName: 'Max Reconnect Retries',
    retriesDesc: 'Retry count when connection drops mid-sync. Continues where it left off. Default 2.',
    autoSyncName: 'Auto Sync Interval (minutes)',
    autoSyncDesc: '0 = Disabled. e.g. 15 = syncs every 15 minutes.',
    autoSyncStartupName: 'Sync on Obsidian Startup',
    testAndSyncName: 'Test & Sync',
    testAndSyncDesc: 'Test connection first, then start sync.',
    btnTestConn: 'Test Connection',
    btnSyncNow: 'Sync Now',
    btnShowLog: 'Show Log',
    stopSyncName: 'Stop Sync',
    stopSyncDescRunning: 'Sync in progress — click to stop.',
    stopSyncDescIdle: 'Stop current sync process at any time without refreshing settings.',
    btnStopSync: '⏹️ Stop Sync',
    secLiveLog: 'Sync Log — Live',
    liveLogNote: 'Logs are streamed live. No refresh button needed.',
    noLogsYet: 'No logs yet.',
    btnClearLog: 'Clear Log',
    lastSyncText: (dateStr) => `Last sync: ${dateStr}`,
    neverSyncedText: 'Never synced yet.',
    bottomNote: 'Note: Status bar shows progress during sync and last sync time when idle.'
  }
};

// ---------- رمزنگاری پسورد (v1.3.3) ----------
function getSafeStorage() {
  try { const el = require('electron'); if (el && el.safeStorage) return el.safeStorage; } catch (e) {}
  try { if (typeof window !== 'undefined' && window.require) { const el2 = window.require('electron'); if (el2 && el2.safeStorage) return el2.safeStorage; } } catch (e) {}
  try { if (typeof window !== 'undefined' && window.electron && window.electron.safeStorage) return window.electron.safeStorage; } catch (e) {}
  return null;
}
function getAesKey() {
  try {
    if (typeof localStorage === 'undefined') return null;
    let b64 = localStorage.getItem('ftp-sync-aes-key');
    if (b64) return Buffer.from(b64, 'base64');
    if (!_crypto) return null;
    const key = _crypto.randomBytes(32);
    try { localStorage.setItem('ftp-sync-aes-key', key.toString('base64')); } catch (e) {}
    return key;
  } catch (e) { return null; }
}
function encryptPassword(plain) {
  if (!plain) return '';
  try {
    const ss = getSafeStorage();
    if (ss && typeof ss.encryptString === 'function') {
      try { if (typeof ss.isEncryptionAvailable === 'function' && !ss.isEncryptionAvailable()) throw new Error('safeStorage unavailable'); } catch (e) {}
      const buf = ss.encryptString(plain);
      return 'SAFE:' + Buffer.from(buf).toString('base64');
    }
  } catch (e) {}
  try {
    if (!_crypto) return '';
    const key = getAesKey(); if (!key) return '';
    const iv = _crypto.randomBytes(12);
    const cipher = _crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'AES:' + iv.toString('base64') + ':' + enc.toString('base64') + ':' + tag.toString('base64');
  } catch (e) { return ''; }
}
function decryptPassword(encStr) {
  if (!encStr) return '';
  try {
    if (encStr.startsWith('SAFE:')) {
      const ss = getSafeStorage(); if (!ss || typeof ss.decryptString !== 'function') return '';
      const buf = Buffer.from(encStr.slice(5), 'base64');
      return ss.decryptString(buf) || '';
    }
    if (encStr.startsWith('AES:')) {
      if (!_crypto) return '';
      const parts = encStr.split(':'); if (parts.length !== 4) return '';
      const key = getAesKey(); if (!key) return '';
      const iv = Buffer.from(parts[1], 'base64'); const data = Buffer.from(parts[2], 'base64'); const tag = Buffer.from(parts[3], 'base64');
      const decipher = _crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    }
    return encStr;
  } catch (e) { return ''; }
}

const DEFAULT_SETTINGS = {
  language: 'fa',
  host: '', port: 21, username: '',
  passwordEncrypted: '',
  secure: 'ftp', remotePath: '/obsidian-backup', localFolder: '',
  syncMode: 'mirror-upload', autoSyncMinutes: 0, autoSyncOnStartup: false,
  deleteOrphan: true,
  syncObsidian: false, syncTrash: false,
  timeoutSeconds: 120, keepAliveSeconds: 30, maxRetries: 2,
  checkMode: 'fast',
  syncState: {},
  lastSync: null, logs: []
};

function pad2(n) { return String(n).padStart(2, '0'); }
function formatMDTM(mtime) {
  const d = new Date(mtime);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`;
}
function parseListLine(line) {
  if (!line || !line.trim()) return null;
  if (line.startsWith('total ')) return null;
  const unix = line.match(/^([d-])[rwx-]{9}\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}|\d{4})\s+(.+)$/);
  if (unix) {
    const isDir = unix[1] === 'd';
    const size = parseInt(unix[2], 10);
    const monStr = unix[3]; const day = parseInt(unix[4], 10);
    const timeOrYear = unix[5]; const name = unix[6].trim();
    if (name === '.' || name === '..') return null;
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const mon = months[monStr] !== undefined ? months[monStr] : 0;
    const now = new Date(); let mtime;
    if (timeOrYear.includes(':')) {
      const parts = timeOrYear.split(':');
      const hh = parseInt(parts[0], 10); const mm = parseInt(parts[1], 10);
      mtime = new Date(now.getFullYear(), mon, day, hh, mm).getTime();
      if (mtime > now.getTime() + 86400000) mtime = new Date(now.getFullYear() - 1, mon, day, hh, mm).getTime();
    } else {
      mtime = new Date(parseInt(timeOrYear, 10), mon, day).getTime();
    }
    return { name, type: isDir ? 'dir' : 'file', size, mtime };
  }
  const win = line.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(AM|PM)\s+(<DIR>|\d+)\s+(.+)$/);
  if (win) {
    const mo = parseInt(win[1], 10) - 1; const d = parseInt(win[2], 10); const y = 2000 + parseInt(win[3], 10);
    let hh = parseInt(win[4], 10); const mm = parseInt(win[5], 10);
    if (win[6] === 'PM' && hh !== 12) hh += 12;
    if (win[6] === 'AM' && hh === 12) hh = 0;
    const isDir = win[7] === '<DIR>'; const size = isDir ? 0 : parseInt(win[7], 10);
    const name = win[8].trim(); if (name === '.' || name === '..') return null;
    return { name, type: isDir ? 'dir' : 'file', size, mtime: new Date(y, mo, d, hh, mm).getTime() };
  }
  return null;
}

// ---------- FTP Client ----------
class FTPClient {
  constructor(opts) {
    this.host = opts.host; this.port = opts.port || 21;
    this.user = opts.user; this.pass = opts.pass; this.secure = opts.secure || 'ftp';
    this.timeoutMs = (opts.timeoutSeconds || 120) * 1000;
    this.keepAliveMs = (opts.keepAliveSeconds || 30) * 1000;
    this.maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
    this.socket = null; this.buffer = ''; this.waiters = []; this.pendingLines = []; this.lastCommandAt = 0;
  }
  _onData(data) {
    this.buffer += data.toString('utf8');
    while (true) {
      const idx = this.buffer.indexOf('\r\n'); if (idx === -1) break;
      const line = this.buffer.slice(0, idx); this.buffer = this.buffer.slice(idx + 2);
      this.pendingLines.push(line);
      const m = line.match(/^(\d{3})([ -])(.*)$/); if (!m) continue;
      const code = m[1]; const sep = m[2]; if (sep === '-') continue;
      const full = this.pendingLines.join('\n'); this.pendingLines = [];
      const waiter = this.waiters.shift(); if (waiter) waiter({ code: parseInt(code, 10), message: full });
    }
  }
  _waitResponse(timeoutMs) {
    const ms = timeoutMs || this.timeoutMs;
    return new Promise((resolve, reject) => {
      let settled = false;
      const wrapped = (v) => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); };
      const timer = setTimeout(() => {
        if (settled) return; settled = true;
        const j = this.waiters.indexOf(wrapped); if (j !== -1) this.waiters.splice(j, 1);
        reject(new Error('Timeout در انتظار پاسخ سرور FTP (' + Math.round(ms / 1000) + ' ثانیه)'));
      }, ms);
      this.waiters.push(wrapped);
    });
  }
  _waitResponse2(timeoutMs) { return this._waitResponse(timeoutMs); }
  async _send(cmd, timeoutMs) {
    if (!this.socket || this.socket.destroyed) throw new Error('اتصال برقرار نیست (سوکت قطع شده)');
    const p = this._waitResponse(timeoutMs);
    this.socket.write(cmd + '\r\n'); this.lastCommandAt = Date.now(); return p;
  }
  async noop() {
    if (this.waiters.length > 0) return;
    try { await this._send('NOOP', 15000); } catch (e) {}
  }
  async maybeKeepAlive() {
    if (!this.lastCommandAt) return;
    if (Date.now() - this.lastCommandAt > this.keepAliveMs) await this.noop();
  }
  isConnected() { return !!(this.socket && !this.socket.destroyed); }
  async withRetry(fn, label) {
    const tries = (this.maxRetries || 2) + 1; let lastErr = null;
    for (let i = 0; i < tries; i++) {
      try { await this.maybeKeepAlive(); return await fn(); }
      catch (e) {
        lastErr = e; const msg = String(e && e.message || e);
        const isTimeout = msg.includes('Timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('قطع شده') || msg.includes('EPIPE');
        if (!isTimeout || i === tries - 1) throw e;
        try { await this.reconnect(); } catch (reErr) { throw e; }
      }
    }
    throw lastErr;
  }
  async reconnect() {
    try { if (this.socket) { try { this.socket.destroy(); } catch (e) {} } } catch (e) {}
    this.socket = null; this.buffer = ''; this.waiters = []; this.pendingLines = [];
    await this.connect();
  }
  async connect() {
    if (!_net) throw new Error('ماژول net در دسترس نیست — فقط روی Obsidian دسکتاپ');
    const sock = await new Promise((resolve, reject) => {
      let s;
      try {
        if (this.secure === 'ftps-implicit') s = _tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false, servername: this.host }, () => resolve(s));
        else s = _net.connect({ host: this.host, port: this.port }, () => resolve(s));
      } catch (e) { reject(e); return; }
      try { if (s.setKeepAlive) s.setKeepAlive(true, 30000); } catch (e) {}
      try { if (s.setTimeout) s.setTimeout(0); } catch (e) {}
      s.on('error', (e) => { reject(e); });
      s.on('data', (d) => this._onData(d)); this.socket = s;
    });
    this.socket = sock;
    const greet = await this._waitResponse();
    if (greet.code !== 220 && greet.code !== 230) throw new Error('پاسخ اولیه سرور نامعتبر است: ' + greet.message);
    if (this.secure === 'ftps-explicit') {
      const auth = await this._send('AUTH TLS');
      if (auth.code !== 234) throw new Error('AUTH TLS ناموفق بود: ' + auth.message);
      await new Promise((resolve, reject) => {
        const plain = this.socket;
        try { plain.removeAllListeners('data'); } catch (e) {}
        const tlsSock = _tls.connect({ socket: plain, host: this.host, rejectUnauthorized: false, servername: this.host }, () => {
          this.socket = tlsSock;
          try { if (tlsSock.setKeepAlive) tlsSock.setKeepAlive(true, 30000); } catch (e) {}
          try { if (tlsSock.setTimeout) tlsSock.setTimeout(0); } catch (e) {}
          tlsSock.on('data', (d) => this._onData(d)); tlsSock.on('error', () => {}); resolve();
        });
        tlsSock.on('error', reject);
      });
    }
    const userRes = await this._send('USER ' + this.user);
    if (userRes.code === 331) {
      const passRes = await this._send('PASS ' + this.pass);
      if (passRes.code !== 230 && passRes.code !== 202) throw new Error('ورود ناموفق بود: ' + passRes.message);
    } else if (userRes.code !== 230 && userRes.code !== 202) throw new Error('ورود ناموفق بود: ' + userRes.message);
    await this._send('TYPE I');
    if (this.secure === 'ftps-explicit' || this.secure === 'ftps-implicit') {
      try { await this._send('PBSZ 0'); } catch (e) {}
      try { await this._send('PROT P'); } catch (e) {}
    }
  }
  async quit() {
    try { await this._send('QUIT'); } catch (e) {}
    try { if (this.socket) this.socket.end(); } catch (e) {}
    this.socket = null;
  }
  async _openDataConnection() {
    const pasv = await this._send('PASV');
    if (pasv.code !== 227) throw new Error('PASV ناموفق بود: ' + pasv.message);
    const m = pasv.message.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!m) throw new Error('پاسخ PASV قابل تجزیه نیست');
    let host = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`; const port = parseInt(m[5], 10) * 256 + parseInt(m[6], 10);
    if (host === '0.0.0.0') host = this.host;
    const dataTimeoutMs = Math.max(this.timeoutMs * 2, 120000);
    let dataSock;
    if (this.secure === 'ftps-explicit' || this.secure === 'ftps-implicit') {
      dataSock = await new Promise((resolve, reject) => {
        const s = _tls.connect({ host, port, rejectUnauthorized: false, servername: this.host }, () => resolve(s));
        s.on('error', reject); try { if (s.setTimeout) s.setTimeout(dataTimeoutMs); } catch (e) {}
      });
    } else {
      dataSock = await new Promise((resolve, reject) => {
        const s = _net.connect({ host, port }, () => resolve(s));
        s.on('error', reject); try { if (s.setTimeout) s.setTimeout(dataTimeoutMs); } catch (e) {}
      });
    }
    try { if (dataSock.setKeepAlive) dataSock.setKeepAlive(true, 30000); } catch (e) {}
    return dataSock;
  }
  _readDataSocket(sock) {
    return new Promise((resolve, reject) => {
      const chunks = []; let done = false;
      const stallMs = Math.max(this.timeoutMs * 2, 120000);
      let stallTimer = setTimeout(() => { if (!done) { done = true; try { sock.destroy(); } catch (e) {} reject(new Error('Timeout در انتقال داده FTP')); } }, stallMs);
      const resetStall = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => { if (!done) { done = true; try { sock.destroy(); } catch (e) {} reject(new Error('Timeout در انتقال داده FTP')); } }, stallMs); };
      const finish = () => { if (!done) { done = true; clearTimeout(stallTimer); resolve(Buffer.concat(chunks)); } };
      sock.on('data', (d) => { chunks.push(d); resetStall(); });
      sock.on('end', finish); sock.on('close', finish);
      sock.on('error', (e) => { if (!done) { done = true; clearTimeout(stallTimer); reject(e); } });
      sock.on('timeout', () => { if (!done) { done = true; clearTimeout(stallTimer); try { sock.destroy(); } catch (e) {} reject(new Error('Timeout در انتقال داده FTP')); } });
    });
  }
  async list(path) {
    const dataSock = await this._openDataConnection();
    const dataPromise = this._readDataSocket(dataSock);
    const res = await this._send('LIST ' + (path || ''));
    if (res.code !== 150 && res.code !== 125) { try { dataSock.destroy(); } catch (e) {} if (res.code === 550) return []; throw new Error('LIST ناموفق بود: ' + res.message); }
    const data = await dataPromise;
    try { await this._waitResponse2(Math.max(this.timeoutMs * 2, 120000)); } catch (e) {}
    const text = data.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('total '));
    const entries = []; for (const line of lines) { const e = parseListLine(line); if (e) entries.push(e); }
    return entries;
  }
  async listRecursive(root) {
    const dataSock = await this._openDataConnection();
    const dataPromise = this._readDataSocket(dataSock);
    let res;
    try { res = await this._send('LIST -R ' + (root || '')); } catch (e) { try { dataSock.destroy(); } catch (e2) {} return null; }
    if (res.code !== 150 && res.code !== 125) { try { dataSock.destroy(); } catch (e) {} return null; }
    let data; try { data = await dataPromise; } catch (e) { return null; }
    try { await this._waitResponse2(Math.max(this.timeoutMs * 2, 120000)); } catch (e) {}
    const text = data.toString('utf8');
    if (!text.includes(':')) return null;
    const lines = text.split(/\r?\n/);
    const out = [];
    const rootNorm = (root || '').replace(/\/$/, '') || '/';
    let currentDir = rootNorm;
    let sawAnyEntry = false;
    const resolveHeader = (hRaw) => {
      let h = hRaw.slice(0, -1).trim();
      if (h.startsWith('./')) h = h.slice(2);
      if (h === '' || h === '.') return rootNorm;
      if (h.startsWith('/')) return h;
      const rootBase = rootNorm === '/' ? '' : rootNorm.slice(1);
      if (rootBase && (h === rootBase || h.startsWith(rootBase + '/'))) return '/' + h;
      if (rootNorm === '/') return '/' + h;
      return rootNorm + '/' + h;
    };
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) continue;
      if (line.startsWith('total ')) continue;
      if (line.endsWith(':') && !line.startsWith('-') && !line.startsWith('d') && !line.startsWith('l') && !line.startsWith('total')) {
        currentDir = resolveHeader(line);
        continue;
      }
      const e = parseListLine(line);
      if (!e) continue;
      sawAnyEntry = true;
      let fullPath = currentDir === '/' ? '/' + e.name : currentDir + '/' + e.name;
      let rel = fullPath;
      if (rootNorm !== '/' && fullPath.startsWith(rootNorm + '/')) rel = fullPath.slice(rootNorm.length + 1);
      else if (rootNorm === '/') rel = fullPath.slice(1);
      else if (fullPath.startsWith('/')) rel = fullPath.slice(1);
      else rel = fullPath;
      if (!rel) continue;
      out.push({ rel, type: e.type, size: e.size, mtime: e.mtime });
    }
    if (!sawAnyEntry) return null;
    return out;
  }
  async download(remotePath) {
    const dataSock = await this._openDataConnection();
    const dataPromise = this._readDataSocket(dataSock);
    const res = await this._send('RETR ' + remotePath);
    if (res.code !== 150 && res.code !== 125) { try { dataSock.destroy(); } catch (e) {} throw new Error('RETR ناموفق بود: ' + res.message); }
    const data = await dataPromise;
    const fin = await this._waitResponse2(Math.max(this.timeoutMs * 2, 120000));
    if (fin.code !== 226 && fin.code !== 250) throw new Error('RETR نهایی ناموفق بود: ' + fin.message);
    return data;
  }
  async upload(remotePath, buffer, mtime) {
    const dataSock = await this._openDataConnection();
    const res = await this._send('STOR ' + remotePath);
    if (res.code !== 150 && res.code !== 125) { try { dataSock.destroy(); } catch (e) {} throw new Error('STOR ناموفق بود: ' + res.message); }
    await new Promise((resolve, reject) => {
      dataSock.on('error', reject);
      dataSock.write(buffer, (err) => { if (err) { reject(err); return; } dataSock.end(() => resolve()); });
    });
    const fin = await this._waitResponse2(Math.max(this.timeoutMs * 2, 120000));
    if (fin.code !== 226 && fin.code !== 250) throw new Error('STOR نهایی ناموفق بود: ' + fin.message);
    if (mtime) { try { await this.setMtime(remotePath, mtime); } catch (e) {} }
  }
  async setMtime(remotePath, mtime) {
    const str = formatMDTM(mtime);
    try { await this._send(`MDTM ${str} ${remotePath}`); } catch (e) {}
  }
  async getMtime(remotePath) {
    try {
      const res = await this._send(`MDTM ${remotePath}`);
      if (res.code === 213) {
        const m = res.message.match(/(\d{14})/);
        if (m) {
          const s = m[1];
          return Date.UTC(parseInt(s.slice(0, 4), 10), parseInt(s.slice(4, 6), 10) - 1, parseInt(s.slice(6, 8), 10), parseInt(s.slice(8, 10), 10), parseInt(s.slice(10, 12), 10), parseInt(s.slice(12, 14), 10));
        }
      }
    } catch (e) {}
    return null;
  }
  async mkdir(path) { try { return await this._send('MKD ' + path); } catch (e) { return null; } }
  async deleteFile(path) { try { await this._send('DELE ' + path); } catch (e) {} }
  async removeDir(path) { try { await this._send('RMD ' + path); } catch (e) {} }
}

// ---------- Plugin ----------
class FTPSyncPlugin extends Plugin {
  t(key, ...args) {
    const lang = (this.settings && this.settings.language === 'en') ? 'en' : 'fa';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.fa;
    const val = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.fa[key] !== undefined ? TRANSLATIONS.fa[key] : key);
    if (typeof val === 'function') return val(...args);
    return val;
  }
  formatDate(ts) {
    if (!ts) return '';
    const lang = (this.settings && this.settings.language === 'en') ? 'en' : 'fa';
    return new Date(ts).toLocaleString(lang === 'en' ? 'en-US' : 'fa-IR');
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});
    this._password = '';
    this.logListeners = new Set();
    try {
      if (this.settings.password) {
        this._password = String(this.settings.password);
        this.settings.passwordEncrypted = encryptPassword(this._password);
        delete this.settings.password;
        await this.saveData(this.settings);
      } else if (this.settings.passwordEncrypted) {
        this._password = decryptPassword(this.settings.passwordEncrypted) || '';
      }
    } catch (e) { this._password = ''; }
    if (this.settings.language !== 'en' && this.settings.language !== 'fa') this.settings.language = 'fa';
    if (this.settings.syncObsidian == null) this.settings.syncObsidian = false;
    if (this.settings.syncTrash == null) this.settings.syncTrash = false;
    if (this.settings.timeoutSeconds == null) this.settings.timeoutSeconds = 120;
    if (this.settings.keepAliveSeconds == null) this.settings.keepAliveSeconds = 30;
    if (this.settings.maxRetries == null) this.settings.maxRetries = 2;
    if (!this.settings.checkMode) this.settings.checkMode = 'fast';
    if (!this.settings.syncState || typeof this.settings.syncState !== 'object') this.settings.syncState = {};
    this.logs = Array.isArray(this.settings.logs) ? this.settings.logs : [];
    this.isSyncing = false; this.stopRequested = false; this.autoTimer = null;
    this.statusBar = this.addStatusBarItem(); this.updateStatusBar();
    this.addRibbonIcon('refresh-cw', this.t('ribbonTitle'), async () => {
      if (this.isSyncing) { this.requestStop(); return; }
      await this.performSync(false);
    });
    this.addCommand({ id: 'ftp-sync-now', name: this.t('cmdSyncNow'), callback: async () => { await this.performSync(false); } });
    this.addCommand({ id: 'ftp-sync-show-log', name: this.t('cmdShowLog'), callback: () => { new LogModal(this.app, this).open(); } });
    this.addCommand({ id: 'ftp-sync-test', name: this.t('cmdTestConn'), callback: async () => { await this.testConnection(); } });
    this.addCommand({ id: 'ftp-sync-stop', name: this.t('cmdStopSync'), callback: () => { this.requestStop(); } });
    this.addSettingTab(new FTPSyncSettingTab(this.app, this));
    if (this.settings.autoSyncOnStartup) setTimeout(() => { this.performSync(true); }, 3500);
    this.setupAutoSync();
  }
  onunload() { this.requestStop(); if (this.autoTimer) clearInterval(this.autoTimer); }
  requestStop() {
    if (!this.isSyncing) { new Notice(this.t('noticeNoSyncRunning')); return; }
    this.stopRequested = true;
    this.addLog(this.settings.language === 'en' ? 'Sync stop requested by user…' : 'درخواست توقف سینک توسط کاربر…', 'warn');
    new Notice(this.t('noticeStoppingSync'));
    this.updateStatusBar();
  }
  getPassword() { return this._password || ''; }
  async setPassword(plain) {
    this._password = plain || '';
    this.settings.passwordEncrypted = plain ? encryptPassword(plain) : '';
    if (this.settings.password) delete this.settings.password;
    await this.saveData(this.settings);
  }
  async clearPassword() { await this.setPassword(''); }
  onLog(cb) { this.logListeners.add(cb); return () => { this.logListeners.delete(cb); }; }
  _notifyLogListeners() {
    const text = this.logs.join('\n') || this.t('noLogsYet');
    for (const cb of [...this.logListeners]) { try { cb(text); } catch (e) {} }
  }
  setupAutoSync() {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
    const mins = Number(this.settings.autoSyncMinutes) || 0;
    if (mins > 0) {
      this.autoTimer = setInterval(() => { this.performSync(true); }, mins * 60 * 1000);
      const logTxt = this.settings.language === 'en' ? `Auto-sync enabled: every ${mins} minute(s)` : `سینک خودکار فعال شد: هر ${mins} دقیقه`;
      this.addLog(logTxt);
    }
  }
  addLog(msg, level) {
    const time = new Date(); let icon = 'ℹ️';
    if (level === 'error') icon = '❌'; if (level === 'warn') icon = '⚠️'; if (level === 'success') icon = '✅';
    const lang = (this.settings && this.settings.language === 'en') ? 'en-US' : 'fa-IR';
    const entry = `[${time.toLocaleString(lang)}] ${icon} ${msg}`;
    this.logs.push(entry); if (this.logs.length > 300) this.logs = this.logs.slice(-300);
    this.settings.logs = this.logs; this.saveData(this.settings).catch(() => {});
    this._notifyLogListeners();
  }
  updateStatusBar(done, total) {
    if (!this.statusBar) return;
    if (this.isSyncing && this.stopRequested) { this.statusBar.setText(this.t('statusStopping')); return; }
    if (this.isSyncing && typeof done === 'number' && typeof total === 'number') {
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      this.statusBar.setText(this.t('statusSyncingPct', pct, done, total));
    } else if (this.isSyncing) { this.statusBar.setText(this.t('statusSyncing')); }
    else if (this.settings.lastSync) { this.statusBar.setText(this.t('statusLastSync', this.formatDate(this.settings.lastSync))); }
    else { this.statusBar.setText(this.t('statusNeverSynced')); }
  }
  getState(rel) { return (this.settings.syncState || {})[rel] || null; }
  updateState(rel, localInfo, remoteInfo) {
    if (!this.settings.syncState) this.settings.syncState = {};
    this.settings.syncState[rel] = {
      localSize: localInfo ? localInfo.size : null, localMtime: localInfo ? localInfo.mtime : null,
      remoteSize: remoteInfo ? remoteInfo.size : null, remoteMtime: remoteInfo ? remoteInfo.mtime : null,
      at: Date.now()
    };
  }
  deleteState(rel) { if (this.settings.syncState) delete this.settings.syncState[rel]; }
  isUnchangedSinceLastSync(rel, lf, rf) {
    const st = this.getState(rel); if (!st) return false;
    if (lf && st.localSize != null && lf.size !== st.localSize) return false;
    if (rf && st.remoteSize != null && rf.size !== st.remoteSize) return false;
    if (lf && st.localMtime != null && Math.abs(lf.mtime - st.localMtime) > 2000) return false;
    if (rf && st.remoteMtime != null && Math.abs(rf.mtime - st.remoteMtime) > 120000) return false;
    return true;
  }
  joinRemote(root, rel) {
    if (!rel) return root || '/';
    if (!root || root === '/') return '/' + rel;
    const r = root.endsWith('/') ? root.slice(0, -1) : root; return r + '/' + rel;
  }
  async ensureRemotePath(client, remoteRoot) {
    if (!remoteRoot || remoteRoot === '/') return;
    const parts = remoteRoot.split('/').filter(Boolean); let cur = '';
    for (const p of parts) { cur += '/' + p; await client.mkdir(cur); }
  }
  async ensureLocalDir(dirPath) {
    if (!dirPath) return; const adapter = this.app.vault.adapter;
    try { if (!(await adapter.exists(dirPath))) await adapter.mkdir(dirPath); }
    catch (e) {
      const segs = dirPath.split('/').filter(Boolean); let cur = '';
      for (const s of segs) { cur = cur ? cur + '/' + s : s; try { if (!(await adapter.exists(cur))) await adapter.mkdir(cur); } catch (e2) {} }
    }
  }
  async ensureLocalDirParent(filePath) { const idx = filePath.lastIndexOf('/'); if (idx > 0) await this.ensureLocalDir(filePath.slice(0, idx)); }
  async setLocalMtime(localPath, mtime) {
    try { const adapter = this.app.vault.adapter; if (_fs && _path && adapter.basePath) { const full = _path.join(adapter.basePath, localPath); const d = new Date(mtime); _fs.utimesSync(full, d, d); } } catch (e) {}
  }
  isExcluded(relPath, filePath) {
    const p = (filePath || relPath || '');
    if (p === '.obsidian/plugins/ftp-sync/data.json') return true;
    if (p === '.obsidian' || p.startsWith('.obsidian/')) return !this.settings.syncObsidian;
    if (p === '.trash' || p.startsWith('.trash/')) return !this.settings.syncTrash;
    return false;
  }
  async collectSpecialFolder(root, filesMap, dirsSet) {
    const adapter = this.app.vault.adapter;
    if (this.isExcluded('', root)) return;
    dirsSet.add(root);
    const stack = [root]; const visited = new Set();
    while (stack.length) {
      if (this.stopRequested) break;
      const dir = stack.pop(); if (visited.has(dir)) continue; visited.add(dir);
      let listing; try { listing = await adapter.list(dir); } catch (e) { continue; }
      for (const f of (listing.files || [])) {
        if (this.isExcluded('', f)) continue;
        try { const st = await adapter.stat(f); filesMap.set(f, { size: st && typeof st.size === 'number' ? st.size : 0, mtime: st && st.mtime ? st.mtime : Date.now(), fullPath: f }); }
        catch (e) { filesMap.set(f, { size: 0, mtime: Date.now(), fullPath: f }); }
      }
      for (const folder of (listing.folders || [])) {
        if (this.isExcluded('', folder)) continue;
        if (!folder || folder === '/' || folder === '.') continue;
        dirsSet.add(folder); stack.push(folder);
      }
    }
  }
  async collectLocal(baseFolder, filesMap, dirsSet) {
    const base = (baseFolder || '').replace(/^\/+|\/+$/g, '');
    try {
      const all = this.app.vault.getFiles ? this.app.vault.getFiles() : null;
      if (all && Array.isArray(all)) {
        try {
          const allLoaded = this.app.vault.getAllLoadedFiles ? this.app.vault.getAllLoadedFiles() : null;
          if (allLoaded && Array.isArray(allLoaded)) {
            for (const entry of allLoaded) {
              if (this.stopRequested) break;
              const fullPath = entry.path;
              if (!fullPath) continue;
              if (base) { if (fullPath !== base && !fullPath.startsWith(base + '/')) continue; }
              if (this.isExcluded('', fullPath)) continue;
              if (entry.children !== undefined) {
                let rel; if (!base) rel = fullPath; else if (fullPath === base) continue; else rel = fullPath.slice(base.length + 1);
                if (!rel || rel === '/' || rel === '.') continue;
                if (rel) dirsSet.add(rel);
              }
            }
          }
        } catch (e2) {}
        for (const f of all) {
          if (this.stopRequested) break;
          const fullPath = f.path;
          if (base) { if (fullPath !== base && !fullPath.startsWith(base + '/')) continue; }
          if (this.isExcluded('', fullPath)) continue;
          let rel; if (!base) rel = fullPath; else if (fullPath === base) rel = fullPath; else rel = fullPath.slice(base.length + 1);
          if (!rel) continue;
          const st = f.stat || {};
          filesMap.set(rel, { size: typeof st.size === 'number' ? st.size : 0, mtime: st.mtime || Date.now(), fullPath });
          const parts = rel.split('/'); let cur = '';
          for (let i = 0; i < parts.length - 1; i++) { cur = cur ? cur + '/' + parts[i] : parts[i]; if (!cur || cur === '/' || cur === '.') continue; if (!this.isExcluded('', cur)) dirsSet.add(cur); }
        }
        if (!base && !this.stopRequested) {
          if (this.settings.syncObsidian) await this.collectSpecialFolder('.obsidian', filesMap, dirsSet);
          if (this.settings.syncTrash) await this.collectSpecialFolder('.trash', filesMap, dirsSet);
        }
        return;
      }
    } catch (e) {}
    const adapter = this.app.vault.adapter;
    const stack = [base]; const visited = new Set();
    while (stack.length) {
      if (this.stopRequested) break;
      const dir = stack.pop(); if (visited.has(dir)) continue; visited.add(dir);
      let listing; try { listing = await adapter.list(dir); } catch (e) { continue; }
      for (const f of (listing.files || [])) {
        if (this.isExcluded('', f)) continue;
        let rel; if (!base) rel = f; else if (f === base) rel = f; else if (f.startsWith(base + '/')) rel = f.slice(base.length + 1); else rel = f;
        if (!rel) continue;
        try { const st = await adapter.stat(f); filesMap.set(rel, { size: st && typeof st.size === 'number' ? st.size : 0, mtime: st && st.mtime ? st.mtime : Date.now(), fullPath: f }); }
        catch (e) { filesMap.set(rel, { size: 0, mtime: Date.now(), fullPath: f }); }
      }
      for (const folder of (listing.folders || [])) {
        if (this.isExcluded('', folder)) continue;
        let rel; if (!base) rel = folder; else if (folder.startsWith(base + '/')) rel = folder.slice(base.length + 1); else rel = folder;
        if (!rel) continue; dirsSet.add(rel); stack.push(folder);
      }
    }
  }
  async collectRemote(client, remoteRoot, baseRel, filesMap, dirsSet) {
    try {
      const rec = await client.withRetry(() => client.listRecursive(remoteRoot), 'LIST -R');
      if (rec && Array.isArray(rec)) {
        for (const e of rec) {
          if (this.stopRequested) break;
          if (this.isExcluded('', e.rel)) continue;
          if (!e.rel || e.rel === '/' || e.rel === '.') continue;
          if (e.type === 'dir') dirsSet.add(e.rel);
          else filesMap.set(e.rel, { size: e.size, mtime: e.mtime });
        }
        try {
          const rootEntries = await client.withRetry(() => client.list(remoteRoot), 'LIST root');
          for (const e of rootEntries) {
            if (!e.name || e.name === '/' || e.name === '.' || e.name === '..') continue;
            if (this.isExcluded('', e.name)) continue;
            if (e.type === 'dir') dirsSet.add(e.name);
            else if (!filesMap.has(e.name)) filesMap.set(e.name, { size: e.size, mtime: e.mtime });
          }
        } catch (e2) {}
        return;
      }
    } catch (e) {}
    const queue = [{ remotePath: remoteRoot, rel: '' }]; const seen = new Set();
    while (queue.length) {
      if (this.stopRequested) break;
      const cur = queue.shift(); if (seen.has(cur.remotePath)) continue; seen.add(cur.remotePath);
      let entries = [];
      try { entries = await client.withRetry(() => client.list(cur.remotePath), 'LIST'); }
      catch (e) {
        const warnTxt = this.settings.language === 'en' ? `Warning: Failed to list server directory ${cur.remotePath}: ${e.message}` : `هشدار: لیست پوشه سرور ناموفق بود ${cur.remotePath}: ${e.message}`;
        this.addLog(warnTxt, 'warn'); continue;
      }
      for (const e of entries) {
        const relChild = cur.rel ? cur.rel + '/' + e.name : e.name;
        if (this.isExcluded('', relChild)) continue;
        if (e.type === 'dir') { dirsSet.add(relChild); queue.push({ remotePath: cur.remotePath === '/' ? '/' + e.name : cur.remotePath + '/' + e.name, rel: relChild }); }
        else filesMap.set(relChild, { size: e.size, mtime: e.mtime });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  async testConnection() {
    if (!this.settings.host || !this.settings.username) { new Notice(this.t('noticeEnterHostUser')); return; }
    if (!this.getPassword()) { new Notice(this.t('noticeNoPassword')); return; }
    new Notice(this.t('noticeTestingConn')); let client = null;
    try {
      client = new FTPClient({ host: this.settings.host, port: this.settings.port, user: this.settings.username, pass: this.getPassword(), secure: this.settings.secure, timeoutSeconds: this.settings.timeoutSeconds || 120, keepAliveSeconds: this.settings.keepAliveSeconds || 30, maxRetries: this.settings.maxRetries || 2 });
      await client.connect(); const root = this.settings.remotePath || '/'; await this.ensureRemotePath(client, root);
      const list = await client.list(root);
      const succLog = this.settings.language === 'en' ? `Connection test successful. Directory ${root} contains ${list.length} item(s).` : `تست اتصال موفق بود. پوشه ${root} شامل ${list.length} مورد است.`;
      this.addLog(succLog, 'success');
      new Notice(this.t('noticeConnSuccess', root, list.length));
    } catch (e) {
      const errLog = this.settings.language === 'en' ? `Connection test failed: ${e.message}` : `تست اتصال ناموفق: ${e.message}`;
      this.addLog(errLog, 'error'); new Notice(this.t('noticeConnFailed', e.message));
    }
    finally { try { if (client) await client.quit(); } catch (e) {} }
  }
  async performSync(isAuto) {
    if (this.isSyncing) { new Notice(this.t('noticeSyncRunningWait')); return; }
    if (!this.settings.host || !this.settings.username) { new Notice(this.t('noticeIncompleteSettings')); return; }
    if (!this.getPassword()) { new Notice(this.t('noticeNoPassword')); return; }
    this.isSyncing = true; this.stopRequested = false; this.updateStatusBar(0, 1);
    const isEn = this.settings.language === 'en';
    this.addLog(isAuto ? (isEn ? 'Starting auto sync…' : 'شروع سینک خودکار…') : (isEn ? 'Starting manual sync…' : 'شروع سینک دستی…'));
    this.addLog(isEn ? `Timeout: ${this.settings.timeoutSeconds || 120}s | KeepAlive: ${this.settings.keepAliveSeconds || 30}s | Retries: ${this.settings.maxRetries || 2} | Check: ${this.settings.checkMode === 'precise' ? 'Precise (size+mtime)' : 'Fast (name+size)'} | .obsidian: ${this.settings.syncObsidian ? 'ON' : 'OFF'} | .trash: ${this.settings.syncTrash ? 'ON' : 'OFF'}`
                     : `تایم‌اوت: ${this.settings.timeoutSeconds || 120}ث | KeepAlive: ${this.settings.keepAliveSeconds || 30}ث | تلاش مجدد: ${this.settings.maxRetries || 2} | چک: ${this.settings.checkMode === 'precise' ? 'دقیق (سایز+mtime)' : 'سریع rclone (اسم+حجم)'} | .obsidian: ${this.settings.syncObsidian ? 'روشن' : 'خاموش'} | .trash: ${this.settings.syncTrash ? 'روشن' : 'خاموش'}`);
    let client = null;
    try {
      client = new FTPClient({ host: this.settings.host, port: Number(this.settings.port) || 21, user: this.settings.username, pass: this.getPassword(), secure: this.settings.secure, timeoutSeconds: this.settings.timeoutSeconds || 120, keepAliveSeconds: this.settings.keepAliveSeconds || 30, maxRetries: this.settings.maxRetries || 2 });
      await client.connect(); this.addLog(isEn ? 'Connected to FTP server' : 'اتصال به سرور FTP برقرار شد');
      const remoteRoot = (this.settings.remotePath || '/').trim() || '/';
      await this.ensureRemotePath(client, remoteRoot);
      const localFolderRaw = (this.settings.localFolder || '').trim();
      const localFolder = localFolderRaw.replace(/^\/+|\/+$/g, '');
      if (localFolder) {
        const exists = await this.app.vault.adapter.exists(localFolder);
        if (!exists) throw new Error(isEn ? `Local folder '${localFolder}' not found.` : `پوشه محلی «${localFolder}» پیدا نشد.`);
      }
      const localFiles = new Map(); const localDirs = new Set();
      await this.collectLocal(localFolder, localFiles, localDirs);
      {
        let obsCount = 0, trashCount = 0;
        for (const k of localFiles.keys()) { if (k === '.obsidian' || k.startsWith('.obsidian/')) obsCount++; if (k === '.trash' || k.startsWith('.trash/')) trashCount++; }
        let extra = '';
        if (this.settings.syncObsidian) extra += isEn ? ` | .obsidian: ${obsCount} files` : ` | .obsidian: ${obsCount} فایل`;
        if (this.settings.syncTrash) extra += isEn ? ` | .trash: ${trashCount} files` : ` | .trash: ${trashCount} فایل`;
        this.addLog(isEn ? `Local files: ${localFiles.size} file(s)${extra}` : `فایل‌های محلی: ${localFiles.size} فایل${extra}`);
      }
      if (this.stopRequested) throw new Error('STOPPED');
      const remoteFiles = new Map(); const remoteDirs = new Set();
      await this.collectRemote(client, remoteRoot, '', remoteFiles, remoteDirs);
      this.addLog(isEn ? `Remote files: ${remoteFiles.size} files, ${remoteDirs.size} folders` : `فایل‌های سرور: ${remoteFiles.size} فایل، ${remoteDirs.size} پوشه`);
      if (this.stopRequested) throw new Error('STOPPED');
      const mode = this.settings.syncMode || 'mirror-upload';
      const actions = [];
      if (mode === 'mirror-upload') {
        for (const d of localDirs) { if (!d || d === '/' || d === '.') continue; if (!remoteDirs.has(d)) actions.push({ type: 'mkdirRemote', rel: d }); }
        for (const [rel, lf] of localFiles) {
          if (this.stopRequested) break;
          const rf = remoteFiles.get(rel);
          if (!rf) { actions.push({ type: 'upload', rel, local: lf }); continue; }
          if (lf.size !== rf.size) { actions.push({ type: 'upload', rel, local: lf }); continue; }
          if (this.isUnchangedSinceLastSync(rel, lf, rf)) continue;
          if ((this.settings.checkMode || 'fast') === 'fast') { this.updateState(rel, lf, rf); continue; }
          if (lf.mtime <= rf.mtime + 2000) { this.updateState(rel, lf, rf); continue; }
          const diff = lf.mtime - rf.mtime;
          if (diff <= 120000) {
            try { const pr = await client.withRetry(() => client.getMtime(this.joinRemote(remoteRoot, rel)), 'MDTM'); if (pr) { rf.mtime = pr; if (lf.mtime <= pr + 2000) { this.updateState(rel, lf, rf); continue; } } } catch (e) {}
          }
          actions.push({ type: 'upload', rel, local: lf });
        }
        if (this.settings.deleteOrphan) {
          for (const [rel] of remoteFiles) { if (!rel || rel.endsWith(':')) continue; if (!localFiles.has(rel)) { actions.push({ type: 'deleteRemote', rel }); this.deleteState(rel); } }
          const orphanDirs = [...remoteDirs].filter((d) => !localDirs.has(d)).sort((a, b) => b.split('/').length - a.split('/').length);
          for (const d of orphanDirs) actions.push({ type: 'removeRemoteDir', rel: d });
        }
      } else if (mode === 'mirror-download') {
        for (const d of remoteDirs) { if (!d || d === '/' || d === '.') continue; if (!localDirs.has(d)) actions.push({ type: 'mkdirLocal', rel: d }); }
        for (const [rel, rf] of remoteFiles) {
          if (this.stopRequested) break;
          const lf = localFiles.get(rel);
          if (!lf) { actions.push({ type: 'download', rel, remote: rf }); continue; }
          if (lf.size !== rf.size) { actions.push({ type: 'download', rel, remote: rf }); continue; }
          if (this.isUnchangedSinceLastSync(rel, lf, rf)) continue;
          if ((this.settings.checkMode || 'fast') === 'fast') { this.updateState(rel, lf, rf); continue; }
          if (rf.mtime <= lf.mtime + 2000) { this.updateState(rel, lf, rf); continue; }
          const diff = rf.mtime - lf.mtime;
          if (diff <= 120000) {
            try { const pr = await client.withRetry(() => client.getMtime(this.joinRemote(remoteRoot, rel)), 'MDTM'); if (pr) { rf.mtime = pr; if (pr <= lf.mtime + 2000) { this.updateState(rel, lf, rf); continue; } } } catch (e) {}
          }
          actions.push({ type: 'download', rel, remote: rf });
        }
        if (this.settings.deleteOrphan) {
          for (const [rel] of localFiles) if (!remoteFiles.has(rel)) { actions.push({ type: 'deleteLocal', rel }); this.deleteState(rel); }
          const orphanDirs = [...localDirs].filter((d) => !remoteDirs.has(d)).sort((a, b) => b.split('/').length - a.split('/').length);
          for (const d of orphanDirs) actions.push({ type: 'removeLocalDir', rel: d });
        }
      } else {
        for (const d of localDirs) { if (!d || d === '/' || d === '.') continue; if (!remoteDirs.has(d)) actions.push({ type: 'mkdirRemote', rel: d }); }
        for (const d of remoteDirs) { if (!d || d === '/' || d === '.') continue; if (!localDirs.has(d)) actions.push({ type: 'mkdirLocal', rel: d }); }
        const allKeys = new Set([...localFiles.keys(), ...remoteFiles.keys()]);
        for (const rel of allKeys) {
          if (this.stopRequested) break;
          const lf = localFiles.get(rel); const rf = remoteFiles.get(rel);
          if (lf && !rf) { actions.push({ type: 'upload', rel, local: lf }); continue; }
          if (!lf && rf) { actions.push({ type: 'download', rel, remote: rf }); continue; }
          if (lf && rf) {
            if (lf.size === rf.size && (this.settings.checkMode || 'fast') === 'fast') {
              if (this.isUnchangedSinceLastSync(rel, lf, rf)) continue;
              const st = this.getState(rel);
              if (st && Math.abs(lf.mtime - (st.localMtime || 0)) > 2000 && Math.abs(rf.mtime - (st.remoteMtime || 0)) <= 120000) { actions.push({ type: 'upload', rel, local: lf }); continue; }
              if (st && Math.abs(rf.mtime - (st.remoteMtime || 0)) > 120000 && Math.abs(lf.mtime - (st.localMtime || 0)) <= 2000) { actions.push({ type: 'download', rel, remote: rf }); continue; }
              this.updateState(rel, lf, rf); continue;
            }
            if (lf.size !== rf.size) {
              if (this.isUnchangedSinceLastSync(rel, lf, rf)) continue;
              const st = this.getState(rel);
              if (st && Math.abs(lf.mtime - (st.localMtime || 0)) <= 2000 && Math.abs(rf.mtime - (st.remoteMtime || 0)) > 120000) { actions.push({ type: 'download', rel, remote: rf }); continue; }
              if (st && Math.abs(rf.mtime - (st.remoteMtime || 0)) <= 120000 && Math.abs(lf.mtime - (st.localMtime || 0)) > 2000) { actions.push({ type: 'upload', rel, local: lf }); continue; }
              if (lf.mtime > rf.mtime) actions.push({ type: 'upload', rel, local: lf });
              else if (rf.mtime > lf.mtime) actions.push({ type: 'download', rel, remote: rf });
              else actions.push({ type: 'upload', rel, local: lf });
              continue;
            }
            if (this.isUnchangedSinceLastSync(rel, lf, rf)) continue;
            const diff = lf.mtime - rf.mtime;
            if (Math.abs(diff) <= 2000) { this.updateState(rel, lf, rf); continue; }
            if (Math.abs(diff) > 120000) {
              if (diff > 0) actions.push({ type: 'upload', rel, local: lf }); else actions.push({ type: 'download', rel, remote: rf });
              continue;
            }
            try { const pr = await client.withRetry(() => client.getMtime(this.joinRemote(remoteRoot, rel)), 'MDTM'); if (pr) rf.mtime = pr; } catch (e) {}
            const diff2 = lf.mtime - rf.mtime;
            if (Math.abs(diff2) <= 2000) { this.updateState(rel, lf, rf); continue; }
            if (diff2 > 0) actions.push({ type: 'upload', rel, local: lf }); else actions.push({ type: 'download', rel, remote: rf });
          }
        }
      }
      if (this.stopRequested) throw new Error('STOPPED');
      this.addLog(isEn ? `Required operations: ${actions.length} items (${localFiles.size} local, ${remoteFiles.size} remote)` : `عملیات‌های لازم: ${actions.length} مورد (از ${localFiles.size} محلی و ${remoteFiles.size} سرور)`);
      if (actions.length === 0) this.addLog(isEn ? 'All files are up to date — nothing to sync ✅' : 'همه فایل‌ها همگام هستند — چیزی برای کپی نیست ✅');
      const order = { mkdirRemote: 0, mkdirLocal: 0, upload: 1, download: 1, deleteRemote: 2, deleteLocal: 2, removeRemoteDir: 3, removeLocalDir: 3 };
      actions.sort((a, b) => (order[a.type] ?? 1) - (order[b.type] ?? 1));
      const total = actions.length; let done = 0; let uploaded = 0, downloaded = 0, deleted = 0;
      this.updateStatusBar(0, Math.max(total, 1));
      for (const act of actions) {
        if (this.stopRequested) {
          const stopTxt = isEn ? `⏹️ Sync stopped at ${done}/${total} — Uploaded: ${uploaded}, Downloaded: ${downloaded}. Next sync will continue remaining items.` : `⏹️ سینک متوقف شد در ${done}/${total} — آپلود: ${uploaded}، دانلود: ${downloaded}. سینک بعدی فقط باقی‌مانده را انجام می‌دهد.`;
          this.addLog(stopTxt, 'warn'); break;
        }
        try {
          try { await client.maybeKeepAlive(); } catch (e) {}
          if (act.type === 'mkdirRemote') {
            if (!act.rel || act.rel === '/' || act.rel === '.') {}
            else {
              await client.withRetry(() => client.mkdir(this.joinRemote(remoteRoot, act.rel)), 'MKD');
              this.addLog(isEn ? `📁 Remote folder created: ${act.rel}` : `📁 پوشه ساخته شد در سرور: ${act.rel}`);
            }
          }
          else if (act.type === 'mkdirLocal') {
            const lp = localFolder ? `${localFolder}/${act.rel}` : act.rel;
            await this.ensureLocalDir(lp);
            this.addLog(isEn ? `📁 Local folder created: ${act.rel}` : `📁 پوشه ساخته شد محلی: ${act.rel}`);
          }
          else if (act.type === 'upload') {
            const localPath = localFolder ? `${localFolder}/${act.rel}` : act.rel;
            const buf = await this.app.vault.adapter.readBinary(localPath);
            await client.withRetry(() => client.upload(this.joinRemote(remoteRoot, act.rel), Buffer.from(buf), act.local.mtime), 'STOR');
            uploaded++;
            this.addLog(isEn ? `⬆️ Upload: ${act.rel}` : `⬆️ آپلود: ${act.rel}`);
            try { const after = await client.getMtime(this.joinRemote(remoteRoot, act.rel)); this.updateState(act.rel, act.local, { size: act.local.size, mtime: after || act.local.mtime }); } catch (e) { this.updateState(act.rel, act.local, { size: act.local.size, mtime: act.local.mtime }); }
          } else if (act.type === 'download') {
            const buf = await client.withRetry(() => client.download(this.joinRemote(remoteRoot, act.rel)), 'RETR');
            const localPath = localFolder ? `${localFolder}/${act.rel}` : act.rel;
            await this.ensureLocalDirParent(localPath); await this.app.vault.adapter.writeBinary(localPath, buf);
            try { await this.setLocalMtime(localPath, act.remote.mtime); } catch (e) {}
            downloaded++;
            this.addLog(isEn ? `⬇️ Download: ${act.rel}` : `⬇️ دانلود: ${act.rel}`);
            this.updateState(act.rel, { size: act.remote.size, mtime: act.remote.mtime }, act.remote);
          } else if (act.type === 'deleteRemote') {
            if (!act.rel || act.rel.endsWith(':')) {
              this.addLog(isEn ? `⚠️ Skipped suspicious delete: ${act.rel}` : `⚠️ رد حذف مشکوک (اثر پارسر): ${act.rel} — فایل واقعی با : تمام نمی‌شود`, 'warn');
            } else {
              await client.withRetry(() => client.deleteFile(this.joinRemote(remoteRoot, act.rel)), 'DELE');
              deleted++;
              this.addLog(isEn ? `🗑️ Delete remote: ${act.rel}` : `🗑️ حذف از سرور: ${act.rel}`);
            }
          } else if (act.type === 'deleteLocal') {
            const localPath = localFolder ? `${localFolder}/${act.rel}` : act.rel;
            await this.app.vault.adapter.remove(localPath);
            deleted++;
            this.addLog(isEn ? `🗑️ Delete local: ${act.rel}` : `🗑️ حذف محلی: ${act.rel}`);
          }
          else if (act.type === 'removeRemoteDir') { await client.withRetry(() => client.removeDir(this.joinRemote(remoteRoot, act.rel)), 'RMD'); }
          else if (act.type === 'removeLocalDir') { const localPath = localFolder ? `${localFolder}/${act.rel}` : act.rel; try { await this.app.vault.adapter.remove(localPath); } catch (e) {} }
        } catch (e) {
          const errItemTxt = isEn ? `Error in ${act.type} ${act.rel}: ${e.message} — continuing sync…` : `خطا در ${act.type} ${act.rel}: ${e.message} — ادامه سینک…`;
          this.addLog(errItemTxt, 'error');
          if (!client.isConnected()) {
            try {
              await client.reconnect();
              this.addLog(isEn ? 'Reconnected, continuing sync…' : 'اتصال مجدد برقرار شد، ادامه سینک…');
            } catch (re) {
              this.addLog(isEn ? `Reconnect failed: ${re.message}` : `اتصال مجدد ناموفق: ${re.message}`, 'error');
            }
          }
        }
        done++; this.updateStatusBar(done, total);
        await new Promise((r) => setTimeout(r, 0));
      }
      if (this.stopRequested) { new Notice(this.t('noticeSyncStopped')); }
      else {
        this.settings.lastSync = Date.now(); await this.saveData(this.settings);
        const doneTxt = isEn ? `Sync completed. Uploaded: ${uploaded}, Downloaded: ${downloaded}, Deleted: ${deleted}` : `سینک کامل شد. آپلود: ${uploaded}، دانلود: ${downloaded}، حذف: ${deleted}`;
        this.addLog(doneTxt, 'success');
        new Notice(this.t('noticeSyncComplete', uploaded, downloaded, deleted));
      }
    } catch (e) {
      if (e && e.message === 'STOPPED') new Notice(this.t('noticeSyncStopped'));
      else {
        const syncFailTxt = isEn ? `Sync error: ${e.message}` : `خطای سینک: ${e.message}`;
        this.addLog(syncFailTxt, 'error'); new Notice(this.t('noticeSyncError', e.message));
      }
    } finally {
      try { await this.saveData(this.settings); } catch (e) {}
      try { if (client) await client.quit(); } catch (e) {}
      this.isSyncing = false; this.stopRequested = false; this.updateStatusBar();
    }
  }
}

class LogModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this; contentEl.empty();
    const isEn = this.plugin.settings && this.plugin.settings.language === 'en';
    contentEl.createEl('h2', { text: this.plugin.t('modalLogTitle') });
    const pre = contentEl.createEl('pre', { cls: 'ftp-sync-log' });
    if (isEn) pre.style.direction = 'ltr';
    pre.setText(this.plugin.logs.join('\n') || this.plugin.t('modalNoLogs'));
    const row = contentEl.createDiv({ cls: 'ftp-sync-modal-actions' });
    const clearBtn = row.createEl('button', { text: this.plugin.t('modalClearLog') });
    clearBtn.onclick = () => {
      this.plugin.logs = []; this.plugin.settings.logs = [];
      this.plugin.saveData(this.plugin.settings);
      try { this.plugin._notifyLogListeners(); } catch (e) {}
      pre.setText(this.plugin.t('modalLogCleared'));
    };
    const closeBtn = row.createEl('button', { text: this.plugin.t('modalClose') });
    closeBtn.onclick = () => this.close();
  }
  onClose() { const { contentEl } = this; contentEl.empty(); }
}

class FTPSyncSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this; containerEl.empty();
    const p = this.plugin;
    const isEn = p.settings && p.settings.language === 'en';

    containerEl.createEl('h2', { text: p.t('settingsTitle') });
    containerEl.createEl('p', { text: p.t('settingsDesc') });

    // تنظیم زبان در ابتدای صفحه تنظیمات
    new Setting(containerEl)
      .setName(p.t('langName'))
      .setDesc(p.t('langDesc'))
      .addDropdown((d) => d
        .addOption('fa', 'فارسی (Persian)')
        .addOption('en', 'English')
        .setValue(p.settings.language || 'fa')
        .onChange(async (v) => {
          p.settings.language = v;
          await p.saveData(p.settings);
          p.updateStatusBar();
          this.display();
        })
      );

    new Setting(containerEl).setName(p.t('hostName')).setDesc(p.t('hostDesc')).addText((t) => t.setPlaceholder('ftp.example.com').setValue(p.settings.host).onChange(async (v) => { p.settings.host = v.trim(); await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('portName')).setDesc(p.t('portDesc')).addText((t) => t.setPlaceholder('21').setValue(String(p.settings.port)).onChange(async (v) => { const n = parseInt(v, 10); if (!isNaN(n)) { p.settings.port = n; await p.saveData(p.settings); } }));
    new Setting(containerEl).setName(p.t('userName')).addText((t) => t.setPlaceholder('username').setValue(p.settings.username).onChange(async (v) => { p.settings.username = v; await p.saveData(p.settings); }));

    const hasPw = !!p.getPassword();
    new Setting(containerEl).setName(p.t('passName')).setDesc(hasPw ? p.t('passDescSaved') : p.t('passDescNotSaved')).addText((t) => {
      t.inputEl.type = 'password';
      t.setPlaceholder(hasPw ? p.t('passPlaceholderSaved') : p.t('passPlaceholderEmpty')).setValue('').onChange(async (v) => { if (v) { await p.setPassword(v); } });
    });
    new Setting(containerEl).setName(p.t('clearPassName')).setDesc(p.t('clearPassDesc')).addButton((b) => b.setButtonText(p.t('clearPassBtn')).onClick(async () => { await p.clearPassword(); new Notice(p.t('noticePasswordCleared')); this.display(); }));
    new Setting(containerEl).setName(p.t('protoName')).setDesc(p.t('protoDesc')).addDropdown((d) => d.addOption('ftp', p.t('protoOptFtp')).addOption('ftps-explicit', p.t('protoOptExplicit')).addOption('ftps-implicit', p.t('protoOptImplicit')).setValue(p.settings.secure).onChange(async (v) => { p.settings.secure = v; await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('remotePathName')).setDesc(p.t('remotePathDesc')).addText((t) => t.setPlaceholder('/obsidian-backup').setValue(p.settings.remotePath).onChange(async (v) => { p.settings.remotePath = v.trim() || '/'; await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('localFolderName')).setDesc(p.t('localFolderDesc')).addText((t) => t.setPlaceholder(p.t('localFolderPlaceholder')).setValue(p.settings.localFolder).onChange(async (v) => { p.settings.localFolder = v.trim(); await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('syncModeName')).setDesc(p.t('syncModeDesc')).addDropdown((d) => d.addOption('mirror-upload', p.t('syncModeUpload')).addOption('two-way', p.t('syncModeTwoWay')).addOption('mirror-download', p.t('syncModeDownload')).setValue(p.settings.syncMode).onChange(async (v) => { p.settings.syncMode = v; await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('checkSpeedName')).setDesc(p.t('checkSpeedDesc')).addDropdown((d) => d.addOption('fast', p.t('checkSpeedFast')).addOption('precise', p.t('checkSpeedPrecise')).setValue(p.settings.checkMode || 'fast').onChange(async (v) => { p.settings.checkMode = v; await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('delOrphanName')).setDesc(p.t('delOrphanDesc')).addToggle((t) => t.setValue(p.settings.deleteOrphan).onChange(async (v) => { p.settings.deleteOrphan = v; await p.saveData(p.settings); }));

    containerEl.createEl('h3', { text: p.t('secSysFolders') });
    new Setting(containerEl).setName(p.t('syncObsidianName')).setDesc(p.t('syncObsidianDesc')).addToggle((t) => t.setValue(!!p.settings.syncObsidian).onChange(async (v) => { p.settings.syncObsidian = v; await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('syncTrashName')).setDesc(p.t('syncTrashDesc')).addToggle((t) => t.setValue(!!p.settings.syncTrash).onChange(async (v) => { p.settings.syncTrash = v; await p.saveData(p.settings); }));

    containerEl.createEl('h3', { text: p.t('secConnStability') });
    new Setting(containerEl).setName(p.t('timeoutName')).setDesc(p.t('timeoutDesc')).addText((t) => t.setPlaceholder('120').setValue(String(p.settings.timeoutSeconds || 120)).onChange(async (v) => { const n = parseInt(v, 10); p.settings.timeoutSeconds = isNaN(n) ? 120 : Math.min(600, Math.max(30, n)); await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('keepAliveName')).setDesc(p.t('keepAliveDesc')).addText((t) => t.setPlaceholder('30').setValue(String(p.settings.keepAliveSeconds || 30)).onChange(async (v) => { const n = parseInt(v, 10); p.settings.keepAliveSeconds = isNaN(n) ? 30 : Math.min(120, Math.max(10, n)); await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('retriesName')).setDesc(p.t('retriesDesc')).addText((t) => t.setPlaceholder('2').setValue(String(p.settings.maxRetries ?? 2)).onChange(async (v) => { const n = parseInt(v, 10); p.settings.maxRetries = isNaN(n) ? 2 : Math.min(5, Math.max(0, n)); await p.saveData(p.settings); }));
    new Setting(containerEl).setName(p.t('autoSyncName')).setDesc(p.t('autoSyncDesc')).addText((t) => t.setPlaceholder('0').setValue(String(p.settings.autoSyncMinutes)).onChange(async (v) => { const n = parseInt(v, 10); p.settings.autoSyncMinutes = isNaN(n) ? 0 : Math.max(0, n); await p.saveData(p.settings); p.setupAutoSync(); }));
    new Setting(containerEl).setName(p.t('autoSyncStartupName')).addToggle((t) => t.setValue(p.settings.autoSyncOnStartup).onChange(async (v) => { p.settings.autoSyncOnStartup = v; await p.saveData(p.settings); }));

    new Setting(containerEl).setName(p.t('testAndSyncName')).setDesc(p.t('testAndSyncDesc'))
      .addButton((b) => b.setButtonText(p.t('btnTestConn')).onClick(async () => { await p.testConnection(); }))
      .addButton((b) => b.setButtonText(p.t('btnSyncNow')).setCta().onClick(async () => { await p.performSync(false); }))
      .addButton((b) => b.setButtonText(p.t('btnShowLog')).onClick(() => { new LogModal(this.app, p).open(); }));

    const stopSetting = new Setting(containerEl).setName(p.t('stopSyncName')).setDesc(p.isSyncing ? p.t('stopSyncDescRunning') : p.t('stopSyncDescIdle'));
    stopSetting.addButton((b) => {
      b.setButtonText(p.t('btnStopSync'));
      try { b.buttonEl.style.background = '#c92a2a'; b.buttonEl.style.color = '#fff'; b.buttonEl.style.borderColor = '#c92a2a'; } catch (e) {}
      b.onClick(() => { p.requestStop(); });
    });

    containerEl.createEl('h3', { text: p.t('secLiveLog') });
    containerEl.createEl('p', { text: p.t('liveLogNote'), cls: 'ftp-sync-note' });
    const logBox = containerEl.createDiv({ cls: 'ftp-sync-log-box' });
    const pre = logBox.createEl('pre', { cls: 'ftp-sync-log' });
    if (isEn) pre.style.direction = 'ltr';
    pre.setText(p.logs.join('\n') || p.t('noLogsYet'));

    if (this._unsubLog) { try { this._unsubLog(); } catch (e) {} }
    this._unsubLog = p.onLog((text) => { try { pre.setText(text); pre.scrollTop = pre.scrollHeight; } catch (e) {} });

    const logActions = containerEl.createDiv({ cls: 'ftp-sync-log-actions' });
    const clearBtn = logActions.createEl('button', { text: p.t('btnClearLog') });
    clearBtn.onclick = async () => { p.logs = []; p.settings.logs = []; await p.saveData(p.settings); p._notifyLogListeners(); };

    const last = containerEl.createEl('p', { cls: 'ftp-sync-last' });
    last.setText(p.settings.lastSync ? p.t('lastSyncText', p.formatDate(p.settings.lastSync)) : p.t('neverSyncedText'));
    containerEl.createEl('p', { text: p.t('bottomNote'), cls: 'ftp-sync-note' });
  }
  hide() {
    if (this._unsubLog) { try { this._unsubLog(); } catch (e) {} this._unsubLog = null; }
    super.hide?.();
  }
}

module.exports = FTPSyncPlugin;
module.exports.default = FTPSyncPlugin;
