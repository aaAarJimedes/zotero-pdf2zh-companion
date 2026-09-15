/* global Zotero, Services, IOUtils, PathUtils, ChromeUtils */
"use strict";
const VERSION = "2.0.0";
const PREFIX = "extensions.zotero.pdf2zh.companion.";
const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
const buttons = new Map();
let iconURI, process = null, opening = null, viewer = null, viewerURL = null;
let stopped = false;
function install() {}
function uninstall() {}
async function startup({ rootURI, resourceURI }) {
  await Zotero.initializationPromise;
  iconURI = (rootURI || resourceURI.spec) + "content/icons/server.svg";
  await Zotero.uiReadyPromise;
  Zotero.PDF2ZHCompanion = { version: VERSION, openServer };
  for (const win of Zotero.getMainWindows()) attach(win);
}
function onMainWindowLoad({ window }) { attach(window); }
function onMainWindowUnload({ window }) { detach(window); }
function shutdown() {
  stopped = true;
  for (const win of [...buttons.keys()]) detach(win);
  delete Zotero.PDF2ZHCompanion;
  // Do not interrupt PDF2zh jobs by killing its independently usable Server.
}
function pref(name, fallback) { return Zotero.Prefs.get(PREFIX + name, true) || fallback; }
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
  button.id = "pdf2zh-companion-server-button";
  button.classList.add("zotero-tb-button");
  button.setAttribute("label", "PDF2zh Server");
  button.setAttribute("tooltiptext", "启动本地 PDF2zh Server，并在 Zotero 内打开服务页面");
  button.style.listStyleImage = `url(${iconURI})`;
  button.disabled = Boolean(opening);
  const listener = () => openServer().catch(error => {
    Zotero.logError(error);
    if (!stopped) Services.prompt.alert(win, "PDF2zh Server", error.message || String(error));
  });
  button.addEventListener("command", listener);
  toolbar.appendChild(button);
  buttons.set(win, { button, listener });
}
function detach(win) {
  const entry = buttons.get(win);
  if (!entry) return;
  entry.button.removeEventListener("command", entry.listener);
  entry.button.remove();
  buttons.delete(win);
}
function buildServerEnvironment(python, inherited) {
  const windows = /python\.exe$/i.test(python);
  const environment = {};
  // Normalize before passing a complete environment; never append old Path.
  for (const [key, value] of Object.entries(inherited)) {
    if (value !== null && value !== undefined) environment[windows ? key.toUpperCase() : key] = value;
  }
  const match = python.match(/^(.*?)[\\/]envs[\\/][^\\/]+[\\/]python\.exe$/i);
  if (match) {
    const root = match[1], envRoot = python.replace(/[\\/][^\\/]+$/, "");
    environment.PATH = [envRoot, PathUtils.join(envRoot, "Scripts"),
      PathUtils.join(envRoot, "Library", "bin"), PathUtils.join(envRoot, "Library", "mingw-w64", "bin"),
      PathUtils.join(envRoot, "Library", "usr", "bin"), PathUtils.join(envRoot, "bin"), root,
      PathUtils.join(root, "Scripts"), PathUtils.join(root, "Library", "bin"), environment.PATH || "",
    ].filter(Boolean).join(";");
  }
  environment.PYTHONIOENCODING = "utf-8";
  environment.PYTHONUTF8 = "1";
  return environment;
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
  if (await healthy(url)) return;
  if (stopped) throw new Error("插件已停用。");
  if (!process || process.exitCode !== null) {
    const python = String(pref("serverPython", "")).trim();
    const script = String(pref("serverScript", "")).trim();
    if (!python || !script) throw new Error("请在配置编辑器中填写 extensions.zotero.pdf2zh.companion.serverPython 和 serverScript。");
    if (!(await IOUtils.exists(python))) throw new Error("找不到 Python：" + python);
    if (!(await IOUtils.exists(script))) throw new Error("找不到 Server 脚本：" + script);
    const parsed = new URL(url);
    const launched = await Subprocess.call({
      command: python,
      arguments: [script, "--host", parsed.hostname === "[::1]" ? "::1" : "127.0.0.1",
        "--port", parsed.port || "80", "--enable_venv", "false",
        "--check_update", "false", "--skip_install", "true", "--debug", "false"],
      workdir: script.replace(/[\\/][^\\/]+$/, ""),
      environmentAppend: false,
      environment: buildServerEnvironment(python, Subprocess.getEnvironment()), stderr: "pipe",
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
function openServer() {
  if (opening) return opening;
  if (stopped) return Promise.reject(new Error("插件已停用。"));
  for (const { button } of buttons.values()) button.disabled = true;
  opening = (async () => {
    const url = getServerURL();
    await ensureServer(url);
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
