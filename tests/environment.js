"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const context = { ChromeUtils: { importESModule: () => ({ Subprocess: {} }) }, PathUtils: path.win32 };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/bootstrap.js'), 'utf8') + '\nthis.build = buildServerEnvironment;', context);
if (process.argv[2] === '--emit') {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(context.build(input.python, input.environment)));
} else {
  const python = 'C:\\Conda Space\\envs\\测试\\python.exe';
  for (const key of ['Path', 'PATH', 'path', 'pAtH']) {
    const input = { [key]: 'C:\\old', SystemRoot: 'C:\\Windows', TEMP: 'C:\\tmp' };
    const before = JSON.stringify(input);
    const output = context.build(python, input);
    assert.deepEqual(Object.keys(output).filter(k => k.toUpperCase() === 'PATH'), ['PATH']);
    assert.ok(output.PATH.includes('C:\\Conda Space\\envs\\测试\\Scripts'));
    assert.ok(output.PATH.endsWith('C:\\old'));
    assert.equal(output.SYSTEMROOT, 'C:\\Windows');
    assert.equal(JSON.stringify(input), before);
  }
  const duplicated = context.build(python, { Path: 'old', PATH: 'new', PythonUtf8: '0' });
  assert.equal(Object.keys(duplicated).filter(k => k.toUpperCase() === 'PATH').length, 1);
  assert.equal(duplicated.PYTHONUTF8, '1');
  assert.ok(duplicated.PATH.endsWith('new'));
  assert.equal(context.build('C:\\Python\\python.exe', {Path:'old'}).PATH, 'old');
  assert.equal(context.build('/usr/bin/python', {Path:'case-sensitive',PATH:'unix'}).Path, 'case-sensitive');
  console.log('environment casing, duplicates, inheritance and spaces tests passed');
}
