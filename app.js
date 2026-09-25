"use strict";

const APP_VERSION = "6.3";
const TABLE_NAME = "barang";
const BUCKET_NAME = "barang-images";
const CACHE_KEY = "inventarisku:last-data:v1";
const THEME_KEY = "inventarisku:theme:v1";
const LAST_SYNC_KEY = "inventarisku:last-sync:v1";
const LOGIN_RATE_KEY = "inventarisku:login-rate:v1";
const AUTH_MARKER_KEY = "inventarisku:auth-marker:v1";
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 2 * 60 * 1000;
const LOW_STOCK_LIMIT = 5;
const PAGE_SIZE = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRICE_RUPIAH = 999_999_999_999;
const LARGE_PRICE_WARNING = 1_000_000_000;
const MAX_STOCK = 2_147_483_647;
const LARGE_STOCK_WARNING = 1_000_000;
const NETWORK_TIMEOUT = 8000;
const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
const DEFAULT_CATEGORIES = ["Elektronik", "ATK", "Makanan", "Minuman", "Pakaian", "Rumah Tangga", "Lainnya"];
const CATEGORY_PREFIX_MAP = { elektronik:"ELK", atk:"ATK", makanan:"MKN", minuman:"MNM", pakaian:"PKN", "rumah tangga":"RTG", lainnya:"LLN" };
const ALLOWED_CONDITIONS = ["Baik", "Perlu Dicek", "Rusak"];

const state = {
  db:null,
  user:null,
  items:[],
  allItems:[],
  archivedItems:[],
  inventoryPage:1,
  archivePage:1,
  editingId:null,
  deletingId:null,
  oldImagePath:null,
  selectedFile:null,
  editingOriginalCategory:null,
  categorySuggestion:null,
  categoryOverrideKey:null,
  imageValidationError:"",
  isSaving:false,
  installPrompt:null,
  supabaseLibraryPromise:null,
  supabaseConnectPromise:null,
  sessionTimer:null,
  sessionTicker:null,
  loginLockTicker:null,
  confirmResolve:null,
  modalScrollY:0,
  importRows:[],
  importErrors:[],
  opnameSessions:[],
  opnameActive:null,
  opnameDetails:[],
  opnameSaveTimer:null,
  opnameSaving:false,
  signedImageUrls:new Map(),
  imageViewerRequestId:0,
};

const touchedFields = new Set();
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

const els = {};
function cacheElements(){
  Object.assign(els, {
    splash:$("#splash"), splashStatus:$("#splashStatus"), splashProgressBar:$("#splashProgressBar"),
    loginView:$("#loginView"), loginForm:$("#loginForm"), loginEmail:$("#loginEmail"), loginPassword:$("#loginPassword"), loginBtn:$("#loginBtn"), loginStatus:$("#loginStatus"), loginEmailError:$("#loginEmailError"), loginPasswordError:$("#loginPasswordError"), togglePasswordBtn:$("#togglePasswordBtn"),
    appShell:$("#appShell"), offlineBanner:$("#offlineBanner"), connectionPill:$("#connectionPill"), connectionText:$("#connectionText"), installBtn:$("#installBtn"), userMenuBtn:$("#userMenuBtn"), userMenu:$("#userMenu"), userInitial:$("#userInitial"), userEmail:$("#userEmail"), menuUserEmail:$("#menuUserEmail"), sessionRemaining:$("#sessionRemaining"), logoutBtn:$("#logoutBtn"),
    openAddBtn:$("#openAddBtn"), emptyAddBtn:$("#emptyAddBtn"), openDataBtn:$("#openDataBtn"), openOpnameBtn:$("#openOpnameBtn"), refreshBtn:$("#refreshBtn"), lastSync:$("#lastSync"),
    statJenis:$("#statJenis"), statStok:$("#statStok"), statNilai:$("#statNilai"), statMenipis:$("#statMenipis"), analyticsCaption:$("#analyticsCaption"), chartCategoryCount:$("#chartCategoryCount"), chartCategoryValue:$("#chartCategoryValue"), stockDonut:$("#stockDonut"), stockDonutTotal:$("#stockDonutTotal"), stockLegend:$("#stockLegend"),
    inventoryToolbar:$("#inventoryToolbar"), searchInput:$("#searchInput"), mobileFilterToggle:$("#mobileFilterToggle"), mobileFilterCount:$("#mobileFilterCount"), categoryFilter:$("#categoryFilter"), stockFilter:$("#stockFilter"), sortFilter:$("#sortFilter"), clearFiltersBtn:$("#clearFiltersBtn"), resultInfo:$("#resultInfo"), loadingState:$("#loadingState"), emptyState:$("#emptyState"), noResultState:$("#noResultState"), inventoryList:$("#inventoryList"), inventoryRows:$("#inventoryRows"), inventoryPagination:$("#inventoryPagination"), inventoryPageInfo:$("#inventoryPageInfo"), inventoryPrevBtn:$("#inventoryPrevBtn"), inventoryNextBtn:$("#inventoryNextBtn"),
    formDialog:$("#formDialog"), itemForm:$("#itemForm"), formEyebrow:$("#formEyebrow"), formTitle:$("#formTitle"), namaBarang:$("#namaBarang"), kategori:$("#kategori"), kategoriList:$("#kategoriList"), categoryAssist:$("#categoryAssist"), categoryAssistText:$("#categoryAssistText"), useExistingCategoryBtn:$("#useExistingCategoryBtn"), keepNewCategoryBtn:$("#keepNewCategoryBtn"), kodeBarang:$("#kodeBarang"), codeHelp:$("#codeHelp"), harga:$("#harga"), stok:$("#stok"), satuan:$("#satuan"), kondisi:$("#kondisi"), supplier:$("#supplier"), lokasi:$("#lokasi"), gambar:$("#gambar"), imagePreview:$("#imagePreview"), imageError:$("#imageError"), saveBtn:$("#saveBtn"), saveBtnText:$("#saveBtnText"),
    detailDialog:$("#detailDialog"), detailContent:$("#detailContent"), imageDialog:$("#imageDialog"), imageViewerStage:$("#imageViewerStage"), imageViewerImg:$("#imageViewerImg"), imageViewerFallback:$("#imageViewerFallback"), imageViewerName:$("#imageViewerName"),
    dataDialog:$("#dataDialog"), exportFormat:$("#exportFormat"), exportScope:$("#exportScope"), exportBtn:$("#exportBtn"), exportStatus:$("#exportStatus"), importFile:$("#importFile"), importFileName:$("#importFileName"), importSummary:$("#importSummary"), importPreview:$("#importPreview"), importBtn:$("#importBtn"), backupLocalBtn:$("#backupLocalBtn"), restoreLocalFile:$("#restoreLocalFile"), localBackupStatus:$("#localBackupStatus"), archiveStatus:$("#archiveStatus"), archiveList:$("#archiveList"), refreshArchiveBtn:$("#refreshArchiveBtn"), archivePagination:$("#archivePagination"), archivePageInfo:$("#archivePageInfo"), archivePrevBtn:$("#archivePrevBtn"), archiveNextBtn:$("#archiveNextBtn"),
    opnameDialog:$("#opnameDialog"), opnameHome:$("#opnameHome"), opnameDetail:$("#opnameDetail"), opnameHomeStatus:$("#opnameHomeStatus"), opnameSessions:$("#opnameSessions"), startOpnameBtn:$("#startOpnameBtn"), backOpnameBtn:$("#backOpnameBtn"), opnameNumber:$("#opnameNumber"), opnameProgress:$("#opnameProgress"), opnameSaveStatus:$("#opnameSaveStatus"), cancelOpnameBtn:$("#cancelOpnameBtn"), finalizeOpnameBtn:$("#finalizeOpnameBtn"), opnameSearch:$("#opnameSearch"), opnameRows:$("#opnameRows"),
    confirmDialog:$("#confirmDialog"), confirmEyebrow:$("#confirmEyebrow"), confirmTitle:$("#confirmTitle"), confirmMessage:$("#confirmMessage"), confirmCancelBtn:$("#confirmCancelBtn"), confirmOkBtn:$("#confirmOkBtn"),
    toastContainer:$("#toastContainer"),
  });
}

document.addEventListener("DOMContentLoaded", init);

async function init(){
  cacheElements();
  applyThemePreference(getThemePreference(), false);
  bindEvents();
  setupPWA();
  setSplash(18, "Memeriksa sesi...");

  if (!isConfigReady()) {
    await showLogin("Konfigurasi Supabase belum lengkap di config.js.", "error");
    finishSplash();
    return;
  }

  const marker = readAuthMarker();
  if (marker && marker.expiresAt > Date.now()) {
    if (!navigator.onLine) {
      state.user = { id:marker.userId, email:marker.email };
      unlockAppShell();
      loadCachedItems();
      scheduleSessionExpiry(marker.expiresAt);
      updateConnectionUI();
      setSplash(88, "Membuka data offline...");
      finishSplash();
      return;
    }

    try {
      setSplash(38, "Memvalidasi sesi...");
      await connectSupabase();
      const { data, error } = await withTimeout(state.db.auth.getSession(), NETWORK_TIMEOUT, "Validasi sesi terlalu lama.");
      if (error) throw error;
      if (data?.session?.user) {
        state.user = data.session.user;
        unlockAppShell();
        scheduleSessionExpiry(marker.expiresAt);
        setSplash(58, "Menyinkronkan inventaris...");
        await loadItems({ startup:true });
        finishSplash();
        return;
      }
    } catch (error) {
      console.warn("session validation:", error);
    }
    clearLocalSession();
  }

  await showLogin(navigator.onLine ? "" : "Kamu sedang offline. Login membutuhkan koneksi internet.", navigator.onLine ? "info" : "error");
  finishSplash();
}

function bindEvents(){
  els.loginForm.addEventListener("submit", handleLogin);
  els.loginEmail.addEventListener("input", () => validateLoginField(els.loginEmail));
  els.loginPassword.addEventListener("input", () => validateLoginField(els.loginPassword));
  els.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);
  els.logoutBtn.addEventListener("click", () => logout("Kamu telah keluar dari aplikasi."));
  els.userMenuBtn.addEventListener("click", toggleUserMenu);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-menu-wrap")) closeUserMenu();
  });
  $$('[data-theme-choice]').forEach((button) => button.addEventListener("click", () => {
    applyThemePreference(button.dataset.themeChoice, true);
    closeUserMenu();
  }));

  els.openAddBtn.addEventListener("click", openAddForm);
  els.emptyAddBtn.addEventListener("click", openAddForm);
  els.openDataBtn.addEventListener("click", openDataTools);
  els.openOpnameBtn.addEventListener("click", openOpname);
  els.refreshBtn.addEventListener("click", () => loadItems());
  els.searchInput.addEventListener("input", () => { state.inventoryPage = 1; renderItems(); });
  [els.categoryFilter, els.stockFilter, els.sortFilter].forEach((el) => el.addEventListener("change", handleInventoryFilterChange));
  els.clearFiltersBtn.addEventListener("click", clearFilters);
  els.mobileFilterToggle.addEventListener("click", toggleMobileFilters);
  els.inventoryRows.addEventListener("click", handleInventoryAction);
  els.inventoryPrevBtn.addEventListener("click", () => changeInventoryPage(-1));
  els.inventoryNextBtn.addEventListener("click", () => changeInventoryPage(1));

  els.itemForm.addEventListener("submit", handleSubmit);
  els.gambar.addEventListener("change", handleImageSelection);
  els.imagePreview.addEventListener("click", handleImagePreviewClick);
  els.kategori.addEventListener("input", handleCategoryInput);
  els.kategori.addEventListener("change", handleCategoryCommit);
  els.kategori.addEventListener("blur", handleCategoryCommit);
  els.useExistingCategoryBtn.addEventListener("click", useSuggestedCategory);
  els.keepNewCategoryBtn.addEventListener("click", keepNewCategory);
  getLiveValidationFields().forEach((input) => {
    ["input","change"].forEach((eventName) => input.addEventListener(eventName, () => {
      touchedFields.add(input.id);
      validateField(input);
      updateSaveAvailability();
    }));
    input.addEventListener("blur", () => {
      touchedFields.add(input.id);
      validateField(input, { force:true });
      updateSaveAvailability();
    });
  });

  els.exportBtn.addEventListener("click", exportDataPackage);
  els.importFile.addEventListener("change", handleImportFile);
  els.importBtn.addEventListener("click", importPreparedRows);
  els.backupLocalBtn.addEventListener("click", backupLocalStorage);
  els.restoreLocalFile.addEventListener("change", restoreLocalStorageFromFile);
  els.refreshArchiveBtn.addEventListener("click", loadArchivedItems);
  els.archiveList.addEventListener("click", handleArchiveAction);
  els.archivePrevBtn.addEventListener("click", () => changeArchivePage(-1));
  els.archiveNextBtn.addEventListener("click", () => changeArchivePage(1));

  els.startOpnameBtn.addEventListener("click", startStockOpname);
  els.backOpnameBtn.addEventListener("click", showOpnameHome);
  els.cancelOpnameBtn.addEventListener("click", cancelStockOpname);
  els.finalizeOpnameBtn.addEventListener("click", finalizeStockOpname);
  els.opnameSearch.addEventListener("input", renderOpnameDetails);
  els.opnameRows.addEventListener("input", handleOpnameInput);
  els.opnameRows.addEventListener("click", (event) => event.stopPropagation());
  els.opnameSessions.addEventListener("click", handleOpnameSessionClick);

  $$(".close-dialog").forEach((button) => button.addEventListener("click", async () => {
    const dialog = button.closest("dialog");
    if (dialog === els.formDialog && state.isSaving) return;
    if (dialog === els.opnameDialog) await flushOpnameAutosave();
    if (dialog?.open) closeAppDialog(dialog);
  }));

  [els.formDialog, els.detailDialog, els.imageDialog, els.dataDialog, els.opnameDialog].forEach((dialog) => {
    dialog.addEventListener("click", async (event) => {
      if (event.target !== dialog) return;
      if (dialog === els.formDialog && state.isSaving) return;
      if (dialog === els.opnameDialog) await flushOpnameAutosave();
      closeAppDialog(dialog);
    });
    dialog.addEventListener("close", schedulePageScrollUnlock);
    dialog.addEventListener("cancel", async (event) => {
      if (dialog === els.formDialog && state.isSaving) { event.preventDefault(); return; }
      if (dialog === els.opnameDialog) await flushOpnameAutosave();
    });
  });

  els.confirmCancelBtn.addEventListener("click", () => resolveConfirm(false));
  els.confirmOkBtn.addEventListener("click", () => resolveConfirm(true));
  els.confirmDialog.addEventListener("cancel", (event) => { event.preventDefault(); resolveConfirm(false); });
  els.confirmDialog.addEventListener("close", schedulePageScrollUnlock);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("focus", checkSessionExpiry);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkSessionExpiry(); });
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if (getThemePreference() === "system") applyThemePreference("system", false);
  });
}

function setSplash(percent, message){
  if (els.splashProgressBar) els.splashProgressBar.style.width = `${Math.max(0,Math.min(100,percent))}%`;
  if (els.splashStatus) els.splashStatus.textContent = message;
}
function finishSplash(){
  setSplash(100, "Siap digunakan");
  setTimeout(() => {
    els.splash?.classList.add("splash--hidden");
    setTimeout(() => els.splash?.remove(), 320);
  }, 140);
}

function isConfigReady(){
  return typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_PROJECT_ID") && typeof SUPABASE_PUBLISHABLE_KEY === "string" && SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_PUBLISHABLE");
}

function withTimeout(promiseLike, ms, message="Permintaan terlalu lama."){
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([Promise.resolve(promiseLike), timeout]).finally(() => clearTimeout(timer));
}

function loadSupabaseLibrary(){
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (!navigator.onLine) return Promise.reject(new Error("OFFLINE"));
  if (state.supabaseLibraryPromise) return state.supabaseLibraryPromise;
  state.supabaseLibraryPromise = new Promise((resolve,reject) => {
    const script = document.createElement("script");
    script.src = SUPABASE_CDN_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("Library Supabase tidak merespons.")), NETWORK_TIMEOUT);
    script.addEventListener("load", () => { clearTimeout(timer); window.supabase?.createClient ? resolve(window.supabase) : reject(new Error("Library Supabase gagal dimuat.")); }, { once:true });
    script.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Library Supabase tidak dapat dimuat.")); }, { once:true });
    document.head.append(script);
  }).finally(() => { state.supabaseLibraryPromise = null; });
  return state.supabaseLibraryPromise;
}

async function connectSupabase(){
  if (state.db) return state.db;
  if (!navigator.onLine || !isConfigReady()) return null;
  if (state.supabaseConnectPromise) return state.supabaseConnectPromise;
  state.supabaseConnectPromise = (async () => {
    const library = await loadSupabaseLibrary();
    state.db = library.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth:{ persistSession:true, storage:window.sessionStorage, autoRefreshToken:true, detectSessionInUrl:false }
    });
    return state.db;
  })().finally(() => { state.supabaseConnectPromise = null; });
  return state.supabaseConnectPromise;
}

function getLoginRate(){
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGIN_RATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return { attempts:0, lockedUntil:0 };
    if (parsed.lockedUntil && parsed.lockedUntil <= Date.now()) return { attempts:0, lockedUntil:0 };
    return { attempts:Number(parsed.attempts)||0, lockedUntil:Number(parsed.lockedUntil)||0 };
  } catch { return { attempts:0, lockedUntil:0 }; }
}
function setLoginRate(rate){ localStorage.setItem(LOGIN_RATE_KEY, JSON.stringify(rate)); }
function clearLoginRate(){ localStorage.removeItem(LOGIN_RATE_KEY); stopLoginLockTicker(); }
function registerLoginFailure(){
  const rate = getLoginRate();
  const attempts = rate.attempts + 1;
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOGIN_LOCK_MS;
    setLoginRate({ attempts:LOGIN_MAX_ATTEMPTS, lockedUntil });
    startLoginLockTicker();
    return { locked:true, remaining:LOGIN_LOCK_MS };
  }
  setLoginRate({ attempts, lockedUntil:0 });
  return { locked:false, attemptsLeft:LOGIN_MAX_ATTEMPTS-attempts };
}
function getLoginLockRemaining(){ return Math.max(0, getLoginRate().lockedUntil - Date.now()); }
function startLoginLockTicker(){
  stopLoginLockTicker();
  const tick = () => {
    const remaining = getLoginLockRemaining();
    if (remaining <= 0) {
      clearLoginRate();
      els.loginBtn.disabled = false;
      setLoginStatus("Kamu bisa mencoba login kembali.", "info");
      return;
    }
    els.loginBtn.disabled = true;
    setLoginStatus(`Terlalu banyak percobaan. Coba lagi dalam ${formatDurationShort(remaining)}.`, "error");
  };
  tick();
  state.loginLockTicker = setInterval(tick, 1000);
}
function stopLoginLockTicker(){ if (state.loginLockTicker) clearInterval(state.loginLockTicker); state.loginLockTicker = null; }

async function handleLogin(event){
  event.preventDefault();
  if (getLoginLockRemaining() > 0) { startLoginLockTicker(); return; }
  if (!navigator.onLine) { setLoginStatus("Login membutuhkan koneksi internet.", "error"); return; }
  const emailOk = validateLoginField(els.loginEmail, true);
  const passOk = validateLoginField(els.loginPassword, true);
  if (!emailOk || !passOk) return;

  els.loginBtn.disabled = true;
  els.loginBtn.textContent = "Memeriksa...";
  setLoginStatus("", "info");
  try {
    await connectSupabase();
    const { data, error } = await withTimeout(state.db.auth.signInWithPassword({ email:els.loginEmail.value.trim(), password:els.loginPassword.value }), NETWORK_TIMEOUT, "Login terlalu lama.");
    if (error || !data?.session?.user) throw error || new Error("Login gagal.");
    clearLoginRate();
    state.user = data.session.user;
    const startedAt = Date.now();
    const expiresAt = startedAt + SESSION_DURATION_MS;
    writeAuthMarker({ userId:state.user.id, email:state.user.email || "User", startedAt, expiresAt });
    scheduleSessionExpiry(expiresAt);
    unlockAppShell();
    setLoginStatus("", "info");
    await loadItems({ startup:true });
  } catch (error) {
    if (!/invalid login credentials/i.test(String(error?.message || ""))) console.error("login:", error);
    const rate = registerLoginFailure();
    if (rate.locked) {
      startLoginLockTicker();
    } else {
      setLoginStatus(`${friendlyAuthError(error)} Sisa percobaan: ${rate.attemptsLeft}.`, "error");
    }
  } finally {
    if (getLoginLockRemaining() <= 0) els.loginBtn.disabled = false;
    els.loginBtn.textContent = "Masuk";
  }
}

function validateLoginField(input, force=false){
  const messageEl = input === els.loginEmail ? els.loginEmailError : els.loginPasswordError;
  let message = "";
  const value = input.value.trim();
  if ((force || value) && !value) message = input === els.loginEmail ? "Email wajib diisi." : "Password wajib diisi.";
  else if (input === els.loginEmail && value && !/^\S+@\S+\.\S+$/.test(value)) message = "Format email belum valid.";
  else if (input === els.loginPassword && value && value.length < 6) message = "Password minimal 6 karakter.";
  messageEl.textContent = message;
  input.classList.toggle("is-invalid", Boolean(message));
  return !message;
}
function togglePasswordVisibility(){
  const show = els.loginPassword.type === "password";
  els.loginPassword.type = show ? "text" : "password";
  els.togglePasswordBtn.textContent = show ? "Sembunyi" : "Lihat";
  els.togglePasswordBtn.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
}
function setLoginStatus(message, type="info"){
  els.loginStatus.textContent = message || "";
  els.loginStatus.className = `auth-status ${type === "error" ? "" : type === "success" ? "is-success" : "is-info"}`;
}
async function showLogin(message="", type="info"){
  els.appShell.hidden = true;
  els.loginView.hidden = false;
  updateLoginAvailability();
  if (message) setLoginStatus(message,type); else setLoginStatus("","info");
}
function unlockAppShell(){
  els.loginView.hidden = true;
  els.appShell.hidden = false;
  const email = state.user?.email || "User";
  els.userEmail.textContent = email;
  els.menuUserEmail.textContent = email;
  els.userInitial.textContent = email.slice(0,1).toUpperCase();
  updateConnectionUI();
  updateLastSyncLabel();
}
function updateLoginAvailability(){
  const remaining = getLoginLockRemaining();
  if (remaining > 0) { startLoginLockTicker(); return; }
  els.loginBtn.disabled = !navigator.onLine;
  if (!navigator.onLine) setLoginStatus("Kamu sedang offline. Login membutuhkan koneksi internet.", "error");
}
function writeAuthMarker(marker){ sessionStorage.setItem(AUTH_MARKER_KEY, JSON.stringify(marker)); }
function readAuthMarker(){ try { return JSON.parse(sessionStorage.getItem(AUTH_MARKER_KEY) || "null"); } catch { return null; } }
function clearLocalSession(){
  if (state.sessionTimer) clearTimeout(state.sessionTimer);
  if (state.sessionTicker) clearInterval(state.sessionTicker);
  state.sessionTimer = null; state.sessionTicker = null;
  sessionStorage.clear();
  state.signedImageUrls.clear();
  state.user = null; state.db = null;
}
function scheduleSessionExpiry(expiresAt){
  if (state.sessionTimer) clearTimeout(state.sessionTimer);
  if (state.sessionTicker) clearInterval(state.sessionTicker);
  const update = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { logout("Sesi 2 jam telah berakhir. Silakan login kembali."); return; }
    els.sessionRemaining.textContent = `Sesi berakhir dalam ${formatDurationShort(remaining)}`;
  };
  update();
  state.sessionTicker = setInterval(update, 60_000);
  state.sessionTimer = setTimeout(() => logout("Sesi 2 jam telah berakhir. Silakan login kembali."), Math.max(0, expiresAt-Date.now()));
}
function checkSessionExpiry(){
  const marker = readAuthMarker();
  if (els.appShell.hidden || !marker) return;
  if (marker.expiresAt <= Date.now()) logout("Sesi 2 jam telah berakhir. Silakan login kembali.");
}
async function logout(message="Kamu telah keluar.", { remote=true }={}){
  try { if (remote && navigator.onLine && state.db) await state.db.auth.signOut(); } catch (error) { console.warn("logout remote:", error); }
  clearLocalSession();
  state.items = [];
  renderItems();
  closeAllDialogs();
  closeUserMenu();
  await showLogin(message,"info");
}
function friendlyAuthError(error){
  const msg = String(error?.message || "");
  if (/invalid login credentials/i.test(msg)) return "Email atau password salah.";
  if (/email not confirmed/i.test(msg)) return "Email belum dikonfirmasi.";
  if (/rate limit|too many/i.test(msg)) return "Server membatasi percobaan login sementara.";
  if (/fetch|network|timeout|terlalu lama/i.test(msg)) return "Koneksi ke server gagal.";
  return msg || "Login gagal.";
}

async function handleOnline(){
  updateConnectionUI();
  updateLoginAvailability();
  if (els.appShell.hidden) return;
  showToast("Kembali online", "Menyambungkan ke Supabase...", "success");
  try {
    await connectSupabase();
    const { data } = await state.db.auth.getSession();
    if (!data?.session?.user) { await logout("Sesi server sudah tidak valid.", { remote:false }); return; }
    state.user = data.session.user;
    await loadItems();
  } catch (error) { showToast("Belum tersambung", friendlyError(error), "warning"); }
}
function handleOffline(){
  updateConnectionUI();
  updateLoginAvailability();
  if (!els.appShell.hidden) showToast("Mode offline", "Data cache tetap dapat dilihat. Perubahan dinonaktifkan.", "warning");
}
function updateConnectionUI(){
  const online = navigator.onLine;
  els.offlineBanner.hidden = online;
  els.connectionText.textContent = online ? "Online" : "Offline";
  els.connectionPill.classList.toggle("is-offline", !online);
  updateSaveAvailability();
}

function getThemePreference(){ return localStorage.getItem(THEME_KEY) || "system"; }
function applyThemePreference(preference, persist=true){
  const allowed = ["light","dark","system"];
  if (!allowed.includes(preference)) preference = "system";
  const resolved = preference === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  if (persist) localStorage.setItem(THEME_KEY, preference);
  $$('[data-theme-choice]').forEach((button) => button.classList.toggle("is-active", button.dataset.themeChoice === preference));
  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = resolved === "dark" ? "#0f131a" : "#111827";
}
function toggleUserMenu(){ const opening = els.userMenu.hidden; els.userMenu.hidden = !opening; els.userMenuBtn.setAttribute("aria-expanded", opening ? "true":"false"); }
function closeUserMenu(){ els.userMenu.hidden = true; els.userMenuBtn.setAttribute("aria-expanded","false"); }

function lockPageScroll(){
  if (document.body.classList.contains("modal-open")) return;
  state.modalScrollY = window.scrollY || 0;
  const gap = Math.max(0, window.innerWidth-document.documentElement.clientWidth);
  document.documentElement.classList.add("modal-open"); document.body.classList.add("modal-open");
  document.body.style.position="fixed"; document.body.style.top=`-${state.modalScrollY}px`; document.body.style.left="0"; document.body.style.right="0"; document.body.style.width="100%";
  if (gap) document.body.style.paddingRight=`${gap}px`;
}
function unlockPageScrollIfPossible(){
  if ($$("dialog[open]").length) return;
  document.documentElement.classList.remove("modal-open"); document.body.classList.remove("modal-open");
  document.body.style.position=""; document.body.style.top=""; document.body.style.left=""; document.body.style.right=""; document.body.style.width=""; document.body.style.paddingRight="";
  window.scrollTo(0,state.modalScrollY);
}
function schedulePageScrollUnlock(){ setTimeout(unlockPageScrollIfPossible,0); }
function closeAppDialog(dialog){
  if (!dialog?.open) return;
  dialog.close();
  // dialog close events can fire before Chromium has fully cleared the open state.
  // Re-check synchronously after close() returns, plus the scheduled close-event fallback.
  unlockPageScrollIfPossible();
}
function showAppDialog(dialog){
  if (!dialog || dialog.open) return;
  lockPageScroll();
  try { dialog.showModal(); } catch (error) { unlockPageScrollIfPossible(); throw error; }
}
function closeAllDialogs(){ $$("dialog[open]").forEach((dialog) => dialog.close()); }
function confirmAction({ title="Konfirmasi", message="", confirmText="Lanjutkan", danger=false, eyebrow="KONFIRMASI" }={}){
  if (state.confirmResolve) resolveConfirm(false);
  els.confirmEyebrow.textContent = eyebrow;
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmOkBtn.textContent = confirmText;
  els.confirmOkBtn.className = danger ? "btn btn--danger-quiet" : "btn btn--primary";
  showAppDialog(els.confirmDialog);
  return new Promise((resolve) => { state.confirmResolve = resolve; });
}
function resolveConfirm(value){
  const resolve = state.confirmResolve; state.confirmResolve = null;
  if (els.confirmDialog.open) closeAppDialog(els.confirmDialog);
  resolve?.(Boolean(value));
}

async function loadItems({ startup=false }={}){
  if (els.appShell.hidden) return;
  if (!navigator.onLine) {
    hideLoading();
    const used = loadCachedItems();
    if (!used) { state.items=[]; updateCategoryOptions(); renderItems(); }
    els.resultInfo.textContent = used ? `${state.items.length} barang • data offline tersimpan` : "Offline • belum ada data tersimpan";
    return;
  }
  try {
    if (!state.db) await connectSupabase();
    if (!state.db) throw new Error("Supabase belum tersambung.");
    if (!startup) showLoading();
    els.refreshBtn.disabled = true;
    const query = state.db.from(TABLE_NAME).select("*").order("created_at", { ascending:false });
    const { data, error } = await withTimeout(query, NETWORK_TIMEOUT, "Supabase tidak merespons.");
    if (error) throw error;
    state.allItems = Array.isArray(data) ? data : [];
    state.items = state.allItems.filter((item) => !item.diarsipkan_at);
    state.archivedItems = state.allItems.filter((item) => Boolean(item.diarsipkan_at));
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.items));
    const syncedAt = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, syncedAt);
    updateLastSyncLabel(syncedAt);
    updateCategoryOptions();
    renderItems();
  } catch (error) {
    console.error("loadItems:", error);
    const used = loadCachedItems();
    showToast(used ? "Menampilkan cache" : "Gagal mengambil data", used ? "Supabase tidak dapat diakses. Data terakhir ditampilkan." : friendlyError(error), used ? "warning" : "error");
  } finally {
    hideLoading();
    els.refreshBtn.disabled = false;
  }
}
function loadCachedItems(){
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    if (!Array.isArray(parsed)) return false;
    state.items = parsed;
    state.allItems = parsed;
    state.archivedItems = [];
    updateCategoryOptions();
    renderItems();
    updateLastSyncLabel();
    return parsed.length > 0;
  } catch { return false; }
}
function updateLastSyncLabel(iso=localStorage.getItem(LAST_SYNC_KEY)){
  if (!iso) { els.lastSync.textContent = navigator.onLine ? "Belum disinkronkan" : "Offline • belum pernah sinkron"; return; }
  const date = new Date(iso);
  els.lastSync.textContent = `${navigator.onLine ? "Sinkron terakhir" : "Data cache dari"} ${date.toLocaleString("id-ID", { dateStyle:"medium", timeStyle:"short" })}`;
}
function showLoading(){ els.loadingState.hidden=false; els.inventoryList.hidden=true; els.emptyState.hidden=true; els.noResultState.hidden=true; }
function hideLoading(){ els.loadingState.hidden=true; els.inventoryList.hidden=false; }

function normalizeCodeSearch(value){ return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,""); }
function getFilteredItems(){
  const keyword = els.searchInput.value.trim().toLowerCase();
  const codeKeyword = normalizeCodeSearch(keyword);
  const category = els.categoryFilter.value;
  const stockMode = els.stockFilter.value;
  const sortMode = els.sortFilter.value;
  let result = state.items.filter((item) => {
    const code = String(item.kode_barang||"");
    const text = [item.nama_barang,item.kategori,item.supplier,item.lokasi,item.satuan,item.kondisi].filter(Boolean).join(" ").toLowerCase();
    const matchesKeyword = !keyword || text.includes(keyword) || normalizeCodeSearch(code).includes(codeKeyword);
    const matchesCategory = !category || item.kategori === category;
    const stock = Number(item.stok||0);
    const matchesStock = !stockMode || (stockMode === "available" && stock > LOW_STOCK_LIMIT) || (stockMode === "low" && stock > 0 && stock <= LOW_STOCK_LIMIT) || (stockMode === "empty" && stock === 0);
    return matchesKeyword && matchesCategory && matchesStock;
  });
  const sorters = {
    newest:(a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0),
    "name-asc":(a,b)=>String(a.nama_barang||"").localeCompare(String(b.nama_barang||""),"id"),
    "stock-asc":(a,b)=>Number(a.stok||0)-Number(b.stok||0),
    "stock-desc":(a,b)=>Number(b.stok||0)-Number(a.stok||0),
    "price-desc":(a,b)=>Number(b.harga||0)-Number(a.harga||0),
  };
  result.sort(sorters[sortMode] || sorters.newest);
  return result;
}
function getPaginationMeta(totalItems, requestedPage){
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
  const start = totalItems ? (page - 1) * PAGE_SIZE : 0;
  const end = Math.min(start + PAGE_SIZE, totalItems);
  return { page, totalPages, start, end };
}
function renderItems(){
  updateStatsAndCharts();
  const filtered = getFilteredItems();
  const meta = getPaginationMeta(filtered.length, state.inventoryPage);
  state.inventoryPage = meta.page;
  const pageItems = filtered.slice(meta.start, meta.end);
  els.inventoryRows.innerHTML = "";
  els.emptyState.hidden = state.items.length !== 0;
  els.noResultState.hidden = state.items.length === 0 || filtered.length !== 0;
  els.inventoryList.hidden = filtered.length === 0;
  if (state.items.length === 0) {
    els.resultInfo.textContent = "Belum ada barang";
  } else if (filtered.length === 0) {
    els.resultInfo.textContent = `0 dari ${state.items.length} barang`;
  } else {
    const filteredNote = filtered.length !== state.items.length ? ` • ${state.items.length} total` : "";
    els.resultInfo.textContent = `Menampilkan ${meta.start + 1}–${meta.end} dari ${filtered.length} barang${filteredNote}`;
  }
  const fragment = document.createDocumentFragment();
  pageItems.forEach((item) => fragment.append(createInventoryRow(item)));
  els.inventoryRows.append(fragment);
  hydrateItemImages(els.inventoryRows, pageItems);
  renderInventoryPagination(filtered.length, meta);
  updateMobileFilterUI();
}
function renderInventoryPagination(totalItems, meta=getPaginationMeta(totalItems,state.inventoryPage)){
  const show = totalItems > PAGE_SIZE;
  els.inventoryPagination.hidden = !show;
  if (!show) return;
  els.inventoryPageInfo.textContent = `${meta.start + 1}–${meta.end} dari ${totalItems} • Halaman ${meta.page} dari ${meta.totalPages}`;
  els.inventoryPrevBtn.disabled = meta.page <= 1;
  els.inventoryNextBtn.disabled = meta.page >= meta.totalPages;
}
function changeInventoryPage(delta){
  const filtered = getFilteredItems();
  const meta = getPaginationMeta(filtered.length, state.inventoryPage + delta);
  if (meta.page === state.inventoryPage) return;
  state.inventoryPage = meta.page;
  renderItems();
  els.inventoryToolbar.scrollIntoView({ behavior:"smooth", block:"start" });
}
function createInventoryRow(item){
  const row = document.createElement("div");
  row.className = "inventory-row";
  row.dataset.id = item.id;
  const stock = Number(item.stok||0);
  const stockClass = stock === 0 ? "is-empty" : stock <= LOW_STOCK_LIMIT ? "is-low" : "";
  row.innerHTML = `
    <div class="inventory-item-main">
      ${(item.gambar_url || item.gambar_path) ? `<button type="button" class="inventory-thumb inventory-thumb--image" data-action="image" title="Lihat gambar" aria-label="Lihat gambar ${escapeAttr(item.nama_barang)}"><img data-item-image="${escapeAttr(item.id)}" alt="${escapeAttr(item.nama_barang)}" loading="lazy" /></button>` : `<div class="inventory-thumb" aria-hidden="true">□</div>`}
      <div class="inventory-name"><strong title="${escapeAttr(item.nama_barang)}">${escapeHtml(item.nama_barang)}</strong><span>${escapeHtml(item.kode_barang)}</span></div>
    </div>
    <div class="inventory-cell">${escapeHtml(item.kategori)}</div>
    <div class="inventory-cell"><span class="stock-text ${stockClass}"><i></i>${stock.toLocaleString("id-ID")} ${escapeHtml(item.satuan)}</span></div>
    <div class="inventory-cell">${formatRupiah(item.harga)}</div>
    <div class="inventory-cell">${escapeHtml(item.lokasi || "-")}</div>
    <div class="row-actions">
      <button type="button" data-action="detail" title="Detail" aria-label="Detail ${escapeAttr(item.nama_barang)}">⌕</button>
      <button type="button" data-action="edit" title="Edit" aria-label="Edit ${escapeAttr(item.nama_barang)}">✎</button>
      <button type="button" data-action="delete" title="Hapus" aria-label="Hapus ${escapeAttr(item.nama_barang)}">×</button>
    </div>`;
  return row;
}
function handleInventoryAction(event){
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest(".inventory-row");
  const id = row?.dataset.id;
  if (!id) return;
  const action = button.dataset.action;
  if (action === "image") {
    const img=button.querySelector("img");
    openImageViewer(id,img?.currentSrc||img?.src||null);
  }
  if (action === "detail") openDetail(id);
  if (action === "edit") openEditForm(id);
  if (action === "delete") deleteItem(id);
}
function handleInventoryFilterChange(){ state.inventoryPage=1; renderItems(); updateMobileFilterUI(); }
function getActiveInventoryFilterCount(){ return [els.categoryFilter.value,els.stockFilter.value,els.sortFilter.value !== "newest" ? els.sortFilter.value : ""].filter(Boolean).length; }
function updateMobileFilterUI(){
  const count = getActiveInventoryFilterCount();
  els.mobileFilterCount.hidden = count === 0;
  els.mobileFilterCount.textContent = String(count);
}
function toggleMobileFilters(){
  const open = !els.inventoryToolbar.classList.contains("is-filter-open");
  els.inventoryToolbar.classList.toggle("is-filter-open", open);
  els.mobileFilterToggle.setAttribute("aria-expanded", open ? "true" : "false");
}
function clearFilters(){ els.categoryFilter.value=""; els.stockFilter.value=""; els.sortFilter.value="newest"; state.inventoryPage=1; renderItems(); }
function updateCategoryOptions(){
  const current = els.categoryFilter.value;
  const categories = getCategoryNames();
  els.categoryFilter.innerHTML = `<option value="">Semua kategori</option>${categories.map((name)=>`<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if (categories.includes(current)) els.categoryFilter.value = current;
  updateCategoryDatalist(categories);
}

function updateStatsAndCharts(){
  const totalStock = state.items.reduce((sum,item)=>sum+Number(item.stok||0),0);
  const totalValue = state.items.reduce((sum,item)=>sum+Number(item.stok||0)*Number(item.harga||0),0);
  const low = state.items.filter((item)=>Number(item.stok||0)<=LOW_STOCK_LIMIT).length;
  els.statJenis.textContent = state.items.length.toLocaleString("id-ID");
  els.statStok.textContent = totalStock.toLocaleString("id-ID");
  els.statNilai.textContent = formatCompactRupiah(totalValue);
  els.statNilai.title = formatRupiah(totalValue);
  els.statMenipis.textContent = low.toLocaleString("id-ID");
  els.analyticsCaption.textContent = state.items.length ? `${state.items.length} jenis barang` : "Belum ada data";

  const byCategory = new Map();
  state.items.forEach((item)=>{
    const key = item.kategori || "Tanpa kategori";
    const bucket = byCategory.get(key) || { count:0, value:0 };
    bucket.count += 1;
    bucket.value += Number(item.harga||0)*Number(item.stok||0);
    byCategory.set(key,bucket);
  });
  renderBarChart(els.chartCategoryCount, [...byCategory.entries()].map(([label,v])=>({label,value:v.count,text:v.count.toLocaleString("id-ID")})), false);
  renderBarChart(els.chartCategoryValue, [...byCategory.entries()].map(([label,v])=>({label,value:v.value,text:formatCompactRupiah(v.value)})), true);

  const safe = state.items.filter((item)=>Number(item.stok||0)>LOW_STOCK_LIMIT).length;
  const lowOnly = state.items.filter((item)=>Number(item.stok||0)>0 && Number(item.stok||0)<=LOW_STOCK_LIMIT).length;
  const empty = state.items.filter((item)=>Number(item.stok||0)===0).length;
  const total = state.items.length;
  const safeDeg = total ? safe/total*360 : 0;
  const lowDeg = total ? (safe+lowOnly)/total*360 : 0;
  els.stockDonut.style.setProperty("--safe",`${safeDeg}deg`);
  els.stockDonut.style.setProperty("--low",`${lowDeg}deg`);
  if (!total) els.stockDonut.style.background = "var(--surface-3)"; else els.stockDonut.style.background = "";
  els.stockDonutTotal.textContent = String(total);
  els.stockLegend.innerHTML = [
    ["Aman",safe,"var(--success)"],["Menipis",lowOnly,"var(--warning)"],["Habis",empty,"var(--danger)"]
  ].map(([label,value,color])=>`<div class="legend-row"><i style="background:${color}"></i><span>${label}</span><strong>${value}</strong></div>`).join("");
}
function renderBarChart(container, entries, isMoney){
  if (!entries.length) { container.innerHTML = `<div class="chart-empty">Belum ada data</div>`; return; }
  entries.sort((a,b)=>b.value-a.value);
  const top = entries.slice(0,6);
  if (entries.length > 6) {
    const rest = entries.slice(6).reduce((sum,row)=>sum+row.value,0);
    top.push({ label:"Lainnya", value:rest, text:isMoney ? formatCompactRupiah(rest) : rest.toLocaleString("id-ID") });
  }
  const max = Math.max(...top.map((row)=>row.value),1);
  container.innerHTML = top.map((row)=>`<div class="bar-row"><span class="bar-row__label" title="${escapeAttr(row.label)}">${escapeHtml(row.label)}</span><div class="bar-row__track"><div class="bar-row__fill" style="width:${Math.max(2,row.value/max*100)}%"></div></div><span class="bar-row__value">${escapeHtml(row.text)}</span></div>`).join("");
}

function normalizeCategoryKey(value){ return String(value||"").trim().toLowerCase().replace(/\s+/g," "); }
function getCategoryNames(){
  const map = new Map();
  [...DEFAULT_CATEGORIES,...state.items.map((item)=>item.kategori)].filter(Boolean).forEach((name)=>{ const clean=String(name).trim(); const key=normalizeCategoryKey(clean); if (!map.has(key)) map.set(key,clean); });
  return [...map.values()].sort((a,b)=>a.localeCompare(b,"id"));
}
function updateCategoryDatalist(categories=getCategoryNames()){
  els.kategoriList.innerHTML = categories.map((name)=>`<option value="${escapeAttr(name)}"></option>`).join("");
}
function levenshteinDistance(a,b){
  const left=String(a), right=String(b); if (!left.length) return right.length; if (!right.length) return left.length;
  let prev=Array.from({length:right.length+1},(_,i)=>i);
  for(let i=1;i<=left.length;i++){
    const curr=[i];
    for(let j=1;j<=right.length;j++) curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(left[i-1]===right[j-1]?0:1));
    prev=curr;
  }
  return prev[right.length];
}
function findExactCategory(value){ const key=normalizeCategoryKey(value); return getCategoryNames().find((name)=>normalizeCategoryKey(name)===key) || null; }
function findSimilarCategory(value){
  const key=normalizeCategoryKey(value); if (key.length < 4) return null;
  let best=null;
  for(const name of getCategoryNames()){
    const candidate=normalizeCategoryKey(name); if (candidate===key) continue;
    const distance=levenshteinDistance(key,candidate); const maxLen=Math.max(key.length,candidate.length); const similarity=1-distance/maxLen;
    if ((distance<=1 || similarity>=.84) && (!best || similarity>best.similarity)) best={name,similarity,distance};
  }
  return best;
}
function resetCategoryAssistant(){ state.categorySuggestion=null; els.categoryAssist.hidden=true; els.categoryAssistText.textContent=""; }
function renderCategoryAssistant(){
  const value=els.kategori.value.trim(); const similar=findSimilarCategory(value);
  if (!similar || state.categoryOverrideKey===normalizeCategoryKey(value)) { resetCategoryAssistant(); return; }
  state.categorySuggestion=similar;
  els.categoryAssistText.textContent = `“${value}” sangat mirip dengan “${similar.name}”. Pastikan ini bukan typo.`;
  els.categoryAssist.hidden=false;
}
function handleCategoryInput(){ state.categoryOverrideKey=null; renderCategoryAssistant(); syncGeneratedCode(); validateField(els.kategori); updateSaveAvailability(); }
function handleCategoryCommit(){
  const exact=findExactCategory(els.kategori.value); if (exact) els.kategori.value=exact;
  renderCategoryAssistant(); syncGeneratedCode(); validateField(els.kategori,{force:true}); updateSaveAvailability();
}
function useSuggestedCategory(){ if (!state.categorySuggestion) return; els.kategori.value=state.categorySuggestion.name; state.categoryOverrideKey=null; resetCategoryAssistant(); syncGeneratedCode(); validateField(els.kategori,{force:true}); updateSaveAvailability(); }
function keepNewCategory(){ const key=normalizeCategoryKey(els.kategori.value); if (!key) return; state.categoryOverrideKey=key; resetCategoryAssistant(); syncGeneratedCode(); validateField(els.kategori,{force:true}); updateSaveAvailability(); showToast("Kategori baru", "Prefix kode dipisahkan dari kategori yang mirip.", "success"); }
function extractCodePrefix(code){ const match=String(code||"").trim().toUpperCase().match(/^([A-Z0-9]{2,6})[\s-]*\d+$/); return match?.[1] || null; }
function getPrefixCategoryKeys(prefix){
  const p=String(prefix||"").toUpperCase(); const keys=new Set();
  (state.allItems.length ? state.allItems : state.items).forEach((item)=>{ if (extractCodePrefix(item.kode_barang)===p) keys.add(normalizeCategoryKey(item.kategori)); });
  return [...keys];
}
function isPrefixAvailableForCategory(prefix, categoryKey){ const owners=getPrefixCategoryKeys(prefix).filter(Boolean); return owners.length===0 || (owners.length===1 && owners[0]===categoryKey); }
function getStoredPrefixForCategory(category){
  const key=normalizeCategoryKey(category); const counts=new Map();
  (state.allItems.length ? state.allItems : state.items).forEach((item)=>{ if (normalizeCategoryKey(item.kategori)!==key) return; const p=extractCodePrefix(item.kode_barang); if (p) counts.set(p,(counts.get(p)||0)+1); });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}
function getBaseCategoryPrefix(category){
  const key=normalizeCategoryKey(category); if (CATEGORY_PREFIX_MAP[key]) return CATEGORY_PREFIX_MAP[key];
  const words=key.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(Boolean);
  if (!words.length) return "BRG";
  if (words.length>=2) return (words[0].slice(0,2)+words[1].slice(0,1)).toUpperCase().padEnd(3,"X");
  return words[0].slice(0,3).toUpperCase().padEnd(3,"X");
}
function buildPrefixCandidates(category){
  const clean=normalizeCategoryKey(category).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"").toUpperCase();
  const base=getBaseCategoryPrefix(category); const set=new Set([base]);
  for(let i=2;i<clean.length;i++) set.add((clean.slice(0,2)+clean[i]).slice(0,3).padEnd(3,"X"));
  for(let i=1;i<clean.length-1;i++) set.add((clean[0]+clean[i]+clean[i+1]).slice(0,3).padEnd(3,"X"));
  for(let n=1;n<=99;n++) set.add(`${base.slice(0,2)}${String(n).padStart(2,"0")}`);
  return [...set];
}
function getCategoryPrefix(category){
  const key=normalizeCategoryKey(category); if (!key) return "BRG";
  const stored=getStoredPrefixForCategory(category); if (stored && isPrefixAvailableForCategory(stored,key)) return stored;
  return buildPrefixCandidates(category).find((p)=>isPrefixAvailableForCategory(p,key)) || `C${Math.abs(hashString(key)).toString(36).toUpperCase().slice(0,4)}`;
}
function getNextCodeForCategory(category, excludeId=null){
  const prefix=getCategoryPrefix(category); let max=0;
  (state.allItems.length ? state.allItems : state.items).forEach((item)=>{ if (item.id===excludeId) return; if (normalizeCategoryKey(item.kategori)!==normalizeCategoryKey(category)) return; const match=String(item.kode_barang||"").toUpperCase().match(new RegExp(`^${escapeRegExp(prefix)}[\\s-]*(\\d+)$`)); if (match) max=Math.max(max,Number(match[1])||0); });
  return `${prefix} ${String(max+1).padStart(3,"0")}`;
}
function syncGeneratedCode(){
  const category=els.kategori.value.trim();
  if (!category) { els.kodeBarang.value=""; els.codeHelp.textContent="Pilih kategori untuk membuat kode otomatis."; return; }
  if (state.editingId && normalizeCategoryKey(category)===normalizeCategoryKey(state.editingOriginalCategory)) {
    const item=state.items.find((row)=>row.id===state.editingId); els.kodeBarang.value=item?.kode_barang||""; els.codeHelp.textContent="Kode dipertahankan selama kategori tidak berubah."; return;
  }
  els.kodeBarang.value=getNextCodeForCategory(category,state.editingId);
  els.codeHelp.textContent=`Prefix kategori: ${getCategoryPrefix(category)}`;
}
function hashString(value){ let hash=0; for(const ch of String(value)) hash=((hash<<5)-hash)+ch.charCodeAt(0)|0; return hash; }
function escapeRegExp(value){ return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

function resetFormState(){
  state.editingId=null; state.oldImagePath=null; state.selectedFile=null; state.editingOriginalCategory=null; state.categorySuggestion=null; state.categoryOverrideKey=null; state.imageValidationError=""; touchedFields.clear();
  els.itemForm.reset();
  els.kondisi.value="Baik";
  els.kodeBarang.value="";
  setImagePreview(null);
  resetCategoryAssistant();
  clearValidation();
}
function openAddForm(){
  if (!ensureCanWrite()) return;
  resetFormState();
  els.formEyebrow.textContent="CREATE"; els.formTitle.textContent="Tambah Barang"; els.saveBtnText.textContent="Simpan Barang";
  syncGeneratedCode(); updateSaveAvailability(); showAppDialog(els.formDialog); setTimeout(()=>els.namaBarang.focus(),80);
}
function openEditForm(id){
  if (!ensureCanWrite()) return;
  const item=state.items.find((row)=>row.id===id); if (!item) return;
  resetFormState();
  state.editingId=id; state.oldImagePath=item.gambar_path||null; state.editingOriginalCategory=item.kategori;
  els.formEyebrow.textContent="UPDATE"; els.formTitle.textContent="Edit Barang"; els.saveBtnText.textContent="Simpan Perubahan";
  els.namaBarang.value=item.nama_barang||""; els.kategori.value=item.kategori||""; els.kodeBarang.value=item.kode_barang||""; els.harga.value=String(Number(item.harga||0)); els.stok.value=String(Number(item.stok||0)); els.satuan.value=item.satuan||""; els.supplier.value=item.supplier||""; els.kondisi.value=ALLOWED_CONDITIONS.includes(item.kondisi)?item.kondisi:"Baik"; els.lokasi.value=item.lokasi||"";
  setImagePreview(item.gambar_url||null,item); syncGeneratedCode(); updateSaveAvailability(); showAppDialog(els.formDialog);
}
function getLiveValidationFields(){ return [els.namaBarang,els.kategori,els.kodeBarang,els.harga,els.stok,els.satuan,els.supplier,els.lokasi].filter(Boolean); }
function getFieldIssue(input){
  const value=String(input?.value??"").trim();
  const requiredMessages={namaBarang:"Nama barang wajib diisi.",kategori:"Kategori wajib diisi.",kodeBarang:"Kode barang wajib tersedia.",harga:"Harga wajib diisi.",stok:"Stok wajib diisi.",satuan:"Satuan wajib diisi.",supplier:"Supplier wajib diisi."};
  if (input.required && !value) return { type:"error", blocking:true, message:requiredMessages[input.id]||"Field ini wajib diisi." };
  if (input.maxLength>0 && value.length>input.maxLength) return { type:"error", blocking:true, message:`Maksimal ${input.maxLength} karakter.` };
  if (input===els.kategori && value){
    const similar=findSimilarCategory(value); if (similar && state.categoryOverrideKey!==normalizeCategoryKey(value)) return {type:"warning",blocking:true,message:`Mirip dengan “${similar.name}”. Pilih yang ada atau konfirmasi kategori baru.`};
  }
  if (input===els.harga && value){
    const n=Number(value); if (!Number.isFinite(n)) return {type:"error",blocking:true,message:"Masukkan harga yang valid."}; if (n<0) return {type:"error",blocking:true,message:"Harga tidak boleh negatif."}; if (!Number.isInteger(n)) return {type:"error",blocking:true,message:"Harga harus bilangan bulat rupiah."}; if (n>MAX_PRICE_RUPIAH) return {type:"error",blocking:true,message:`Maksimal ${formatRupiah(MAX_PRICE_RUPIAH)}.`}; if (n>=LARGE_PRICE_WARNING) return {type:"warning",blocking:false,message:`Nilai besar: ${formatRupiah(n)}. Pastikan digit benar.`};
  }
  if (input===els.stok && value){
    const n=Number(value); if (!Number.isInteger(n)||n<0) return {type:"error",blocking:true,message:"Stok harus bilangan bulat 0 atau lebih."}; if (n>MAX_STOCK) return {type:"error",blocking:true,message:`Maksimal ${MAX_STOCK.toLocaleString("id-ID")}.`}; if (n>=LARGE_STOCK_WARNING) return {type:"warning",blocking:false,message:`Stok sangat besar: ${n.toLocaleString("id-ID")}. Pastikan digit benar.`};
  }
  return null;
}
function validateField(input,{force=false}={}){
  const issue=getFieldIssue(input); const hasValue=String(input?.value??"").trim()!==""; const show=force||touchedFields.has(input.id)||hasValue;
  clearFieldFeedback(input); if (!issue||!show) return !issue?.blocking; setFieldFeedback(input,issue.message,issue.type,issue.blocking); if (input===els.kategori&&issue.blocking) renderCategoryAssistant(); return !issue.blocking;
}
function validateForm(){
  let valid=true; getLiveValidationFields().forEach((input)=>{ touchedFields.add(input.id); if(!validateField(input,{force:true})) valid=false; });
  if(state.imageValidationError){ setImageFeedback(state.imageValidationError,"error"); valid=false; }
  updateSaveAvailability(); if(!valid){ const first=els.itemForm.querySelector("[data-validation-blocking='true']"); first?.scrollIntoView({block:"center",behavior:"smooth"}); first?.focus?.({preventScroll:true}); }
  return valid;
}
function setFieldFeedback(input,message,type="error",blocking=type==="error"){
  clearFieldFeedback(input); input.classList.add(type==="warning"?"is-warning":"is-invalid"); input.dataset.validationBlocking=blocking?"true":"false"; if(blocking) input.setAttribute("aria-invalid","true");
  const prefix=input.closest(".prefix-input"); prefix?.classList.add(type==="warning"?"has-warning":"has-error");
  const feedback=input.closest(".field")?.querySelector(".field-message"); if(feedback){ feedback.textContent=message; feedback.classList.toggle("is-warning",type==="warning"); }
}
function clearFieldFeedback(input){
  if(!input)return; input.classList.remove("is-invalid","is-warning"); input.removeAttribute("aria-invalid"); delete input.dataset.validationBlocking; const prefix=input.closest(".prefix-input"); prefix?.classList.remove("has-error","has-warning"); const feedback=input.closest(".field")?.querySelector(".field-message"); if(feedback){feedback.textContent="";feedback.classList.remove("is-warning");}
}
function clearValidation(){ getLiveValidationFields().forEach(clearFieldFeedback); setImageFeedback(""); }
function setImageFeedback(message,type="error"){ els.imageError.textContent=message||""; els.imageError.classList.toggle("is-warning",type==="warning"); }
function hasBlockingValidationIssue(){ return getLiveValidationFields().some((input)=>getFieldIssue(input)?.blocking)||Boolean(state.imageValidationError); }
function updateSaveAvailability(){
  if(!els.saveBtn)return; const blocked=state.isSaving||!navigator.onLine||!state.db||!state.user||hasBlockingValidationIssue(); els.saveBtn.disabled=blocked; els.saveBtn.title=!navigator.onLine?"Tidak dapat menyimpan saat offline.":!state.db?"Menunggu koneksi Supabase.":hasBlockingValidationIssue()?"Perbaiki field yang ditandai.":"";
}
function setSaving(value){ state.isSaving=value; els.saveBtnText.textContent=value?"Menyimpan...":state.editingId?"Simpan Perubahan":"Simpan Barang"; els.formDialog.querySelectorAll(".close-dialog").forEach((button)=>button.disabled=value); updateSaveAvailability(); }

async function handleSubmit(event){
  event.preventDefault(); if(!ensureCanWrite())return; if(!state.editingId&&!els.kodeBarang.value.trim())syncGeneratedCode(); if(!validateForm())return; setSaving(true); let uploadedPath=null;
  try{
    const duplicate=await isDuplicateCode(els.kodeBarang.value.trim(),state.editingId); if(duplicate){ setFieldFeedback(els.kodeBarang,"Kode barang sudah digunakan.","error",true); throw new Error("DUPLICATE_CODE"); }
    const current=state.editingId?state.items.find((item)=>item.id===state.editingId):null; let imageUrl=current?.gambar_url||null; let imagePath=current?.gambar_path||null;
    if(state.selectedFile){ const upload=await uploadImage(state.selectedFile); imageUrl=upload.publicUrl; imagePath=upload.path; uploadedPath=upload.path; }
    const payload={ kode_barang:els.kodeBarang.value.trim(),nama_barang:els.namaBarang.value.trim(),kategori:els.kategori.value.trim(),harga:Number(els.harga.value),stok:Number(els.stok.value),satuan:els.satuan.value.trim(),supplier:els.supplier.value.trim(),kondisi:els.kondisi.value,lokasi:els.lokasi.value.trim()||null,gambar_url:imageUrl,gambar_path:imagePath };
    let error; if(state.editingId)({error}=await state.db.from(TABLE_NAME).update(payload).eq("id",state.editingId)); else ({error}=await state.db.from(TABLE_NAME).insert(payload)); if(error)throw error;
    if(state.editingId&&state.selectedFile&&state.oldImagePath&&state.oldImagePath!==uploadedPath)await safeRemoveImage(state.oldImagePath);
    closeAppDialog(els.formDialog); showToast(state.editingId?"Barang diperbarui":"Barang ditambahkan",state.editingId?"Perubahan berhasil disimpan.":"Data baru berhasil disimpan.","success"); await loadItems();
  }catch(error){
    console.error("save:",error); if(uploadedPath)await safeRemoveImage(uploadedPath); const msg=String(error?.message||"");
    if(msg==="DUPLICATE_CODE"){} else if(/numeric field overflow|22003/i.test(msg)){setFieldFeedback(els.harga,`Maksimal ${formatRupiah(MAX_PRICE_RUPIAH)}.`,`error`,true);els.harga.focus();} else if(/integer out of range/i.test(msg)){setFieldFeedback(els.stok,`Maksimal ${MAX_STOCK.toLocaleString("id-ID")}.`,`error`,true);els.stok.focus();} else showToast("Gagal menyimpan",friendlyError(error),"error");
  }finally{setSaving(false);}
}
async function isDuplicateCode(code,excludeId=null){ let query=state.db.from(TABLE_NAME).select("id").eq("kode_barang",code).limit(1); if(excludeId)query=query.neq("id",excludeId); const {data,error}=await query;if(error)throw error;return Array.isArray(data)&&data.length>0; }
async function uploadImage(file){
  const extension=getSafeExtension(file.name,file.type); const path=`barang/${Date.now()}-${crypto.randomUUID()}.${extension}`; const {error}=await state.db.storage.from(BUCKET_NAME).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type}); if(error)throw error; const {data}=state.db.storage.from(BUCKET_NAME).getPublicUrl(path); return {path,publicUrl:data.publicUrl};
}
async function safeRemoveImage(path){ if(!path||!state.db)return; try{const {error}=await state.db.storage.from(BUCKET_NAME).remove([path]);if(error)console.warn("remove image:",error);}catch(error){console.warn("remove image:",error);} }
function handleImageSelection(){
  const file=els.gambar.files?.[0]||null; state.selectedFile=null; state.imageValidationError=""; setImageFeedback("");
  if(!file){ const currentItem=state.editingId?state.items.find((item)=>item.id===state.editingId):null; setImagePreview(currentItem?.gambar_url||null,currentItem); updateSaveAvailability(); return; }
  const allowed=new Set(["image/jpeg","image/png","image/webp"]); if(!allowed.has(file.type)){state.imageValidationError="Format harus JPG, PNG, atau WebP.";setImageFeedback(state.imageValidationError);els.gambar.value="";updateSaveAvailability();return;} if(file.size>MAX_IMAGE_SIZE){state.imageValidationError=`Ukuran maksimal ${formatFileSize(MAX_IMAGE_SIZE)}.`;setImageFeedback(state.imageValidationError);els.gambar.value="";updateSaveAvailability();return;}
  state.selectedFile=file; const reader=new FileReader(); reader.addEventListener("load",()=>setImagePreview(reader.result)); reader.readAsDataURL(file); setImageFeedback(`${file.name} • ${formatFileSize(file.size)}`,"success"); updateSaveAvailability();
}
function setImagePreview(src,item=null){
  els.imagePreview.classList.toggle("has-image",Boolean(src||item?.gambar_path));
  els.imagePreview.dataset.itemId=item?.id||"";
  if(!(src||item?.gambar_path)){ els.imagePreview.innerHTML=`<span>＋</span><small>Belum ada gambar</small>`; return; }
  els.imagePreview.innerHTML=`<img alt="Preview gambar barang" />`;
  const img=els.imagePreview.querySelector("img");
  if(item) bindResilientImage(img,item); else img.src=src;
}
function ensureCanWrite(){
  if(!state.user){showToast("Sesi tidak aktif","Silakan login kembali.","error");return false;} if(!navigator.onLine){showToast("Offline","Perubahan data memerlukan internet.","warning");return false;} if(!state.db){showToast("Belum tersambung","Tunggu koneksi Supabase siap.","warning");connectSupabase().then(updateSaveAvailability).catch(()=>{});return false;}return true;
}

function openDetail(id){
  const item=state.items.find((row)=>row.id===id); if(!item)return; const stock=Number(item.stok||0);
  const imageBlock=(item.gambar_url||item.gambar_path)?`<button type="button" class="detail-image detail-image--button" id="detailImageBtn" aria-label="Lihat gambar ${escapeAttr(item.nama_barang)}"><img data-item-image="${escapeAttr(item.id)}" alt="Gambar ${escapeAttr(item.nama_barang)}" /></button>`:`<div class="detail-image">□</div>`;
  els.detailContent.innerHTML=`<div class="detail-top">${imageBlock}<div class="detail-main"><span class="item-code">${escapeHtml(item.kode_barang)}</span><h3>${escapeHtml(item.nama_barang)}</h3><div class="detail-price">${formatRupiah(item.harga)}</div><div class="detail-grid">${detailCell("Kategori",item.kategori)}${detailCell("Stok",`${stock.toLocaleString("id-ID")} ${item.satuan}`)}${detailCell("Supplier",item.supplier)}${detailCell("Kondisi",item.kondisi||"-")}${detailCell("Lokasi",item.lokasi||"-")}${detailCell("Terakhir diubah",formatDate(item.updated_at))}</div></div></div><div class="detail-actions"><button id="detailEditBtn" class="btn btn--primary" type="button">Edit Barang</button></div>`;
  hydrateItemImages(els.detailContent,[item]);
  $("#detailImageBtn",els.detailContent)?.addEventListener("click",(event)=>{
    const img=event.currentTarget.querySelector("img");
    openImageViewer(id,img?.currentSrc||img?.src||null);
  });
  $("#detailEditBtn",els.detailContent).addEventListener("click",()=>{closeAppDialog(els.detailDialog);openEditForm(id);}); showAppDialog(els.detailDialog);
}
function findAnyItem(id){ return state.allItems.find((item)=>item.id===id)||state.items.find((item)=>item.id===id)||state.archivedItems.find((item)=>item.id===id)||null; }
async function getSignedImageUrl(path){
  if(!path||!state.db||!state.user||!navigator.onLine)return null;
  const cached=state.signedImageUrls.get(path);
  if(cached&&cached.expiresAt>Date.now()+60_000)return cached.url;
  try{
    const {data,error}=await withTimeout(state.db.storage.from(BUCKET_NAME).createSignedUrl(path,3600),NETWORK_TIMEOUT,"Gambar terlalu lama dimuat.");
    if(error)throw error; const url=data?.signedUrl||null; if(url)state.signedImageUrls.set(path,{url,expiresAt:Date.now()+55*60_000}); return url;
  }catch(error){ console.warn("signed image:",path,error); return null; }
}
function markBrokenImage(img){
  const holder=img?.closest?.(".inventory-thumb,.detail-image,.image-preview");
  if(holder){ holder.classList.add("is-broken"); holder.innerHTML="□"; }
}
function bindResilientImage(img,item){
  if(!img||!item)return;
  let fallbackTried=false;
  const trySigned=async()=>{
    if(fallbackTried)return; fallbackTried=true;
    const signed=await getSignedImageUrl(item.gambar_path);
    if(signed){ img.src=signed; return; }
    markBrokenImage(img);
  };
  img.addEventListener("error",()=>{ if(item.gambar_path)trySigned(); else markBrokenImage(img); },{once:false});
  if(item.gambar_url){ img.src=item.gambar_url; } else if(item.gambar_path){ trySigned(); } else { markBrokenImage(img); }
}
function hydrateItemImages(root,items){
  const map=new Map(items.map((item)=>[String(item.id),item]));
  root.querySelectorAll("img[data-item-image]").forEach((img)=>{ const item=map.get(img.dataset.itemImage)||findAnyItem(img.dataset.itemImage); if(item)bindResilientImage(img,item); });
}
function handleImagePreviewClick(){
  if(state.selectedFile){
    const previewImg=els.imagePreview.querySelector("img");
    const src=previewImg?.currentSrc||previewImg?.src; if(src)openStandaloneImageViewer(src,els.namaBarang.value.trim()||"Preview gambar"); return;
  }
  const id=els.imagePreview.dataset.itemId; if(id)openImageViewer(id);
}
async function openImageViewer(id,preferredSrc=null){
  const item=findAnyItem(id); if(!item||(!item.gambar_url&&!item.gambar_path&&!preferredSrc))return;
  const requestId=++state.imageViewerRequestId;
  els.imageViewerName.textContent=item.nama_barang||"Gambar barang";
  prepareImageViewer(item.nama_barang||"Gambar barang");
  showAppDialog(els.imageDialog);

  // Use the exact source that is already proven to render in the thumbnail/detail first.
  // This makes the viewer appear immediately instead of waiting for another Storage request.
  const immediate=preferredSrc||item.gambar_url||null;
  if(immediate){
    const loaded=await tryViewerSource(immediate,requestId);
    if(loaded)return;
  }

  // If the public/current URL fails, fall back to a fresh signed URL from gambar_path.
  if(item.gambar_path&&requestId===state.imageViewerRequestId){
    const signed=await getSignedImageUrl(item.gambar_path);
    if(signed&&signed!==immediate){
      const loaded=await tryViewerSource(signed,requestId);
      if(loaded)return;
    }
  }

  if(requestId===state.imageViewerRequestId)showImageViewerFallback();
}
function prepareImageViewer(name){
  els.imageViewerFallback.hidden=true;
  els.imageViewerImg.hidden=false;
  els.imageViewerImg.onload=null;
  els.imageViewerImg.onerror=null;
  els.imageViewerImg.removeAttribute("src");
  els.imageViewerImg.alt=`Gambar ${name||"barang"}`;
}
function tryViewerSource(src,requestId){
  return new Promise((resolve)=>{
    if(!src||requestId!==state.imageViewerRequestId){resolve(false);return;}
    const img=els.imageViewerImg;
    let settled=false;
    const finish=(ok)=>{if(settled)return;settled=true;img.onload=null;img.onerror=null;resolve(ok);};
    img.onload=()=>finish(requestId===state.imageViewerRequestId);
    img.onerror=()=>finish(false);
    img.hidden=false;
    img.src=src;
    if(img.complete&&img.naturalWidth>0)finish(true);
  });
}
async function openStandaloneImageViewer(src,name="Preview gambar"){
  const requestId=++state.imageViewerRequestId;
  els.imageViewerName.textContent=name;
  prepareImageViewer(name);
  showAppDialog(els.imageDialog);
  const loaded=await tryViewerSource(src,requestId);
  if(!loaded&&requestId===state.imageViewerRequestId)showImageViewerFallback();
}
function showImageViewerFallback(){ els.imageViewerImg.hidden=true; els.imageViewerFallback.hidden=false; }
function detailCell(label,value){return `<div class="detail-cell"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value??"-"))}</strong></div>`;}
async function deleteItem(id){
  if(!ensureCanWrite())return;
  const item=state.items.find((row)=>row.id===id);
  if(!item)return;
  try{
    const {count,error:referenceError}=await state.db.from("stok_opname_detail").select("id",{count:"exact",head:true}).eq("barang_id",id);
    if(referenceError)throw referenceError;
    if(Number(count||0)>0){
      const archive=await confirmAction({title:"Arsipkan barang?",message:`“${item.nama_barang}” (${item.kode_barang}) sudah tercatat pada riwayat stok opname sehingga tidak boleh dihapus permanen. Barang akan disembunyikan dari inventaris aktif, tetapi histori tetap utuh.`,confirmText:"Arsipkan",eyebrow:"ARSIP"});
      if(!archive)return;
      await archiveItem(item);
      return;
    }
    const ok=await confirmAction({title:"Hapus barang?",message:`“${item.nama_barang}” (${item.kode_barang}) belum memiliki riwayat stok opname dan akan dihapus permanen dari database.`,confirmText:"Hapus",danger:true,eyebrow:"HAPUS"});
    if(!ok)return;
    const {error}=await state.db.from(TABLE_NAME).delete().eq("id",id);
    if(error)throw error;
    if(item.gambar_path)await safeRemoveImage(item.gambar_path);
    showToast("Barang dihapus","Data dan gambar terkait telah dibersihkan.","success");
    await loadItems();
  }catch(error){
    const message=String(error?.message||"");
    if(/foreign key constraint|23503|stok_opname_detail_barang_id_fkey/i.test(message)){
      const archive=await confirmAction({title:"Arsipkan sebagai gantinya?",message:"Riwayat stok opname menggunakan barang ini, jadi penghapusan permanen ditolak database. Arsip menyembunyikan barang dari inventaris aktif tanpa merusak histori.",confirmText:"Arsipkan",eyebrow:"ARSIP"});
      if(archive)await archiveItem(item);
      return;
    }
    showToast("Gagal menghapus",friendlyError(error),"error");
  }
}
async function archiveItem(item){
  try{
    const {error}=await state.db.from(TABLE_NAME).update({diarsipkan_at:new Date().toISOString()}).eq("id",item.id);
    if(error)throw error;
    showToast("Barang diarsipkan",`${item.nama_barang} dipindahkan dari inventaris aktif. Riwayat stok opname dan gambar tetap disimpan.`,"success");
    await loadItems();
    if(els.dataDialog.open)await loadArchivedItems();
    return true;
  }catch(error){
    showToast("Gagal mengarsipkan",friendlyError(error),"error");
    return false;
  }
}
async function restoreArchivedItem(id){
  if(!ensureCanWrite())return;
  const item=state.archivedItems.find((row)=>row.id===id);
  if(!item)return;
  const ok=await confirmAction({title:"Pulihkan barang?",message:`“${item.nama_barang}” (${item.kode_barang}) akan kembali muncul di inventaris aktif.`,confirmText:"Pulihkan",eyebrow:"ARSIP"});
  if(!ok)return;
  try{
    const {error}=await state.db.from(TABLE_NAME).update({diarsipkan_at:null}).eq("id",id);
    if(error)throw error;
    showToast("Barang dipulihkan","Barang kembali ke inventaris aktif.","success");
    await loadItems();
    await loadArchivedItems();
  }catch(error){showToast("Gagal memulihkan",friendlyError(error),"error");}
}
async function openDataTools(){
  showAppDialog(els.dataDialog);
  if(navigator.onLine)loadArchivedItems();
  else{els.archiveList.hidden=true;els.archivePagination.hidden=true;setToolStatus(els.archiveStatus,"Arsip membutuhkan koneksi internet.","info");}
}
async function loadArchivedItems(){
  if(!navigator.onLine||!state.db){els.archiveList.hidden=true;els.archivePagination.hidden=true;setToolStatus(els.archiveStatus,"Arsip membutuhkan koneksi internet.","info");return;}
  els.refreshArchiveBtn.disabled=true;
  setToolStatus(els.archiveStatus,"Memuat arsip...","info");
  try{
    const {data,error}=await state.db.from(TABLE_NAME).select("*").not("diarsipkan_at","is",null).order("diarsipkan_at",{ascending:false});
    if(error)throw error;
    state.archivedItems=Array.isArray(data)?data:[];
    renderArchivedItems();
  }catch(error){
    els.archiveList.hidden=true;
    els.archivePagination.hidden=true;
    setToolStatus(els.archiveStatus,`Arsip gagal dimuat: ${friendlyError(error)}`,"error");
  }finally{els.refreshArchiveBtn.disabled=false;}
}
function renderArchivedItems(){
  const rows=state.archivedItems;
  const meta=getPaginationMeta(rows.length,state.archivePage);
  state.archivePage=meta.page;
  const pageRows=rows.slice(meta.start,meta.end);
  setToolStatus(els.archiveStatus,rows.length?`${rows.length} barang diarsipkan.`:"Tidak ada barang diarsipkan.","info");
  els.archiveList.hidden=rows.length===0;
  els.archiveList.innerHTML=pageRows.map((item)=>`<div class="archive-row" data-archive-id="${escapeAttr(item.id)}"><div class="archive-row__main"><strong>${escapeHtml(item.nama_barang)}</strong><span>${escapeHtml(item.kode_barang)} • ${escapeHtml(item.kategori)}</span></div><span class="archive-row__date">${item.diarsipkan_at?formatDate(item.diarsipkan_at):"-"}</span><button class="btn btn--small btn--secondary" type="button" data-archive-action="restore">Pulihkan</button></div>`).join("");
  renderArchivePagination(rows.length,meta);
}
function renderArchivePagination(totalItems,meta=getPaginationMeta(totalItems,state.archivePage)){
  const show=totalItems>PAGE_SIZE;
  els.archivePagination.hidden=!show;
  if(!show)return;
  els.archivePageInfo.textContent=`${meta.start+1}–${meta.end} dari ${totalItems} • Halaman ${meta.page} dari ${meta.totalPages}`;
  els.archivePrevBtn.disabled=meta.page<=1;
  els.archiveNextBtn.disabled=meta.page>=meta.totalPages;
}
function changeArchivePage(delta){
  const meta=getPaginationMeta(state.archivedItems.length,state.archivePage+delta);
  if(meta.page===state.archivePage)return;
  state.archivePage=meta.page;
  renderArchivedItems();
  els.archiveStatus.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function handleArchiveAction(event){
  const button=event.target.closest("[data-archive-action]");
  const row=button?.closest("[data-archive-id]");
  if(!button||!row)return;
  if(button.dataset.archiveAction==="restore")restoreArchivedItem(row.dataset.archiveId);
}

/* ========================= DATA TOOLS ========================= */
async function exportDataPackage(){
  const source = els.exportScope.value === "filtered" ? getFilteredItems() : state.items;
  if (!source.length) { setToolStatus(els.exportStatus,"Tidak ada data untuk diexport.","error"); return; }
  els.exportBtn.disabled = true;
  setToolStatus(els.exportStatus,"Menyiapkan paket export...","info");
  try {
    const files = [];
    const exportRows = [];
    const usedPaths = new Set();
    let imageDone = 0;
    let imageFailed = 0;
    const imageItems = source.filter((item)=>item.gambar_url);

    for (const item of source) {
      let imagePath = "";
      if (item.gambar_url) {
        const ext = getExtensionFromItem(item) || "jpg";
        const categoryDir = sanitizeFileName(item.kategori || "Tanpa Kategori");
        const baseName = sanitizeFileName(item.nama_barang || item.kode_barang || "gambar");
        imagePath = uniqueExportPath(`images/${categoryDir}/${baseName}.${ext}`, usedPaths);
        try {
          setToolStatus(els.exportStatus,`Mengambil gambar ${imageDone+1}/${imageItems.length}...`,"info");
          const response = await withTimeout(fetch(item.gambar_url,{cache:"force-cache"}), NETWORK_TIMEOUT, "Gambar terlalu lama diunduh.");
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          files.push({ path:imagePath, data:new Uint8Array(await response.arrayBuffer()) });
        } catch (error) {
          console.warn("export image:", item.gambar_url, error);
          imagePath = "";
          imageFailed += 1;
        }
        imageDone += 1;
      }
      exportRows.push({
        "Kode Barang":item.kode_barang,
        "Nama Barang":item.nama_barang,
        "Kategori":item.kategori,
        "Harga":Number(item.harga||0),
        "Stok":Number(item.stok||0),
        "Satuan":item.satuan,
        "Supplier":item.supplier,
        "Kondisi":item.kondisi||"Baik",
        "Lokasi":item.lokasi||"",
        "Gambar File":imagePath,
      });
    }

    const format = els.exportFormat.value;
    const dataFile = format === "csv"
      ? { path:"inventaris.csv", data:buildCsvBytes(exportRows) }
      : { path:"inventaris.xlsx", data:buildXlsxBytes(exportRows) };
    files.unshift(dataFile);
    setToolStatus(els.exportStatus,"Menyusun ZIP...","info");
    const zipBytes = buildZip(files);
    const stamp = new Date().toISOString().replace(/[:T]/g,"-").slice(0,19);
    downloadBlob(new Blob([zipBytes],{type:"application/zip"}),`InventarisKu-Export-${stamp}.zip`);
    setToolStatus(els.exportStatus,`Export selesai: ${source.length} data${imageFailed?`, ${imageFailed} gambar gagal diambil`:""}.`,imageFailed?"warning":"success");
  } catch (error) {
    console.error("export:",error);
    setToolStatus(els.exportStatus,`Export gagal: ${friendlyError(error)}`,"error");
  } finally { els.exportBtn.disabled=false; }
}

function getExtensionFromItem(item){
  const source=String(item.gambar_path||item.gambar_url||"").split("?")[0]; const match=source.match(/\.([a-zA-Z0-9]{2,5})$/); const ext=match?.[1]?.toLowerCase(); return ["jpg","jpeg","png","webp"].includes(ext)?ext:null;
}
function sanitizeFileName(value){
  const clean=String(value||"").normalize("NFKD").replace(/[<>:"/\\|?*\x00-\x1F]/g," ").replace(/\s+/g," ").trim().replace(/[. ]+$/g,""); return (clean||"Tanpa Nama").slice(0,90);
}
function uniqueExportPath(path,used){
  if(!used.has(path)){used.add(path);return path;} const dot=path.lastIndexOf("."); const base=dot>=0?path.slice(0,dot):path; const ext=dot>=0?path.slice(dot):""; let n=2; let candidate; do{candidate=`${base} (${n++})${ext}`;}while(used.has(candidate));used.add(candidate);return candidate;
}
function setToolStatus(element,message,type="info"){ element.textContent=message||""; element.className=`tool-status${type==="error"?" is-error":type==="success"?" is-success":""}`; }

function buildCsvBytes(rows){
  const headers=Object.keys(rows[0]||{}); const lines=[headers.map(csvEscape).join(",")];
  rows.forEach((row)=>lines.push(headers.map((header)=>csvEscape(row[header])).join(",")));
  return new TextEncoder().encode("\uFEFF"+lines.join("\r\n"));
}
function csvEscape(value){ const text=String(value??""); return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text; }
function parseCsv(text){
  text=String(text||"").replace(/^\uFEFF/,"");
  const firstLine=text.split(/\r?\n/,1)[0]||"";
  const countOutsideQuotes=(delimiter)=>{let count=0,quoted=false;for(let i=0;i<firstLine.length;i++){const ch=firstLine[i];if(ch==='"'){if(quoted&&firstLine[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&ch===delimiter)count++;}return count;};
  const delimiter=[[",",countOutsideQuotes(",")],[";",countOutsideQuotes(";")],["\t",countOutsideQuotes("\t")]].sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[]; let cell=""; let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){ if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;} else if(ch==='"')quoted=false; else cell+=ch; }
    else if(ch==='"')quoted=true; else if(ch===delimiter){row.push(cell);cell="";} else if(ch==='\n'){row.push(cell.replace(/\r$/,"") );rows.push(row);row=[];cell="";} else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,"") );rows.push(row);} return rows;
}

function buildXlsxBytes(rows){
  const headers=Object.keys(rows[0]||{}); const all=[headers,...rows.map((row)=>headers.map((h)=>row[h]))];
  const sheetRows=all.map((row,rowIndex)=>{
    const cells=row.map((value,colIndex)=>{
      const ref=`${columnName(colIndex+1)}${rowIndex+1}`;
      if(rowIndex>0 && (headers[colIndex]==="Harga"||headers[colIndex]==="Stok") && Number.isFinite(Number(value))) return `<c r="${ref}"${headers[colIndex]==="Harga"?' s="2"':''}><v>${Number(value)}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${rowIndex===0?' s="1"':''}><is><t xml:space="preserve">${xmlEscape(String(value??""))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex+1}">${cells}</row>`;
  }).join("");
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(headers.length)}${all.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${columnName(headers.length)}${all.length}"/></worksheet>`;
  const files=[
    {path:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {path:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {path:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventaris" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {path:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {path:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`},
    {path:"xl/worksheets/sheet1.xml",data:sheet},
  ];
  return buildZip(files);
}
function columnName(number){ let out=""; while(number>0){number--;out=String.fromCharCode(65+(number%26))+out;number=Math.floor(number/26);} return out; }
function xmlEscape(value){ return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }

const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
function toBytes(data){ if(data instanceof Uint8Array)return data; if(data instanceof ArrayBuffer)return new Uint8Array(data); return new TextEncoder().encode(String(data)); }
function writeU16(view,offset,value){view.setUint16(offset,value,true);} function writeU32(view,offset,value){view.setUint32(offset,value>>>0,true);}
function dosDateTime(date=new Date()){const year=Math.max(1980,date.getFullYear());return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};}
function concatBytes(parts){const size=parts.reduce((s,p)=>s+p.length,0);const out=new Uint8Array(size);let o=0;parts.forEach((p)=>{out.set(p,o);o+=p.length;});return out;}
function buildZip(files){
  const encoder=new TextEncoder(); const localParts=[]; const centralParts=[]; let offset=0; const dt=dosDateTime();
  for(const file of files){
    const name=encoder.encode(file.path.replace(/^\/+/,"")); const data=toBytes(file.data); const crc=crc32(data);
    const local=new Uint8Array(30+name.length); const lv=new DataView(local.buffer); writeU32(lv,0,0x04034b50);writeU16(lv,4,20);writeU16(lv,6,0x0800);writeU16(lv,8,0);writeU16(lv,10,dt.time);writeU16(lv,12,dt.date);writeU32(lv,14,crc);writeU32(lv,18,data.length);writeU32(lv,22,data.length);writeU16(lv,26,name.length);writeU16(lv,28,0);local.set(name,30); localParts.push(local,data);
    const central=new Uint8Array(46+name.length); const cv=new DataView(central.buffer);writeU32(cv,0,0x02014b50);writeU16(cv,4,20);writeU16(cv,6,20);writeU16(cv,8,0x0800);writeU16(cv,10,0);writeU16(cv,12,dt.time);writeU16(cv,14,dt.date);writeU32(cv,16,crc);writeU32(cv,20,data.length);writeU32(cv,24,data.length);writeU16(cv,28,name.length);writeU16(cv,30,0);writeU16(cv,32,0);writeU16(cv,34,0);writeU16(cv,36,0);writeU32(cv,38,0);writeU32(cv,42,offset);central.set(name,46);centralParts.push(central); offset+=local.length+data.length;
  }
  const central=concatBytes(centralParts); const end=new Uint8Array(22);const ev=new DataView(end.buffer);writeU32(ev,0,0x06054b50);writeU16(ev,4,0);writeU16(ev,6,0);writeU16(ev,8,files.length);writeU16(ev,10,files.length);writeU32(ev,12,central.length);writeU32(ev,16,offset);writeU16(ev,20,0); return concatBytes([...localParts,central,end]);
}

async function handleImportFile(){
  const file=els.importFile.files?.[0]; state.importRows=[]; state.importErrors=[]; els.importBtn.disabled=true; els.importPreview.hidden=true; els.importPreview.innerHTML="";
  if(!file){els.importFileName.textContent="Belum ada file";setToolStatus(els.importSummary,"","info");return;}
  els.importFileName.textContent=file.name; setToolStatus(els.importSummary,"Membaca file...","info");
  try{
    const ext=file.name.split(".").pop().toLowerCase(); let matrix;
    if(ext==="csv") matrix=parseCsv(await file.text()); else if(ext==="xlsx") matrix=await parseXlsxFile(file); else throw new Error("Format file harus CSV atau XLSX.");
    const prepared=prepareImportRows(matrix); state.importRows=prepared.rows; state.importErrors=prepared.errors; renderImportPreview(prepared);
    if(prepared.errors.length){setToolStatus(els.importSummary,`${prepared.rows.length} baris valid, ${prepared.errors.length} baris bermasalah. Perbaiki file sebelum import.`,"error");}
    else{setToolStatus(els.importSummary,`${prepared.rows.length} baris siap diimport. Gambar akan dikosongkan.`,"success");els.importBtn.disabled=prepared.rows.length===0;}
  }catch(error){console.error("import parse:",error);setToolStatus(els.importSummary,`File tidak dapat dibaca: ${friendlyError(error)}`,"error");}
}
async function parseXlsxFile(file){
  const entries=await unzipEntries(await file.arrayBuffer());
  const decoder=new TextDecoder();
  let sheetPath="xl/worksheets/sheet1.xml";
  const workbookBytes=entries.get("xl/workbook.xml");
  const relsBytes=entries.get("xl/_rels/workbook.xml.rels");
  if(workbookBytes&&relsBytes){
    const workbookDoc=new DOMParser().parseFromString(decoder.decode(workbookBytes),"application/xml");
    const firstSheet=workbookDoc.getElementsByTagNameNS("*","sheet")[0];
    const relId=firstSheet?.getAttribute("r:id")||firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const relsDoc=new DOMParser().parseFromString(decoder.decode(relsBytes),"application/xml");
    const rel=[...relsDoc.getElementsByTagNameNS("*","Relationship")].find((node)=>node.getAttribute("Id")===relId);
    const target=rel?.getAttribute("Target");
    if(target)sheetPath=target.startsWith("/")?target.slice(1):`xl/${target.replace(/^\.\//,"")}`;
  }
  let sheetBytes=entries.get(sheetPath);
  if(!sheetBytes){
    const fallback=[...entries.keys()].filter((name)=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()[0];
    if(fallback)sheetBytes=entries.get(fallback);
  }
  if(!sheetBytes)throw new Error("Worksheet pertama tidak ditemukan.");
  let shared=[]; const sharedBytes=entries.get("xl/sharedStrings.xml"); if(sharedBytes){const doc=new DOMParser().parseFromString(decoder.decode(sharedBytes),"application/xml");shared=[...doc.getElementsByTagNameNS("*","si")].map((si)=>[...si.getElementsByTagNameNS("*","t")].map((t)=>t.textContent||"").join(""));}
  const doc=new DOMParser().parseFromString(decoder.decode(sheetBytes),"application/xml"); if(doc.querySelector("parsererror"))throw new Error("XML worksheet rusak."); const matrix=[];
  [...doc.getElementsByTagNameNS("*","row")].forEach((rowNode)=>{const row=[];[...rowNode.getElementsByTagNameNS("*","c")].forEach((cell)=>{const ref=cell.getAttribute("r")||"A1";const col=columnIndex(ref.replace(/\d+/g,""));const type=cell.getAttribute("t")||"";let value="";if(type==="inlineStr")value=[...cell.getElementsByTagNameNS("*","t")].map((n)=>n.textContent||"").join("");else{const raw=cell.getElementsByTagNameNS("*","v")[0]?.textContent||"";value=type==="s"?shared[Number(raw)]??"":raw;}row[col]=value;});matrix.push(row.map((v)=>v??""));}); return matrix;
}
function columnIndex(letters){let n=0;for(const ch of String(letters).toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return Math.max(0,n-1);}
async function unzipEntries(buffer){
  const bytes=new Uint8Array(buffer);const view=new DataView(buffer);let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error("ZIP/XLSX tidak valid.");
  const count=view.getUint16(eocd+10,true);let pos=view.getUint32(eocd+16,true);const decoder=new TextDecoder();const map=new Map();
  for(let i=0;i<count;i++){
    if(view.getUint32(pos,true)!==0x02014b50)throw new Error("Central directory ZIP rusak.");const method=view.getUint16(pos+10,true);const compressedSize=view.getUint32(pos+20,true);const nameLen=view.getUint16(pos+28,true);const extraLen=view.getUint16(pos+30,true);const commentLen=view.getUint16(pos+32,true);const localOffset=view.getUint32(pos+42,true);const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLen));
    if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error("Local header ZIP rusak.");const localNameLen=view.getUint16(localOffset+26,true);const localExtraLen=view.getUint16(localOffset+28,true);const dataStart=localOffset+30+localNameLen+localExtraLen;const compressed=bytes.slice(dataStart,dataStart+compressedSize);let data;
    if(method===0)data=compressed;else if(method===8)data=await inflateRaw(compressed);else throw new Error(`Kompresi ZIP ${method} belum didukung.`);map.set(name,data);pos+=46+nameLen+extraLen+commentLen;
  }return map;
}
async function inflateRaw(bytes){
  if(typeof DecompressionStream!=="function")throw new Error("Browser tidak mendukung pembacaan XLSX terkompresi.");const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));return new Uint8Array(await new Response(stream).arrayBuffer());
}

const HEADER_ALIASES={
  kode_barang:["kode barang","kode_barang","kode","kodebarang"],nama_barang:["nama barang","nama_barang","nama","namabarang"],kategori:["kategori"],harga:["harga","harga barang","harga_barang"],stok:["stok","stock"],satuan:["satuan"],supplier:["supplier","pemasok"],kondisi:["kondisi"],lokasi:["lokasi","lokasi penyimpanan","lokasi_penyimpanan"]
};
function normalizeHeader(value){return String(value||"").trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");}
function prepareImportRows(matrix){
  const nonEmpty=matrix.filter((row)=>row.some((v)=>String(v??"").trim()!=="")); if(nonEmpty.length<2)throw new Error("File tidak memiliki baris data.");const headers=nonEmpty[0].map(normalizeHeader);const indexes={};for(const [field,aliases] of Object.entries(HEADER_ALIASES)){const idx=headers.findIndex((h)=>aliases.includes(h));indexes[field]=idx;}
  const requiredHeaders=["nama_barang","kategori","harga","stok","satuan","supplier"];const missing=requiredHeaders.filter((f)=>indexes[f]<0);if(missing.length)throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(", ")}.`);
  const allocator=createImportCodeAllocator();const referenceItems=state.allItems.length?state.allItems:state.items;const seenCodes=new Set(referenceItems.map((item)=>String(item.kode_barang).toUpperCase()));const rows=[];const errors=[];
  nonEmpty.slice(1).forEach((raw,rowOffset)=>{
    const line=rowOffset+2; const get=(field)=>indexes[field]>=0?String(raw[indexes[field]]??"").trim():""; const row={kode_barang:get("kode_barang"),nama_barang:get("nama_barang"),kategori:get("kategori"),harga:Number(get("harga").replace(/[^0-9.-]/g,"")),stok:Number(get("stok").replace(/[^0-9.-]/g,"")),satuan:get("satuan"),supplier:get("supplier"),kondisi:get("kondisi")||"Baik",lokasi:get("lokasi")||null}; const rowErrors=[];
    if(!row.nama_barang)rowErrors.push("nama kosong");if(!row.kategori)rowErrors.push("kategori kosong");if(!Number.isFinite(row.harga)||!Number.isInteger(row.harga)||row.harga<0||row.harga>MAX_PRICE_RUPIAH)rowErrors.push("harga tidak valid");if(!Number.isInteger(row.stok)||row.stok<0||row.stok>MAX_STOCK)rowErrors.push("stok tidak valid");if(!row.satuan)rowErrors.push("satuan kosong");if(!row.supplier)rowErrors.push("supplier kosong");
    const condition=ALLOWED_CONDITIONS.find((c)=>c.toLowerCase()===row.kondisi.toLowerCase());if(!condition)rowErrors.push("kondisi harus Baik/Perlu Dicek/Rusak");else row.kondisi=condition;
    if(row.kode_barang){row.kode_barang=row.kode_barang.toUpperCase().replace(/\s+/g," ");if(!/^[A-Z0-9]{2,6}[ -]?\d{1,9}$/.test(row.kode_barang))rowErrors.push("format kode tidak valid");if(seenCodes.has(row.kode_barang))rowErrors.push("kode duplikat");}
    else if(row.kategori&&!rowErrors.some((e)=>e.includes("kategori")))row.kode_barang=allocator.next(row.kategori);
    if(row.kode_barang){if(seenCodes.has(row.kode_barang)&&!rowErrors.includes("kode duplikat"))rowErrors.push("kode duplikat");seenCodes.add(row.kode_barang);}
    if(row.nama_barang.length>100)rowErrors.push("nama > 100 karakter");if(row.kategori.length>50)rowErrors.push("kategori > 50 karakter");if(row.satuan.length>30)rowErrors.push("satuan > 30 karakter");if(row.supplier.length>100)rowErrors.push("supplier > 100 karakter");if((row.lokasi||"").length>100)rowErrors.push("lokasi > 100 karakter");
    if(rowErrors.length)errors.push({line,messages:rowErrors,row});else rows.push(row);
  });return {rows,errors};
}
function createImportCodeAllocator(){
  const reserved=new Map();const usedNumbers=new Map();
  (state.allItems.length ? state.allItems : state.items).forEach((item)=>{const p=extractCodePrefix(item.kode_barang);if(p){const match=String(item.kode_barang).match(/(\d+)$/);if(match){if(!usedNumbers.has(p))usedNumbers.set(p,new Set());usedNumbers.get(p).add(Number(match[1]));}}});
  const prefixFor=(category)=>{const key=normalizeCategoryKey(category);for(const [p,k] of reserved)if(k===key)return p;const candidates=[getCategoryPrefix(category),...buildPrefixCandidates(category)];for(const p of [...new Set(candidates)]){const existingOwners=getPrefixCategoryKeys(p);const reservedOwner=reserved.get(p);const existingOkay=existingOwners.length===0||(existingOwners.length===1&&existingOwners[0]===key);const reservedOkay=!reservedOwner||reservedOwner===key;if(existingOkay&&reservedOkay){reserved.set(p,key);return p;}}const fallback=`I${Math.abs(hashString(key)).toString(36).toUpperCase().slice(0,4)}`;reserved.set(fallback,key);return fallback;};
  return {next(category){const p=prefixFor(category);if(!usedNumbers.has(p))usedNumbers.set(p,new Set());const used=usedNumbers.get(p);let n=1;while(used.has(n))n++;used.add(n);return `${p} ${String(n).padStart(3,"0")}`;}};
}
function renderImportPreview(prepared){
  els.importPreview.hidden=false;const valid=prepared.rows.slice(0,20);const invalid=prepared.errors.slice(0,20);const rows=[...valid.map((row)=>({row,error:""})),...invalid.map((entry)=>({row:entry.row,error:`Baris ${entry.line}: ${entry.messages.join(", ")}`}))];
  els.importPreview.innerHTML=`<table><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th></tr></thead><tbody>${rows.map(({row,error})=>`<tr class="${error?"has-error":""}"><td>${escapeHtml(row.kode_barang||"-")}</td><td>${escapeHtml(row.nama_barang||"-")}</td><td>${escapeHtml(row.kategori||"-")}</td><td>${Number.isFinite(row.harga)?formatRupiah(row.harga):"-"}</td><td>${Number.isFinite(row.stok)?row.stok:"-"}</td><td>${escapeHtml(error||"Siap")}</td></tr>`).join("")}</tbody></table>`;
}
async function importPreparedRows(){
  if(!state.importRows.length||state.importErrors.length||!ensureCanWrite())return;const ok=await confirmAction({title:"Import data?",message:`${state.importRows.length} barang akan ditambahkan ke Supabase. Gambar dibuat kosong.`,confirmText:"Import"});if(!ok)return;els.importBtn.disabled=true;setToolStatus(els.importSummary,"Mengimport data...","info");
  try{const {data,error}=await state.db.rpc("import_barang_bulk",{p_rows:state.importRows});if(error)throw error;setToolStatus(els.importSummary,`${Number(data)||state.importRows.length} barang berhasil diimport.`,"success");state.importRows=[];state.importErrors=[];els.importFile.value="";els.importFileName.textContent="Belum ada file";els.importPreview.hidden=true;await loadItems();}catch(error){console.error("import:",error);setToolStatus(els.importSummary,`Import gagal: ${friendlyError(error)}${/function|rpc|schema cache/i.test(String(error?.message||""))?" Jalankan supabase-upgrade-v6.sql terlebih dahulu.":""}`,"error");}finally{els.importBtn.disabled=state.importRows.length===0||state.importErrors.length>0;}
}

function backupLocalStorage(){
  const data={app:"InventarisKu",format_version:1,app_version:APP_VERSION,created_at:new Date().toISOString(),storage:{}};
  const allowed=[CACHE_KEY,THEME_KEY,LAST_SYNC_KEY];
  for(const key of allowed){const value=localStorage.getItem(key);if(value!==null)data.storage[key]=value;}
  const json=JSON.stringify(data,null,2);downloadBlob(new Blob([json],{type:"application/json"}),`InventarisKu-LocalBackup-${new Date().toISOString().slice(0,10)}.json`);setToolStatus(els.localBackupStatus,"Backup lokal berhasil didownload.","success");
}
async function restoreLocalStorageFromFile(){
  const file=els.restoreLocalFile.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed?.app!=="InventarisKu"||parsed?.format_version!==1||typeof parsed.storage!=="object")throw new Error("Format backup tidak dikenali.");const ok=await confirmAction({title:"Restore backup lokal?",message:"Cache dan pengaturan lokal akan diganti. Database Supabase tidak berubah.",confirmText:"Restore"});if(!ok)return;const allowed=new Set([CACHE_KEY,THEME_KEY,LAST_SYNC_KEY]);for(const key of allowed)localStorage.removeItem(key);for(const [key,value] of Object.entries(parsed.storage))if(allowed.has(key)&&typeof value==="string")localStorage.setItem(key,value);applyThemePreference(getThemePreference(),false);if(!navigator.onLine)loadCachedItems();updateLastSyncLabel();setToolStatus(els.localBackupStatus,"Backup lokal berhasil direstore.","success");}catch(error){setToolStatus(els.localBackupStatus,`Restore gagal: ${friendlyError(error)}`,"error");}finally{els.restoreLocalFile.value="";}
}
function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

/* ========================= STOCK OPNAME ========================= */
async function openOpname(){
  if(!ensureCanWrite())return; showAppDialog(els.opnameDialog); await loadOpnameSessions();
}
async function loadOpnameSessions(){
  els.opnameHome.hidden=false; els.opnameDetail.hidden=true; els.opnameSessions.innerHTML=""; els.opnameHomeStatus.textContent="Memuat riwayat...";
  try{const {data,error}=await state.db.from("stok_opname").select("*").order("created_at",{ascending:false}).limit(50);if(error)throw error;state.opnameSessions=Array.isArray(data)?data:[];renderOpnameSessions();}
  catch(error){console.error("opname sessions:",error);els.opnameHomeStatus.textContent="Riwayat gagal dimuat. Jalankan upgrade database v6 bila belum.";showToast("Stok opname belum siap",friendlyError(error),"error");}
}
function renderOpnameSessions(){
  const draft=state.opnameSessions.find((row)=>row.status==="draft");els.startOpnameBtn.disabled=Boolean(draft);els.startOpnameBtn.title=draft?"Selesaikan atau batalkan draft aktif terlebih dahulu.":"";els.opnameHomeStatus.textContent=state.opnameSessions.length?`${state.opnameSessions.length} sesi tersimpan`:"Belum ada riwayat opname";
  if(!state.opnameSessions.length){els.opnameSessions.innerHTML=`<div class="empty-state"><strong>Belum ada stok opname</strong><p>Mulai sesi pertama untuk membandingkan stok sistem dengan stok fisik.</p></div>`;return;}
  els.opnameSessions.innerHTML=state.opnameSessions.map((row)=>{
    const statusClass=row.status==="draft"?"is-draft":row.status==="selesai"?"is-done":"is-cancel";const statusText=row.status==="draft"?"Draft":row.status==="selesai"?"Selesai":"Batal";
    return `<div class="session-row" data-id="${escapeAttr(row.id)}"><div><strong>${escapeHtml(row.nomor_opname)}</strong><span>${formatDate(row.created_at)}</span></div><div><span class="session-status ${statusClass}">${statusText}</span></div><div><span>${row.completed_at?`Selesai ${formatDate(row.completed_at)}`:(row.catatan?escapeHtml(row.catatan):"-")}</span></div><button class="btn btn--small btn--secondary" type="button" data-opname-open="${escapeAttr(row.id)}">${row.status==="draft"?"Lanjutkan":"Lihat"}</button></div>`;
  }).join("");
}
function handleOpnameSessionClick(event){const button=event.target.closest("[data-opname-open]");if(button)openOpnameSession(button.dataset.opnameOpen);}
async function startStockOpname(){
  if(!ensureCanWrite())return;const ok=await confirmAction({title:"Mulai stok opname?",message:"Sistem akan mengambil snapshot stok seluruh barang saat ini. Hanya satu draft opname dapat aktif pada satu waktu.",confirmText:"Mulai"});if(!ok)return;els.startOpnameBtn.disabled=true;
  try{const {data,error}=await state.db.rpc("buat_stok_opname",{p_catatan:null});if(error)throw error;showToast("Opname dimulai","Snapshot stok berhasil dibuat.","success");await loadOpnameSessions();await openOpnameSession(data);}catch(error){showToast("Gagal memulai opname",friendlyOpnameError(error),"error");await loadOpnameSessions();}
}
async function openOpnameSession(id){
  try{await flushOpnameAutosave();const session=state.opnameSessions.find((row)=>row.id===id)||(await state.db.from("stok_opname").select("*").eq("id",id).single()).data;if(!session)throw new Error("Sesi tidak ditemukan.");const {data,error}=await state.db.from("stok_opname_detail").select("*").eq("stok_opname_id",id).order("kode_barang",{ascending:true});if(error)throw error;state.opnameActive=session;state.opnameDetails=Array.isArray(data)?data:[];els.opnameHome.hidden=true;els.opnameDetail.hidden=false;els.opnameNumber.textContent=session.nomor_opname;els.opnameSearch.value="";els.cancelOpnameBtn.hidden=session.status!=="draft";els.finalizeOpnameBtn.hidden=session.status!=="draft";els.opnameSaveStatus.textContent=session.status==="draft"?"Draft tersimpan":"Mode baca";renderOpnameDetails();}
  catch(error){showToast("Gagal membuka opname",friendlyOpnameError(error),"error");}
}
function showOpnameHome(){flushOpnameAutosave().finally(loadOpnameSessions);}
function renderOpnameDetails(){
  const query=els.opnameSearch.value.trim().toLowerCase();const filtered=state.opnameDetails.filter((row)=>!query||[row.kode_barang,row.nama_barang,row.kategori].join(" ").toLowerCase().includes(query)||normalizeCodeSearch(row.kode_barang).includes(normalizeCodeSearch(query)));const editable=state.opnameActive?.status==="draft";
  els.opnameRows.innerHTML=filtered.map((row)=>{
    const physical=row.stok_fisik;const diff=physical==null?null:Number(physical)-Number(row.stok_sistem||0);const diffClass=diff==null?"":diff>0?"is-plus":diff<0?"is-minus":"is-zero";const diffText=diff==null?"-":diff>0?`+${diff}`:String(diff);
    return `<div class="opname-row" data-detail-id="${escapeAttr(row.id)}"><div class="opname-row__item"><strong>${escapeHtml(row.nama_barang)}</strong><span>${escapeHtml(row.kode_barang)} • ${escapeHtml(row.kategori)}</span></div><div>${Number(row.stok_sistem).toLocaleString("id-ID")} ${escapeHtml(row.satuan)}</div><div><input data-opname-stock type="number" min="0" max="2147483647" step="1" inputmode="numeric" value="${physical==null?"":escapeAttr(physical)}" ${editable?"":"disabled"} aria-label="Stok fisik ${escapeAttr(row.nama_barang)}" /></div><div class="opname-diff ${diffClass}">${diffText}</div><div><input data-opname-note maxlength="160" value="${escapeAttr(row.catatan||"")}" ${editable?"":"disabled"} placeholder="Opsional" aria-label="Catatan ${escapeAttr(row.nama_barang)}" /></div></div>`;
  }).join("");updateOpnameProgress();
}
function handleOpnameInput(event){
  if(state.opnameActive?.status!=="draft")return;const rowEl=event.target.closest(".opname-row");if(!rowEl)return;const row=state.opnameDetails.find((detail)=>detail.id===rowEl.dataset.detailId);if(!row)return;
  if(event.target.matches("[data-opname-stock]")){const raw=event.target.value.trim();const n=raw===""?null:Number(raw);const valid=n===null||(Number.isInteger(n)&&n>=0&&n<=MAX_STOCK);event.target.classList.toggle("is-invalid",!valid);if(valid)row.stok_fisik=n;const diffEl=rowEl.querySelector(".opname-diff");const diff=n==null?null:n-Number(row.stok_sistem||0);diffEl.textContent=diff==null?"-":diff>0?`+${diff}`:String(diff);diffEl.className=`opname-diff ${diff==null?"":diff>0?"is-plus":diff<0?"is-minus":"is-zero"}`;}
  if(event.target.matches("[data-opname-note]"))row.catatan=event.target.value.trim()||null;updateOpnameProgress();queueOpnameAutosave();
}
function updateOpnameProgress(){
  const filled=state.opnameDetails.filter((row)=>row.stok_fisik!==null&&row.stok_fisik!==undefined).length;const total=state.opnameDetails.length;const diffs=state.opnameDetails.filter((row)=>row.stok_fisik!=null&&Number(row.stok_fisik)!==Number(row.stok_sistem)).length;els.opnameProgress.textContent=`${filled} / ${total} dihitung${diffs?` • ${diffs} berbeda`:""}`;els.finalizeOpnameBtn.disabled=state.opnameActive?.status!=="draft"||filled!==total||hasInvalidOpnameInput()||state.opnameSaving;
}
function hasInvalidOpnameInput(){return Boolean(els.opnameRows.querySelector("input.is-invalid"));}
function queueOpnameAutosave(){
  if(state.opnameActive?.status!=="draft")return;if(state.opnameSaveTimer)clearTimeout(state.opnameSaveTimer);els.opnameSaveStatus.textContent="Belum tersimpan";state.opnameSaveTimer=setTimeout(()=>flushOpnameAutosave(),700);
}
async function flushOpnameAutosave(){
  if(state.opnameSaveTimer){clearTimeout(state.opnameSaveTimer);state.opnameSaveTimer=null;}if(state.opnameActive?.status!=="draft"||state.opnameSaving||!state.db||!navigator.onLine)return;if(hasInvalidOpnameInput()){els.opnameSaveStatus.textContent="Ada input tidak valid";return;}
  state.opnameSaving=true;els.opnameSaveStatus.textContent="Menyimpan...";updateOpnameProgress();
  try{const payload=state.opnameDetails.map((row)=>({id:row.id,stok_fisik:row.stok_fisik==null?null:Number(row.stok_fisik),catatan:row.catatan||null}));const {error}=await state.db.rpc("simpan_draft_stok_opname",{p_opname_id:state.opnameActive.id,p_details:payload});if(error)throw error;els.opnameSaveStatus.textContent="Draft tersimpan";}
  catch(error){console.error("opname autosave:",error);els.opnameSaveStatus.textContent="Gagal menyimpan";showToast("Draft opname gagal disimpan",friendlyOpnameError(error),"error");}
  finally{state.opnameSaving=false;updateOpnameProgress();}
}
async function finalizeStockOpname(){
  if(state.opnameActive?.status!=="draft"||!ensureCanWrite())return;await flushOpnameAutosave();if(hasInvalidOpnameInput()){showToast("Belum bisa finalisasi","Ada stok fisik yang tidak valid.","error");return;}const missing=state.opnameDetails.filter((row)=>row.stok_fisik==null).length;if(missing){showToast("Belum lengkap",`${missing} barang belum dihitung.`,"warning");return;}const differences=state.opnameDetails.filter((row)=>Number(row.stok_fisik)!==Number(row.stok_sistem)).length;const ok=await confirmAction({title:"Finalisasi stok opname?",message:`${state.opnameDetails.length} barang akan diproses. ${differences} barang memiliki selisih dan stok database akan diperbarui sesuai hitungan fisik.`,confirmText:"Finalisasi"});if(!ok)return;els.finalizeOpnameBtn.disabled=true;
  try{const {data,error}=await state.db.rpc("finalisasi_stok_opname",{p_opname_id:state.opnameActive.id});if(error)throw error;showToast("Opname selesai",`${data?.berbeda??differences} barang memiliki perubahan stok.`,"success");await loadItems();await loadOpnameSessions();}
  catch(error){showToast("Finalisasi gagal",friendlyOpnameError(error),"error");}finally{els.finalizeOpnameBtn.disabled=false;}
}
async function cancelStockOpname(){
  if(state.opnameActive?.status!=="draft"||!ensureCanWrite())return;await flushOpnameAutosave();const ok=await confirmAction({title:"Batalkan stok opname?",message:"Draft akan ditandai batal. Stok barang tidak akan berubah.",confirmText:"Batalkan Opname",danger:true});if(!ok)return;
  try{const {error}=await state.db.rpc("batalkan_stok_opname",{p_opname_id:state.opnameActive.id});if(error)throw error;showToast("Opname dibatalkan","Tidak ada stok barang yang diubah.","success");await loadOpnameSessions();}catch(error){showToast("Gagal membatalkan",friendlyOpnameError(error),"error");}
}
function friendlyOpnameError(error){const msg=String(error?.message||"");if(/DRAFT_EXISTS/.test(msg))return"Masih ada draft opname aktif.";if(/INVENTORY_EMPTY/.test(msg))return"Inventaris masih kosong.";if(/OPNAME_INCOMPLETE/.test(msg))return"Semua barang harus memiliki stok fisik sebelum finalisasi.";if(/function|schema cache|does not exist/i.test(msg))return"Fitur database v6 belum terpasang. Jalankan supabase-upgrade-v6.sql.";return friendlyError(error);}

/* ========================= PWA ========================= */
function isRunningAsInstalledApp(){return window.matchMedia?.("(display-mode: standalone)")?.matches===true||window.navigator.standalone===true;}
function isIOSDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);}
function setupPWA(){
  const syncInstallButton=()=>{els.installBtn.hidden=isRunningAsInstalledApp();};
  syncInstallButton();
  if("serviceWorker" in navigator){window.addEventListener("load",async()=>{try{await navigator.serviceWorker.register("./sw.js?v=6.2");}catch(error){console.warn("service worker:",error);}});}
  window.addEventListener("beforeinstallprompt",(event)=>{event.preventDefault();state.installPrompt=event;syncInstallButton();});
  els.installBtn.addEventListener("click",async()=>{
    if(isRunningAsInstalledApp()){els.installBtn.hidden=true;return;}
    if(state.installPrompt){const prompt=state.installPrompt;state.installPrompt=null;await prompt.prompt();const result=await prompt.userChoice;if(result?.outcome==="accepted")showToast("Aplikasi dipasang","InventarisKu ditambahkan sebagai aplikasi.","success");syncInstallButton();return;}
    if(isIOSDevice())showToast("Install aplikasi","Buka menu Share lalu pilih Add to Home Screen.","info",7000);else showToast("Install aplikasi","Gunakan ikon Install di address bar atau menu browser jika tersedia.","info",7000);
  });
  window.addEventListener("appinstalled",()=>{state.installPrompt=null;els.installBtn.hidden=true;showToast("Aplikasi terpasang","InventarisKu siap digunakan sebagai PWA.","success");});
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",syncInstallButton);
}

/* ========================= UTILITIES ========================= */
function showToast(title,message,type="info",duration=4200){
  const toast=document.createElement("div");toast.className=`toast ${type==="success"?"is-success":type==="error"?"is-error":type==="warning"?"is-warning":""}`;toast.innerHTML=`<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;els.toastContainer.append(toast);setTimeout(()=>{toast.style.opacity="0";toast.style.transform="translateY(6px)";setTimeout(()=>toast.remove(),180);},duration);
}
function formatRupiah(value){const number=Number(value)||0;return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(number);}
function formatCompactRupiah(value){const number=Number(value)||0;if(Math.abs(number)<1_000_000)return formatRupiah(number);return `Rp${new Intl.NumberFormat("id-ID",{notation:"compact",maximumFractionDigits:1}).format(number)}`;}
function formatDate(value){if(!value)return"-";const date=new Date(value);return Number.isNaN(date.getTime())?"-":date.toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"});}
function formatDurationShort(ms){const total=Math.max(0,Math.ceil(ms/1000));const min=Math.floor(total/60);const sec=total%60;if(min>=60){const h=Math.floor(min/60);const m=min%60;return `${h}j ${m}m`;}return `${min}:${String(sec).padStart(2,"0")}`;}
function formatFileSize(bytes){const n=Number(bytes)||0;if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1).replace(".0","")} KB`;return`${(n/(1024*1024)).toFixed(1).replace(".0","")} MB`;}
function getSafeExtension(filename,mimeType){const name=String(filename||"");const ext=name.includes(".")?name.split(".").pop().toLowerCase():"";if(["jpg","jpeg","png","webp"].includes(ext))return ext;return mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":"jpg";}
function friendlyError(error){
  const msg=String(error?.message||error||"");if(/OFFLINE/i.test(msg))return"Tidak ada koneksi internet.";if(/Failed to fetch|fetch|network/i.test(msg))return"Koneksi ke server gagal.";if(/timeout|terlalu lama|tidak merespons/i.test(msg))return"Server tidak merespons tepat waktu.";if(/diarsipkan_at/i.test(msg))return"Database belum memakai upgrade v6.1. Jalankan supabase-upgrade-v6.1.sql di SQL Editor.";if(/foreign key constraint|23503/i.test(msg))return"Data masih dipakai oleh riwayat lain dan tidak dapat dihapus permanen.";if(/row-level security|42501|permission denied/i.test(msg))return"Akses ditolak oleh kebijakan database. Pastikan sudah login dan SQL upgrade sudah dijalankan.";if(/duplicate key|23505/i.test(msg))return"Ada data unik yang sudah digunakan.";if(/bucket.*not found|Bucket not found/i.test(msg))return"Bucket barang-images belum tersedia.";return msg||"Terjadi kesalahan yang tidak diketahui.";
}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));}
function escapeAttr(value){return escapeHtml(value).replace(/`/g,"&#96;");}
