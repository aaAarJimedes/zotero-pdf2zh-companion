"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const bootstrapPath = path.join(projectRoot, "src", "bootstrap.js");
const manifestPath = path.join(projectRoot, "src", "manifest.json");
const source = fs.readFileSync(bootstrapPath, "utf8")
  + "\n;globalThis.__testExports = { translatedScore, chooseOriginal, chooseTranslation, pairKey, checkOpenReaderPairs, ensureServer, translateSelected };";

let openedComparisons = 0;
let healthRequestCount = 0;
let subprocessOptions = null;
let translationCommand = null;
const testPython = "C:\\PDF2zhTest\\envs\\companion\\python.exe";
const testServer = "C:\\PDF2zhTest\\server\\server.py";
const readerItems = new Map();
const zoteroMock = {
  Prefs: {
    get(key) {
      if (key.endsWith("autoCompareOpenReaders")) return true;
      if (key.endsWith("serverPython")) return testPython;
      if (key.endsWith("serverScript")) return testServer;
      return undefined;
    },
  },
  HTTP: {
    async request() {
      healthRequestCount++;
      if (healthRequestCount === 1) {
        throw new Error("server is initially offline");
      }
      return {
        response: {
          status: "ok",
          version: "4.1.7",
          message: "PDF2zh Server is running",
          outputDir: "C:\\PDF2zhTest\\server\\translated",
        },
      };
    },
  },
  Reader: { _readers: [] },
  Items: { get: id => readerItems.get(id) },
  Promise: { delay: async () => {} },
  pdf2zh: {
    hooks: {
      onDialogEvents(command) {
        translationCommand = command;
      },
    },
  },
  ProgressWindow: class ProgressWindow {
    constructor() {
      this.ItemProgress = class ItemProgress {
        setProgress() {}
      };
    }
    changeHeadline() {}
    show() {}
    startCloseTimer() {}
  },
  debug() {},
  logError() {},
  getMainWindow() {
    return {
      openDialog() {
        openedComparisons++;
        return {
          document: { readyState: "loading" },
          addEventListener() {},
        };
      },
    };
  },
};
const subprocessMock = {
  getEnvironment() {
    return { PATH: "C:\\Windows\\System32" };
  },
  async call(options) {
    subprocessOptions = options;
    return {
      exitCode: null,
      stdout: { readString: async () => "" },
      stderr: { readString: async () => "" },
      wait() {
        return new Promise(() => {});
      },
      async kill() {},
    };
  },
};

const sandbox = {
  ChromeUtils: {
    importESModule() {
      return { Subprocess: subprocessMock };
    },
  },
  IOUtils: { exists: async () => true },
  PathUtils: {
    join(...parts) {
      return parts.join("\\");
    },
  },
  URL,
  Zotero: zoteroMock,
  console,
};
vm.runInNewContext(source, sandbox, { filename: bootstrapPath });

const {
  translatedScore,
  chooseOriginal,
  chooseTranslation,
  pairKey,
  checkOpenReaderPairs,
  ensureServer,
  translateSelected,
} = sandbox.__testExports;
const item = (id, title, filename, dateAdded) => ({
  id,
  attachmentFilename: filename,
  dateAdded,
  getField(field) {
    return field === "title" ? title : "";
  },
});

const original = item(1, "A useful paper", "paper.pdf", "2026-01-01");
const mono = item(2, "siliconflowfree-mono", "paper-mono.pdf", "2026-01-02");
const dual = item(3, "siliconflowfree-dual", "paper-dual.pdf", "2026-01-03");
for (const attachment of [original, mono, dual]) {
  attachment.parentItemID = 10;
  attachment.isPDFAttachment = () => true;
  readerItems.set(attachment.id, attachment);
}

assert.equal(translatedScore(original), 0);
assert.ok(translatedScore(mono) > translatedScore(dual));
assert.equal(chooseOriginal([dual, original, mono]).id, original.id);
assert.equal(chooseTranslation([original, dual, mono], original).id, mono.id);
assert.equal(pairKey({ original, translation: mono }), "1:2");

(async () => {
  zoteroMock.Reader._readers = [{ itemID: original.id }, { itemID: mono.id }];
  await checkOpenReaderPairs();
  await checkOpenReaderPairs();
  assert.equal(openedComparisons, 1, "an unchanged open pair should only auto-open once");

  zoteroMock.Reader._readers = [{ itemID: original.id }];
  await checkOpenReaderPairs();
  zoteroMock.Reader._readers = [{ itemID: original.id }, { itemID: mono.id }];
  await checkOpenReaderPairs();
  assert.equal(openedComparisons, 2, "closing and reopening a pair should auto-open again");

  const health = await ensureServer();
  assert.equal(health.status, "ok");
  assert.equal(health.version, "4.1.7");
  assert.equal(
    subprocessOptions.command,
    testPython,
  );
  assert.equal(subprocessOptions.workdir, "C:\\PDF2zhTest\\server");
  assert.deepEqual(
    Array.from(subprocessOptions.arguments),
    [
      testServer,
      "--port", "8890",
      "--enable_venv", "false",
      "--check_update", "false",
      "--skip_install", "true",
      "--debug", "false",
    ],
  );
  assert.equal(subprocessOptions.environment.PYTHONIOENCODING, "utf-8");
  assert.equal(subprocessOptions.environment.PYTHONUTF8, "1");
  const pathEntries = subprocessOptions.environment.PATH.split(";");
  assert.deepEqual(pathEntries.slice(0, 6), [
    "C:\\PDF2zhTest\\envs\\companion",
    "C:\\PDF2zhTest\\envs\\companion\\Scripts",
    "C:\\PDF2zhTest\\envs\\companion\\Library\\bin",
    "C:\\PDF2zhTest\\envs\\companion\\Library\\mingw-w64\\bin",
    "C:\\PDF2zhTest\\envs\\companion\\Library\\usr\\bin",
    "C:\\PDF2zhTest\\envs\\companion\\bin",
  ]);
  assert.ok(pathEntries.indexOf("C:\\PDF2zhTest\\Scripts") > 1);
  assert.equal(pathEntries.at(-1), "C:\\Windows\\System32");

  const selectedItem = { id: 99 };
  await translateSelected({
    ZoteroPane: {
      getSelectedItems() {
        return [selectedItem];
      },
    },
  });
  assert.equal(translationCommand, "translatePDF");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.applications.zotero.id, "pdf2zh-companion@local");
  assert.equal(manifest.version, "1.2.3");
  assert.match(source, new RegExp(`const ADDON_VERSION = "${manifest.version.replaceAll('.', '\\.') }"`));
  const settings = manifest.applications.zotero;
  for (const field of ["id", "update_url", "strict_max_version"]) {
    assert.ok(settings[field], `Zotero requires applications.zotero.${field}`);
  }
  assert.equal(settings.update_url, "https://github.com/aaAarJimedes/zotero-pdf2zh-companion/releases/latest/download/updates.json");
  assert.equal(manifest.name, "PDF2zh 本地伴侣");

  assert.match(source, /\/pdf2zh-companion\/status/);
  assert.match(source, /translateButtonCount/);
  assert.match(source, /openPreviewAvailable/);
  assert.match(source, /getElementById\("zotero-items-toolbar"\)/);
  assert.match(source, /Zotero\.HTTP\.request\("GET"/);
  assert.match(source, /init: async function \(_request\)/);
  assert.match(source, /normalizeServerHealth/);
  assert.match(source, /onDialogEvents\("translatePDF"\)/);
  assert.doesNotMatch(source, /pdf2zh-companion-translate-menuitem/);
  assert.doesNotMatch(source, /\/pdf2zh-companion\/compare-test/);
  assert.doesNotMatch(source, /\/pdf2zh-companion\/ensure-server-test/);

  console.log("smoke tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
