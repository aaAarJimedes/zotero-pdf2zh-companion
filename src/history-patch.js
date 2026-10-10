"use strict";

// Embedded into the existing Server page; no Server restart or task mutation.
function historyPageFunctions() {
  // PDF2ZH_COMPANION_HISTORY_FIX 2.0.2
  const STORAGE_KEY = "pdf2zh_history_v2";
  const HISTORY_CLEARED_AT = "pdf2zh_history_cleared_at_v1";
  function visibleHistory(history) {
    const cutoff = Number(localStorage.getItem(HISTORY_CLEARED_AT)) || 0;
    return (Array.isArray(history) ? history : []).filter(item => {
      if (!item || typeof item !== "object") return false;
      if (!cutoff) return true;
      // A running task that completes after clearing must still appear.
      const finished = Date.parse(item.endTime || item.startTime);
      return Number.isFinite(finished) && finished > cutoff;
    });
  }
  function getLocalHistory() {
    try { return visibleHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
    catch (_) { return []; }
  }
  function saveLocalHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleHistory(history)));
  }
  function clearLocalHistory() {
    if (document.getElementById("historyClearDialog")) return;
    // Zotero's built-in viewer may suppress window.confirm().
    const dialog = document.createElement("dialog");
    dialog.id = "historyClearDialog";
    dialog.style.cssText = "border:0;border-radius:12px;padding:24px;max-width:420px;box-shadow:0 8px 40px #0004";
    dialog.innerHTML = '<form method="dialog"><h3>清空翻译历史？</h3><p>只清空本机历史列表，不删除原文或译文，也不停止正在翻译的任务。</p><p style="display:flex;gap:12px;justify-content:flex-end"><button class="btn" value="cancel">取消</button><button class="btn clear-btn" value="clear">清空记录</button></p></form>';
    dialog.querySelector("form").addEventListener("submit", event => {
      if (event.submitter?.value !== "clear") return;
      try {
        localStorage.setItem(HISTORY_CLEARED_AT, String(Date.now()));
        localStorage.removeItem(STORAGE_KEY);
        displayHistory([]);
      } catch (_) {
        event.preventDefault();
        alert("无法保存清空状态，请检查页面的本地存储权限后重试。");
      }
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  function mergeHistory(serverHistory) {
    const map = new Map();
    getLocalHistory().forEach(item => map.set(item.fileName + item.startTime, item));
    visibleHistory(serverHistory).forEach(item => map.set(item.fileName + item.startTime, item));
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    saveLocalHistory(merged);
    return merged;
  }
  window.addEventListener("storage", event => {
    if (event.key === HISTORY_CLEARED_AT) displayHistory(getLocalHistory());
  });
}

function patchHistoryPage(html) {
  if (html.includes("PDF2ZH_COMPANION_HISTORY_FIX 2.0.2")) return html;
  const target = /      const STORAGE_KEY = "pdf2zh_history_v2";[\s\S]*?(?=      function toggleHistoryItem\()/g;
  const matches = Array.from(html.matchAll(target));
  if (matches.length !== 1 || !matches[0][0].includes("function clearLocalHistory()")
      || !matches[0][0].includes("function mergeHistory(serverHistory)")) {
    throw new Error("当前 Server 历史页面不兼容此修复，未修改页面。");
  }
  const source = historyPageFunctions.toString();
  const body = source.slice(source.indexOf("{") + 1, source.lastIndexOf("}"));
  return html.replace(target, body + "\n");
}
