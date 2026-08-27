/* global Zotero, Services, PathUtils, IOUtils, ChromeUtils, APP_SHUTDOWN */

"use strict";

const ADDON_ID = "pdf2zh-companion@local";
const ADDON_VERSION = "1.2.1";
const PREF_PREFIX = "extensions.zotero.pdf2zh.companion.";
const PDF2ZH_PREF_PREFIX = "extensions.zotero.pdf2zh.";
const COMPARE_URI = "chrome://pdf2zhcompanion/content/compare.xhtml";
const TRANSLATE_ICON = "chrome://pdf2zhcompanion/content/icons/translate.svg";
const COMPARE_ICON = "chrome://pdf2zhcompanion/content/icons/compare.svg";
const STATUS_ENDPOINT = "/pdf2zh-companion/status";

const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs",
);

let chromeHandle = null;
let serverProcess = null;
let serverDrainTasks = [];
let startedServer = false;
let shuttingDown = false;
let readerWatchTimer = null;
let lastReaderSignature = "";
let observedReaderPairs = new Set();
const windowState = new Map();
const compareState = new Map();
let statusEndpointClass = null;
let cachedServerHealth = null;
let cachedServerHealthCheckedAt = null;
let localConfig = {};

function install() {}

async function startup({ resourceURI, rootURI }) {
  await Zotero.initializationPromise;
  rootURI ||= resourceURI.spec;
  await loadLocalConfig(rootURI);

  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = aomStartup.registerChrome(
    Services.io.newURI(rootURI + "manifest.json"),
    [["content", "pdf2zhcompanion", rootURI + "content/"]],
  );

  await Zotero.uiReadyPromise;
  Zotero.PDF2ZHCompanion = {
    version: ADDON_VERSION,
    ensureServer,
    translateSelected: () => translateSelected(Zotero.getMainWindow()),
    openComparison: () => openComparison(Zotero.getMainWindow()),
    getStatus: diagnosticStatus,
    stopServer,
  };

  for (const win of Zotero.getMainWindows()) {
    attachToWindow(win);
  }
  registerStatusEndpoint();
  startReaderWatcher();
  log("started");
}

function onMainWindowLoad({ window }) {
  attachToWindow(window);
}

function onMainWindowUnload({ window }) {
  detachFromWindow(window);
}

async function shutdown(_data, reason) {
  shuttingDown = true;
  stopReaderWatcher();
  for (const win of [...windowState.keys()]) {
    detachFromWindow(win);
  }
  for (const win of [...compareState.keys()]) {
    try {
      win.close();
    }
    catch (error) {
      Zotero.logError(error);
    }
  }

  if (
    reason !== APP_SHUTDOWN
    && getPref("stopServerOnDisable", true)
  ) {
    await stopServer();
  }

  unregisterStatusEndpoint();
  delete Zotero.PDF2ZHCompanion;
  chromeHandle?.destruct();
  chromeHandle = null;
  serverDrainTasks = [];
}

function uninstall() {}

function log(message, error) {
  const line = `[PDF2zh Companion] ${message}`;
  if (error) {
    Zotero.logError(error);
    Zotero.debug(`${line}: ${error.message || error}`);
  }
  else {
    Zotero.debug(line);
  }
}

async function loadLocalConfig(rootURI) {
  try {
    const uri = Services.io.newURI(rootURI + "local-config.json");
    if (!uri.schemeIs("file")) {
      return;
    }
    const file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
    if (!(await IOUtils.exists(file.path))) {
      return;
    }
    const parsed = JSON.parse(await IOUtils.readUTF8(file.path));
    localConfig = {
      serverPython: String(parsed.serverPython || "").trim(),
      serverScript: String(parsed.serverScript || "").trim(),
    };
    log("loaded local path overrides");
  }
  catch (error) {
    log("local-config.json was not loaded", error);
  }
}

function getPref(key, fallback) {
  const value = Zotero.Prefs.get(PREF_PREFIX + key, true);
  return value === undefined || value === null || value === "" ? fallback : value;
}

function getPDF2zhPref(key, fallback) {
  const value = Zotero.Prefs.get(PDF2ZH_PREF_PREFIX + key, true);
  return value === undefined || value === null || value === "" ? fallback : value;
}

function attachToWindow(win) {
  if (!win || windowState.has(win)) {
    return;
  }

  const doc = win.document;
  const state = { elements: [] };
  windowState.set(win, state);

  const toolbar = doc.getElementById("zotero-toolbar-item-tree");
  const toolbarItems = doc.getElementById("zotero-items-toolbar") || toolbar;
  if (toolbarItems) {
    const translateButton = createToolbarButton(
      doc,
      "pdf2zh-companion-translate-button",
      "启动 Conda Server，并交给 PDF2zh 翻译",
      TRANSLATE_ICON,
      () => runGuarded(win, () => translateSelected(win)),
    );
    const compareButton = createToolbarButton(
      doc,
      "pdf2zh-companion-compare-button",
      "在两个独立阅读器中左右对照原文与译文",
      COMPARE_ICON,
      () => runGuarded(win, () => openComparison(win)),
    );
    const anchor = doc.getElementById("zotero-tb-search-spinner");
    toolbarItems.insertBefore(translateButton, anchor);
    toolbarItems.insertBefore(compareButton, anchor);
    state.elements.push(translateButton, compareButton);
  }
}

function createToolbarButton(doc, id, tooltip, icon, handler) {
  const button = doc.createXULElement("toolbarbutton");
  button.id = id;
  button.classList.add("zotero-tb-button");
  button.setAttribute("tooltiptext", tooltip);
  button.setAttribute("tabindex", "-1");
  button.style.listStyleImage = `url(${icon})`;
  button.addEventListener("command", handler);
  return button;
}

function detachFromWindow(win) {
  const state = windowState.get(win);
  if (!state) {
    return;
  }
  for (const element of state.elements) {
    element.remove();
  }
  windowState.delete(win);
}

async function runGuarded(win, task) {
  try {
    await task();
  }
  catch (error) {
    log("operation failed", error);
    showError(win, error.message || String(error));
  }
}

function showStatus(message, { error = false, closeMs = 4500 } = {}) {
  const progress = new Zotero.ProgressWindow({ closeOnClick: true });
  progress.changeHeadline("PDF2zh 本地伴侣");
  const row = new progress.ItemProgress(
    error ? "chrome://zotero/skin/cross.png" : TRANSLATE_ICON,
    message,
  );
  row.setProgress(100);
  progress.show();
  progress.startCloseTimer(closeMs);
}

function showError(win, message) {
  Services.prompt.alert(win || null, "PDF2zh 本地伴侣", message);
}

function registerStatusEndpoint() {
  if (!Zotero.Server?.Endpoints || statusEndpointClass) {
    return;
  }
  statusEndpointClass = function PDF2zhCompanionStatusEndpoint() {};
  statusEndpointClass.prototype = {
    supportedMethods: ["GET"],
    supportedDataTypes: ["application/json", "text/plain"],
    permitBookmarklet: false,
    init: async function (_request) {
      await checkServer();
      return [200, "application/json", JSON.stringify(diagnosticStatus())];
    },
  };
  Zotero.Server.Endpoints[STATUS_ENDPOINT] = statusEndpointClass;
}

function unregisterStatusEndpoint() {
  if (
    statusEndpointClass
    && Zotero.Server?.Endpoints?.[STATUS_ENDPOINT] === statusEndpointClass
  ) {
    delete Zotero.Server.Endpoints[STATUS_ENDPOINT];
  }
  statusEndpointClass = null;
}

function diagnosticStatus() {
  const python = String(getPref(
    "serverPython",
    localConfig.serverPython || "",
  ));
  const script = String(getPref(
    "serverScript",
    localConfig.serverScript || "",
  ));
  const windows = Zotero.getMainWindows?.() || [];
  return {
    ok: true,
    addon: {
      id: ADDON_ID,
      version: ADDON_VERSION,
    },
    pdf2zh: {
      available: Boolean(Zotero.pdf2zh?.hooks?.onDialogEvents),
      serverURL: String(getPDF2zhPref("new_serverip", "http://127.0.0.1:8890")),
      engine: String(getPDF2zhPref("engine", "pdf2zh_next")),
      sourceLanguage: String(getPDF2zhPref("sourceLang", "en")),
      targetLanguage: String(getPDF2zhPref("targetLang", "zh-CN")),
    },
    server: {
      python,
      script,
      health: cachedServerHealth,
      healthCheckedAt: cachedServerHealthCheckedAt,
      startedByCompanion: startedServer,
    },
    reader: {
      openPreviewAvailable: typeof Zotero.Reader?.openPreview === "function",
      openAvailable: typeof Zotero.Reader?.open === "function",
      openReaderCount: Zotero.Reader?._readers?.length || 0,
      autoCompareOpenReaders: Boolean(getPref("autoCompareOpenReaders", true)),
    },
    ui: {
      mainWindowCount: windows.length,
      attachedWindowCount: windowState.size,
      translateButtonCount: windows.filter(
        win => win.document?.getElementById("pdf2zh-companion-translate-button"),
      ).length,
      compareButtonCount: windows.filter(
        win => win.document?.getElementById("pdf2zh-companion-compare-button"),
      ).length,
      compareWindowCount: compareState.size,
    },
  };
}

function normalizeServerHealth(data) {
  if (!data || (data.status !== "ok" && !data.version)) {
    return null;
  }
  return {
    status: data.status ? String(data.status) : null,
    version: data.version ? String(data.version) : null,
    message: data.message ? String(data.message) : null,
    outputDir: data.outputDir ? String(data.outputDir) : null,
  };
}

async function checkServer() {
  const baseURL = String(getPDF2zhPref("new_serverip", "http://127.0.0.1:8890"))
    .trim()
    .replace(/\/+$/, "");
  try {
    const response = await Zotero.HTTP.request("GET", `${baseURL}/health`, {
      timeout: 2500,
      responseType: "json",
      successCodes: [200],
    });
    const data = response.response || JSON.parse(response.responseText || "null");
    const health = normalizeServerHealth(data);
    cachedServerHealth = health;
    cachedServerHealthCheckedAt = new Date().toISOString();
    return health;
  }
  catch (_error) {
    cachedServerHealth = null;
    cachedServerHealthCheckedAt = new Date().toISOString();
    return null;
  }
}

function serverPort() {
  const baseURL = String(getPDF2zhPref("new_serverip", "http://127.0.0.1:8890"));
  try {
    const parsed = new URL(baseURL);
    return Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  }
  catch (_error) {
    return 8890;
  }
}

async function ensureServer() {
  const existing = await checkServer();
  if (existing) {
    return existing;
  }

  if (serverProcess && serverProcess.exitCode === null) {
    return waitForServer();
  }

  const python = String(getPref(
    "serverPython",
    localConfig.serverPython || "",
  ));
  const script = String(getPref(
    "serverScript",
    localConfig.serverScript || "",
  ));
  if (!python) {
    throw new Error(
      "尚未配置 PDF2zh Server 的 Python；请设置 companion.serverPython。",
    );
  }
  if (!script) {
    throw new Error(
      "尚未配置 PDF2zh Server 脚本；请设置 companion.serverScript。",
    );
  }
  if (!(await IOUtils.exists(python))) {
    throw new Error(`找不到 PDF2zh Server 的 Python：${python}`);
  }
  if (!(await IOUtils.exists(script))) {
    throw new Error(`找不到 PDF2zh Server 脚本：${script}`);
  }

  const workdir = script.replace(/[\\/][^\\/]+$/, "");
  const condaRootMatch = python.match(/^(.*?)[\\/]envs[\\/][^\\/]+[\\/]python\.exe$/i);
  const currentEnvironment = Subprocess.getEnvironment();
  let processPath = currentEnvironment.PATH || currentEnvironment.Path || "";
  if (condaRootMatch) {
    const condaRoot = condaRootMatch[1];
    processPath = [
      condaRoot,
      PathUtils.join(condaRoot, "Scripts"),
      PathUtils.join(condaRoot, "Library", "bin"),
      processPath,
    ].filter(Boolean).join(";");
  }

  log(`starting server with ${python}`);
  serverProcess = await Subprocess.call({
    command: python,
    arguments: [
      script,
      "--port", String(serverPort()),
      "--enable_venv", "false",
      "--check_update", "false",
      "--skip_install", "true",
      "--debug", "false",
    ],
    workdir,
    environmentAppend: true,
    environment: {
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      PATH: processPath,
    },
    stderr: "pipe",
  });
  startedServer = true;
  serverDrainTasks = [
    drainProcessStream(serverProcess.stdout, "stdout"),
    drainProcessStream(serverProcess.stderr, "stderr"),
  ];
  serverProcess.wait().then(({ exitCode }) => {
    log(`server exited with code ${exitCode}`);
    serverProcess = null;
  });

  return waitForServer();
}

async function drainProcessStream(stream, kind) {
  if (!stream) {
    return;
  }
  try {
    let chunk;
    while ((chunk = await stream.readString())) {
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
        Zotero.debug(`[PDF2zh Server ${kind}] ${line}`);
      }
    }
  }
  catch (error) {
    if (!shuttingDown) {
      log(`failed reading server ${kind}`, error);
    }
  }
}

async function waitForServer() {
  const waitMs = Number(getPref("serverWaitMs", 45000));
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const health = await checkServer();
    if (health) {
      return health;
    }
    if (!serverProcess || serverProcess.exitCode !== null) {
      throw new Error("PDF2zh Server 启动后提前退出，请查看 Zotero 调试输出。");
    }
    await Zotero.Promise.delay(500);
  }
  throw new Error(`等待 PDF2zh Server 就绪超时（${Math.round(waitMs / 1000)} 秒）。`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null || !startedServer) {
    return;
  }
  const process = serverProcess;
  serverProcess = null;
  startedServer = false;
  try {
    await process.kill(1000);
  }
  catch (error) {
    log("failed to stop server", error);
  }
}

async function translateSelected(win) {
  if (!win?.ZoteroPane) {
    throw new Error("找不到 Zotero 主窗口。");
  }
  if (!Zotero.pdf2zh?.hooks?.onDialogEvents) {
    throw new Error("未检测到已启用的 Zotero PDF2zh 插件。");
  }

  const selected = win.ZoteroPane.getSelectedItems();
  if (!selected.length) {
    throw new Error("请先选择 PDF 或含 PDF 的条目。");
  }

  showStatus("正在检查并启动本地 PDF2zh 引擎…", { closeMs: 2500 });
  const health = await ensureServer();
  log(`server ready: ${health.version || "unknown"}`);

  // PDF 选择、翻译、输出命名和附件回挂全部由原版 PDF2zh 处理。
  Zotero.pdf2zh.hooks.onDialogEvents("translatePDF");
  showStatus(
    "Server 已就绪；翻译与附件管理已交给 PDF2zh。",
    { closeMs: 5000 },
  );
}

async function getPDFAttachments(parent) {
  if (!parent?.isRegularItem?.()) {
    return [];
  }
  const ids = parent.getAttachments();
  return ids
    .map(id => Zotero.Items.get(id))
    .filter(item => item?.isPDFAttachment?.() && !item.deleted);
}

function translatedScore(item) {
  const title = String(item.getField?.("title") || "");
  const filename = String(item.attachmentFilename || "");
  const text = `${title} ${filename}`.toLowerCase();
  let score = 0;
  if (/(?:^|[\s_.-])mono(?:-cut)?(?:[\s_.-]|$)/i.test(text)) score += 80;
  if (/(?:^|[\s_.-])dual(?:-cut)?(?:[\s_.-]|$)/i.test(text)) score += 60;
  if (/(?:translated|translation|pdf2zh|译文|中译|中文版)/i.test(text)) score += 45;
  if (/(?:^|[\s_.-])origin(?:[\s_.-]|$)|原文/i.test(text)) score -= 30;
  return score;
}

async function resolveOriginalAttachment(item) {
  if (item?.isPDFAttachment?.()) {
    if (translatedScore(item) <= 0 || !item.parentItemID) {
      return item;
    }
    const siblings = await getPDFAttachments(Zotero.Items.get(item.parentItemID));
    return chooseOriginal(siblings);
  }
  if (!item?.isRegularItem?.()) {
    return null;
  }
  const attachments = await getPDFAttachments(item);
  const best = await item.getBestAttachment();
  if (best?.isPDFAttachment?.() && translatedScore(best) <= 0) {
    return best;
  }
  return chooseOriginal(attachments);
}

function chooseOriginal(attachments) {
  return [...attachments]
    .sort((a, b) => {
      const scoreDelta = translatedScore(a) - translatedScore(b);
      if (scoreDelta) return scoreDelta;
      return String(a.dateAdded || "").localeCompare(String(b.dateAdded || ""));
    })[0] || null;
}

function chooseTranslation(attachments, original) {
  return [...attachments]
    .filter(item => item.id !== original?.id)
    .sort((a, b) => {
      const scoreDelta = translatedScore(b) - translatedScore(a);
      if (scoreDelta) return scoreDelta;
      return String(b.dateAdded || "").localeCompare(String(a.dateAdded || ""));
    })[0] || null;
}

function pairKey(pair) {
  return `${pair.original.id}:${pair.translation.id}`;
}

function startReaderWatcher() {
  stopReaderWatcher();
  if (!getPref("autoCompareOpenReaders", true)) {
    return;
  }
  readerWatchTimer = setInterval(() => {
    checkOpenReaderPairs().catch(error => log("reader pair watcher failed", error));
  }, 1000);
}

function stopReaderWatcher() {
  if (readerWatchTimer !== null) {
    clearInterval(readerWatchTimer);
    readerWatchTimer = null;
  }
  lastReaderSignature = "";
  observedReaderPairs = new Set();
}

async function checkOpenReaderPairs() {
  if (shuttingDown || !getPref("autoCompareOpenReaders", true)) {
    return;
  }
  const readers = Zotero.Reader?._readers || [];
  const signature = readers
    .map(reader => Number(reader.itemID) || 0)
    .sort((a, b) => a - b)
    .join(":");
  if (signature === lastReaderSignature) {
    return;
  }
  lastReaderSignature = signature;

  const groups = new Map();
  for (const reader of readers) {
    const item = Zotero.Items.get(reader.itemID);
    if (!item?.isPDFAttachment?.() || !item.parentItemID) {
      continue;
    }
    if (!groups.has(item.parentItemID)) {
      groups.set(item.parentItemID, []);
    }
    if (!groups.get(item.parentItemID).some(existing => existing.id === item.id)) {
      groups.get(item.parentItemID).push(item);
    }
  }

  const currentPairs = new Map();
  for (const attachments of groups.values()) {
    if (attachments.length < 2) {
      continue;
    }
    const original = chooseOriginal(attachments);
    const translation = chooseTranslation(attachments, original);
    if (!original || !translation || translatedScore(translation) <= 0) {
      continue;
    }
    const pair = { original, translation };
    currentPairs.set(pairKey(pair), pair);
  }

  for (const [key, pair] of currentPairs) {
    if (observedReaderPairs.has(key)) {
      continue;
    }
    observedReaderPairs.add(key);
    const win = Zotero.getMainWindow();
    if (win) {
      await openComparisonPair(win, pair);
    }
  }
  for (const key of [...observedReaderPairs]) {
    if (!currentPairs.has(key)) {
      observedReaderPairs.delete(key);
    }
  }
}

async function resolveComparisonPair(selected) {
  const explicitPDFs = selected.filter(item => item?.isPDFAttachment?.());
  if (explicitPDFs.length >= 2) {
    const firstParent = explicitPDFs[0].parentItemID || null;
    const sameParent = explicitPDFs.filter(
      item => (item.parentItemID || null) === firstParent,
    );
    if (sameParent.length >= 2) {
      const sorted = [...sameParent].sort(
        (a, b) => translatedScore(a) - translatedScore(b),
      );
      return { original: sorted[0], translation: sorted[sorted.length - 1] };
    }
  }

  const source = selected[0];
  const parent = source?.isRegularItem?.()
    ? source
    : source?.parentItemID
      ? Zotero.Items.get(source.parentItemID)
      : null;
  if (!parent) {
    throw new Error("请选择父条目，或选择同一条目下的原文/译文 PDF。");
  }
  const attachments = await getPDFAttachments(parent);
  const original = await resolveOriginalAttachment(source);
  const translation = chooseTranslation(attachments, original);
  if (!original) {
    throw new Error("没有找到原文 PDF。");
  }
  if (!translation || translatedScore(translation) <= 0) {
    throw new Error("没有找到译文 PDF；请先完成翻译，或同时选择原文和译文附件。");
  }
  return { original, translation };
}

async function openComparison(win) {
  const selected = win?.ZoteroPane?.getSelectedItems?.() || [];
  if (!selected.length) {
    throw new Error("请先选择包含原文和译文的条目。");
  }
  const pair = await resolveComparisonPair(selected);
  await openComparisonPair(win, pair);
}

async function openComparisonPair(win, pair) {
  const compareWin = win.openDialog(
    COMPARE_URI,
    `_blank`,
    "chrome,dialog=no,resizable,centerscreen,width=1500,height=920",
  );
  const initialize = () => initializeComparisonWindow(compareWin, pair);
  if (compareWin.document.readyState === "complete") {
    initialize();
  }
  else {
    compareWin.addEventListener("load", initialize, { once: true });
  }
  return compareWin;
}

async function initializeComparisonWindow(win, pair) {
  try {
    const doc = win.document;
    const originalTitle = attachmentLabel(pair.original, "原文");
    const translationTitle = attachmentLabel(pair.translation, "译文");
    doc.title = `PDF2zh 对照：${originalTitle}`;
    doc.getElementById("original-title").setAttribute("value", originalTitle);
    doc.getElementById("translation-title").setAttribute("value", translationTitle);

    const leftBrowser = doc.getElementById("original-browser");
    const rightBrowser = doc.getElementById("translation-browser");
    await Promise.all([waitForBrowser(leftBrowser), waitForBrowser(rightBrowser)]);

    const originalReader = await Zotero.Reader.openPreview(pair.original.id, leftBrowser);
    const translationReader = await Zotero.Reader.openPreview(pair.translation.id, rightBrowser);
    const results = await Promise.all([
      originalReader._open({}),
      translationReader._open({}),
    ]);
    if (results.some(result => !result)) {
      throw new Error("有一个 PDF 无法载入对照视图。");
    }

    const state = { pair, originalReader, translationReader, listeners: [] };
    compareState.set(win, state);
    bindCompareButton(win, state, "sync-prev", () => navigateBoth(state, "prev"));
    bindCompareButton(win, state, "sync-next", () => navigateBoth(state, "next"));
    bindCompareButton(win, state, "original-prev", () => originalReader.goto("prev"));
    bindCompareButton(win, state, "original-next", () => originalReader.goto("next"));
    bindCompareButton(win, state, "translation-prev", () => translationReader.goto("prev"));
    bindCompareButton(win, state, "translation-next", () => translationReader.goto("next"));
    bindCompareButton(win, state, "swap-panes", () => {
      const panes = doc.getElementById("compare-panes");
      panes.insertBefore(panes.lastElementChild, panes.firstElementChild);
    });
    bindCompareButton(win, state, "open-full-readers", async () => {
      await Zotero.Reader.open(pair.original.id, null, { openInWindow: true });
      await Zotero.Reader.open(pair.translation.id, null, { openInWindow: true });
    });

    win.addEventListener("unload", () => disposeComparisonWindow(win), { once: true });
    doc.getElementById("loading-status").hidden = true;
    doc.getElementById("compare-panes").hidden = false;
  }
  catch (error) {
    log("comparison window failed", error);
    const status = win.document.getElementById("loading-status");
    status.setAttribute("value", `载入失败：${error.message || error}`);
  }
}

function attachmentLabel(item, prefix) {
  const title = String(item.getField?.("title") || item.attachmentFilename || "PDF");
  return `${prefix} · ${title}`;
}

async function waitForBrowser(browser) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const inner = browser.contentWindow?.wrappedJSObject;
    if (inner?.createReader) {
      return;
    }
    await Zotero.Promise.delay(10);
  }
  throw new Error("Zotero PDF 阅读器初始化超时。");
}

function bindCompareButton(win, state, id, handler) {
  const button = win.document.getElementById(id);
  const listener = () => runGuarded(win, handler);
  button.addEventListener("command", listener);
  state.listeners.push([button, "command", listener]);
}

function navigateBoth(state, direction) {
  if (state.originalReader.canGoto(direction)) {
    state.originalReader.goto(direction);
  }
  if (state.translationReader.canGoto(direction)) {
    state.translationReader.goto(direction);
  }
}

function disposeComparisonWindow(win) {
  const state = compareState.get(win);
  if (!state) {
    return;
  }
  for (const [target, type, listener] of state.listeners) {
    target.removeEventListener(type, listener);
  }
  state.originalReader?.uninit();
  state.translationReader?.uninit();
  compareState.delete(win);
}
