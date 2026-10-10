"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const directory = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw Error("Usage: node server-fix/install-history.cjs <Server directory> [backup path]");
function noLinks(file) {
  for (let current = file; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error("Refusing a linked path");
    if (path.dirname(current) === current) break;
  }
}
const index = path.join(directory, "index.html");
noLinks(index);
if (!fs.statSync(path.join(directory, "server.py")).isFile()) throw Error("Missing Server entry point");
const scope = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/history-patch.js"), "utf8"), scope);
const original = fs.readFileSync(index, "utf8");
const fixed = scope.patchHistoryPage(original);
if (fixed !== original) {
  if (process.argv[3]) {
    const backup = path.resolve(process.argv[3]);
    noLinks(path.dirname(backup));
    fs.writeFileSync(backup, original, {encoding:"utf8", flag:"wx"});
  }
  const temporary = index + ".companion-history.tmp";
  try {
    fs.writeFileSync(temporary, fixed, {encoding:"utf8", flag:"wx"});
    if (fs.readFileSync(index, "utf8") !== original) throw Error("Server page changed during installation");
    fs.renameSync(temporary, index);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
console.log(fixed === original ? "History page already repaired" : "History page repaired; refresh the viewer. No task or Server restart required.");
