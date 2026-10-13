/* global Zotero, Services, IOUtils, PathUtils, ChromeUtils */
"use strict";
const VERSION = "2.1.0";
const PREFIX = "extensions.zotero.pdf2zh.companion.";
const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
const buttons = new Map();
let iconURI, packageURI, process = null, opening = null, viewer = null, viewerURL = null;
let qualityInstalling = null;
let stopped = false;
const historyPatch = {};
function install() {}
function uninstall() {}
async function startup({ rootURI, resourceURI }) {
  await Zotero.initializationPromise;
  packageURI = rootURI || resourceURI.spec;
  iconURI = packageURI + "content/icons/server.svg";
  Services.scriptloader.loadSubScript(packageURI + "history-patch.js", historyPatch);
  await Zotero.uiReadyPromise;
  Zotero.PDF2ZHCompanion = { version: VERSION, openServer, setQualityEnabled, get qualityEnabled() { return pref("qualityEnabled", true); } };
  for (const win of Zotero.getMainWindows()) attach(win);
  try { await updateQualityRuntime(); } catch (error) {
    Zotero.logError(error);
    Services.prompt.alert(null, "PDF2zh 排版增强未应用", error.message || String(error));
  }
}
function onMainWindowLoad({ window }) { attach(window); }
function onMainWindowUnload({ window }) { detach(window); }
function shutdown() {
  stopped = true;
  for (const win of [...buttons.keys()]) detach(win);
  delete Zotero.PDF2ZHCompanion;
  // Do not interrupt PDF2zh jobs by killing its independently usable Server.
}
function pref(name, fallback) { const value = Zotero.Prefs.get(PREFIX + name, true); return value === undefined || value === null || value === "" ? fallback : value; }
function getServerURL() {
  const raw = Zotero.Prefs.get("extensions.zotero.pdf2zh.new_serverip", true) || "http://127.0.0.1:8890";
  const url = new URL(String(raw).trim());
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("请将 PDF2zh Server 地址设置为本机地址，例如 http://127.0.0.1:8890。");
  }
  return url.origin;
}
function attach(win) {
  if (stopped || buttons.has(win)) return;
  const doc = win.document;
  const toolbar = doc.getElementById("zotero-items-toolbar") || doc.getElementById("zotero-toolbar-item-tree");
  if (!toolbar) return;
  const button = doc.createXULElement("toolbarbutton");
  const popups = new Set();
  button.id = "pdf2zh-companion-server-button";
  button.classList.add("zotero-tb-button");
  button.setAttribute("label", "PDF2zh Server");
  button.setAttribute("tooltiptext", "打开 PDF2zh Server；右键切换默认开启的译文与排版增强");
  button.style.listStyleImage = `url(${iconURI})`;
  button.disabled = Boolean(opening);
  const listener = () => openServer().catch(error => {
    Zotero.logError(error);
    if (!stopped) Services.prompt.alert(win, "PDF2zh Server", error.message || String(error));
  });
  button.addEventListener("command", listener);
  const contextListener = event => {
    event.preventDefault();
    const popup = doc.createXULElement("menupopup");
    const item = doc.createXULElement("menuitem");
    item.setAttribute("type", "checkbox");
    item.setAttribute("label", "译文与排版增强（仅影响后续任务）");
    item.setAttribute("checked", String(Boolean(pref("qualityEnabled", true))));
    item.addEventListener("command", event => {
      event.stopPropagation(); // The parent toolbar button opens the Server.
      return setQualityEnabled(!pref("qualityEnabled", true)).catch(error => {
        Zotero.logError(error); Services.prompt.alert(win, "PDF2zh 排版增强", error.message);
      });
    });
    popup.appendChild(item);doc.documentElement.appendChild(popup);popups.add(popup);
    popup.addEventListener("popuphidden", () => { popups.delete(popup);popup.remove(); }, {once:true});
    popup.openPopupAtScreen(event.screenX, event.screenY, true);
  };
  button.addEventListener("contextmenu", contextListener);
  toolbar.appendChild(button);
  buttons.set(win, { button, listener, contextListener, popups });
}
function detach(win) {
  const entry = buttons.get(win);
  if (!entry) return;
  entry.button.removeEventListener("command", entry.listener);
  entry.button.removeEventListener("contextmenu", entry.contextListener);
  for (const popup of entry.popups) popup.remove();
  entry.popups.clear();
  entry.button.remove();
  buttons.delete(win);
}
function buildServerEnvironment(python, inherited, runtime = {}) {
  const windows = /python\.exe$/i.test(python);
  const environment = {};
  const inheritedPaths = [];
  // Normalize before passing a complete environment; never append old Path.
  for (const [key, value] of Object.entries(inherited)) {
    if (value === null || value === undefined) continue;
    const normalized = windows ? key.toUpperCase() : key;
    if (normalized === "PATH") inheritedPaths.push(String(value));
    else environment[normalized] = value;
  }
  const pythonDir = python.replace(/[\\/][^\\/]+$/, "");
  const roots = [runtime.prefix || pythonDir, runtime.base_prefix].filter(Boolean);
  const separator = windows ? ";" : ":";
  const entries = [];
  for (const root of roots) {
    entries.push(root, PathUtils.join(root, windows ? "Scripts" : "bin"));
    if (windows) entries.push(PathUtils.join(root, "Library", "bin"),
      PathUtils.join(root, "Library", "mingw-w64", "bin"), PathUtils.join(root, "Library", "usr", "bin"));
  }
  entries.push(pythonDir, ...inheritedPaths.flatMap(value => value.split(separator)));
  const seen = new Set();
  environment.PATH = entries.filter(entry => {
    if (!entry) return false;
    const key = windows ? entry.replace(/[\\/]+$/, "").toLowerCase() : entry;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(separator);
  environment.PYTHONIOENCODING = "utf-8";
  environment.PYTHONUTF8 = "1";
  return environment;
}
async function probeServerRuntime(python, inherited) {
  const probe = await Subprocess.call({
    command: python,
    arguments: ["-c", "import sys,json; print(json.dumps({'prefix':sys.prefix,'base_prefix':sys.base_prefix}))"],
    environmentAppend: false,
    environment: buildServerEnvironment(python, inherited), stderr: "pipe",
  });
  async function read(stream) {
    let result = "", chunk;
    while (stream && (chunk = await stream.readString())) result += chunk;
    return result;
  }
  const [result, output, error] = await Promise.all([probe.wait(), read(probe.stdout), read(probe.stderr)]);
  if (result.exitCode !== 0) throw new Error("无法检查所选 Python 环境：" + error.trim());
  const runtime = JSON.parse(output.trim());
  if (typeof runtime.prefix !== "string" || !runtime.prefix
      || typeof runtime.base_prefix !== "string" || !runtime.base_prefix) {
    throw new Error("所选 Python 未返回有效环境路径。");
  }
  return runtime;
}
async function healthy(url) {
  try {
    const response = await Zotero.HTTP.request("GET", url + "/health", {
      responseType: "json", timeout: 2000, successCodes: [200],
    });
    return response.response?.status === "ok" && Boolean(response.response.version);
  } catch (_) { return false; }
}
async function drain(stream) {
  if (!stream) return;
  try {
    let chunk;
    while ((chunk = await stream.readString())) {
      if (!stopped) Zotero.debug("[PDF2zh Server] " + chunk);
    }
  } catch (_) { /* Process closed its pipe. */ }
}
async function ensureServer(url) {
  await updateQualityRuntime();
  if (await healthy(url)) return;
  if (stopped) throw new Error("插件已停用。");
  if (!process || process.exitCode !== null) {
    const python = String(pref("serverPython", "")).trim();
    const script = String(pref("serverScript", "")).trim();
    if (!python || !script) throw new Error("请在配置编辑器中填写 extensions.zotero.pdf2zh.companion.serverPython 和 serverScript。");
    if (!(await IOUtils.exists(python))) throw new Error("找不到 Python：" + python);
    if (!(await IOUtils.exists(script))) throw new Error("找不到 Server 脚本：" + script);
    const parsed = new URL(url);
    const inherited = Subprocess.getEnvironment();
    const runtime = await probeServerRuntime(python, inherited);
    const launched = await Subprocess.call({
      command: python,
      arguments: [script, "--host", parsed.hostname === "[::1]" ? "::1" : "127.0.0.1",
        "--port", parsed.port || "80", "--enable_venv", "false",
        "--check_update", "false", "--skip_install", "true", "--debug", "false"],
      workdir: script.replace(/[\\/][^\\/]+$/, ""),
      environmentAppend: false,
      environment: buildServerEnvironment(python, inherited, runtime), stderr: "pipe",
    });
    process = launched;
    drain(launched.stdout); drain(launched.stderr);
    launched.wait().then(() => { if (process === launched) process = null; });
  }
  const timeout = Math.max(1000, Math.min(120000, Number(pref("serverWaitMs", 45000)) || 45000));
  const deadline = Date.now() + timeout;
  while (!stopped && Date.now() < deadline) {
    if (await healthy(url)) return;
    if (!process || process.exitCode !== null) throw new Error("Server 启动后退出。请查看 Zotero 调试输出中的 [PDF2zh Server]。");
    await Zotero.Promise.delay(500);
  }
  throw new Error("Server 未在等待时间内就绪，请检查 Python 环境与服务日志。");
}
async function updateQualityRuntime() {
  if (qualityInstalling) return qualityInstalling;
  const python = String(pref("serverPython", "")).trim();
  const script = String(pref("serverScript", "")).trim();
  if (!packageURI || !python || !script) return;
  qualityInstalling = (async () => {
    const server = script.replace(/[\\/][^\\/]+$/, "");
    const stage = PathUtils.join(server, "companion-quality-package");
    await IOUtils.makeDirectory(stage, {ignoreExisting:true});
    for (const name of ["install_quality.py", "companion_quality.py", "quality_engine.py", "quality_guard.py"]) {
      const text = await readPackagedText("quality/" + name);
      const dest = PathUtils.join(stage, name);
      await IOUtils.writeUTF8(dest, text, {tmpPath:dest + ".tmp"});
    }
    const inherited = Subprocess.getEnvironment();
    const runtime = await probeServerRuntime(python, inherited);
    const installer = await Subprocess.call({command:python,
      arguments:[PathUtils.join(stage, "install_quality.py"), server, String(Boolean(pref("qualityEnabled", true)))],
      environmentAppend:false, environment:buildServerEnvironment(python, inherited, runtime), stderr:"pipe"});
    let output = "", errors = "";
    async function read(stream) { let text = "", chunk;while (stream && (chunk = await stream.readString())) text += chunk;return text; }
    const [result, stdout, stderr] = await Promise.all([installer.wait(), read(installer.stdout), read(installer.stderr)]);
    output = stdout;errors = stderr;
    if (result.exitCode !== 0) throw new Error("无法安装排版增强：" + (output.trim() || errors.trim()));
    const status = JSON.parse(output.trim());
    if (status.hook_changed && await healthy(getServerURL())) {
      Services.prompt.alert(null, "PDF2zh 排版增强", "增强功能已安装。现有服务需要在当前任务结束后重新启动一次，后续翻译才会使用增强功能；插件不会中断当前任务。");
    }
  })().finally(() => { qualityInstalling = null; });
  return qualityInstalling;
}
async function readPackagedText(relative) {
  const uri = Services.io.newURI(packageURI + relative);
  const Cc = Components.classes, Ci = Components.interfaces;
  if (uri.schemeIs("file")) return IOUtils.readUTF8(uri.QueryInterface(Ci.nsIFileURL).file.path);
  const jar = uri.QueryInterface(Ci.nsIJARURI);
  const reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
  reader.open(jar.JARFile.QueryInterface(Ci.nsIFileURL).file);
  const stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
  try {
    stream.init(reader.getInputStream(jar.JAREntry));
    const bytes = stream.readBytes(stream.available());
    return new TextDecoder().decode(Uint8Array.from(bytes, char => char.charCodeAt(0)));
  } finally { stream.close();reader.close(); }
}
async function setQualityEnabled(enabled) {
  const previous = pref("qualityEnabled", true);
  Zotero.Prefs.set(PREFIX + "qualityEnabled", Boolean(enabled), true);
  try { await updateQualityRuntime(); }
  catch (error) { Zotero.Prefs.set(PREFIX + "qualityEnabled", previous, true); throw error; }
}
async function updateServerHistoryPage() {
  const script = String(pref("serverScript", "")).trim();
  if (!script) return;
  const index = PathUtils.join(script.replace(/[\\\\/][^\\\\/]+$/, ""), "index.html");
  if (!(await IOUtils.exists(index))) return;
  const original = await IOUtils.readUTF8(index);
  const patched = historyPatch.patchHistoryPage(original);
  if (patched === original) return;
  if (await IOUtils.readUTF8(index) !== original) {
    throw new Error("历史页面正在被其他程序修改，请稍后重试。");
  }
  await IOUtils.writeUTF8(index, patched, {tmpPath: index + ".companion-history.tmp"});
}
function openServer() {
  if (opening) return opening;
  if (stopped) return Promise.reject(new Error("插件已停用。"));
  for (const { button } of buttons.values()) button.disabled = true;
  opening = (async () => {
    const url = getServerURL();
    await ensureServer(url);
    try {
      await updateServerHistoryPage();
    } catch (error) {
      Zotero.logError(error);
      Services.prompt.alert(null, "PDF2zh 翻译历史", "历史列表修复暂时无法应用，服务页面仍可使用。\n" + (error.message || String(error)));
    }
    if (stopped) return;
    if (viewer && !viewer.closed && viewerURL === url) { viewer.focus(); return; }
    viewer = Zotero.openInViewer(url + "/");
    viewerURL = url;
  })().finally(() => {
    opening = null;
    for (const { button } of buttons.values()) button.disabled = false;
  });
  return opening;
}
