"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const patch = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/history-patch.js"), "utf8"), patch);
const legacy = `      const STORAGE_KEY = "pdf2zh_history_v2";
      function getLocalHistory() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
      function clearLocalHistory() { if (confirm("clear?")) { localStorage.removeItem(STORAGE_KEY); displayHistory([]); } }
      function mergeHistory(serverHistory) { return serverHistory; }
      function toggleHistoryItem(el) {}`;
const fixed = patch.patchHistoryPage(legacy);
assert.equal(patch.patchHistoryPage(fixed), fixed, "repair must be idempotent");
assert.throws(() => patch.patchHistoryPage("unrelated page"), /不兼容/);
assert.throws(() => patch.patchHistoryPage(legacy + legacy), /不兼容/);
const storage = new Map();
const NOW = Date.parse("2026-10-10T10:00:00Z");
class Clock extends Date { static now() { return NOW; } }
function page() {
  let shown, dialog;
  const storageEvents = {};
  const context = {
    Date: Clock,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    displayHistory: value => { shown = value; },
    confirm() { throw Error("native confirm is unavailable in the viewer"); },
    alert() { throw Error("unexpected storage failure"); },
    window: { addEventListener: (event, callback) => { storageEvents[event] = callback; } },
    document: {
      getElementById: () => dialog,
      body: { appendChild: item => { dialog = item; } },
      createElement: tag => {
        assert.equal(tag, "dialog");
        const item = {style:{}, querySelector: () => ({ addEventListener: (event, callback) => { item.submit = callback; } }),
          addEventListener: (event, callback) => { if (event === "close") item.close = callback; },
          showModal() { this.modal = true; }, remove() { dialog = undefined; }};
        return item;
      },
    },
  };
  vm.runInNewContext(fixed, context);
  return {context, get dialog() { return dialog; }, get shown() { return shown; }, storageEvents};
}
const old = {fileName:"synthetic.pdf", startTime:"2026-10-10T09:00:00Z", endTime:"2026-10-10T09:30:00Z"};
const completedLater = {fileName:"later.pdf", startTime:"2026-10-10T09:15:00Z", endTime:"2026-10-10T10:01:00Z"};
const first = page();
assert.equal(first.context.mergeHistory([old]).length, 1);
first.context.clearLocalHistory();
assert.ok(first.dialog.modal);
first.dialog.submit({submitter:{value:"cancel"}});
first.dialog.close();
assert.equal(first.context.getLocalHistory().length, 1, "cancel must keep history");
first.context.clearLocalHistory();
const existing = first.dialog;
first.context.clearLocalHistory();
assert.equal(first.dialog, existing, "double click must not create another modal");
first.dialog.submit({submitter:{value:"clear"}});
first.dialog.close();
assert.equal(first.shown.length, 0);
assert.equal(first.context.mergeHistory([old]).length, 0, "an in-flight old response must not restore cleared records");
const reloaded = page();
assert.equal(reloaded.context.mergeHistory([old]).length, 0, "refresh must stay empty");
assert.equal(reloaded.context.mergeHistory([old, completedLater]).length, 1, "in-flight translations finishing later must be kept");
assert.equal(reloaded.context.getLocalHistory()[0].fileName, "later.pdf");
reloaded.storageEvents.storage({key:"pdf2zh_history_cleared_at_v1"});
assert.equal(reloaded.shown.length, 1);
assert.equal(reloaded.context.mergeHistory(null).length, 1);
assert.equal(reloaded.context.mergeHistory([null, "invalid", old]).length, 1);
storage.set("pdf2zh_history_v2", "invalid JSON");
assert.equal(reloaded.context.getLocalHistory().length, 0);
console.log("history clear, cancel, reload, stale response, later completions, cross-window and guarded installation passed");
