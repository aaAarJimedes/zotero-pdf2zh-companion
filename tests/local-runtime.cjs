const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const python = 'D:\\softwares\\zotero-pdf2zh\\.venv-official\\Scripts\\python.exe';
const basePrefix = 'D:\\softwares\\Python313';
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(systemroot|windir|comspec|temp|tmp|userprofile|localappdata|appdata|pathext)$/i.test(key)));
const Subprocess = {
  async call(options) {
    assert.equal(options.environmentAppend, false);
    const result = spawnSync(options.command, options.arguments, {
      env: options.environment, encoding: 'utf8', timeout: 30000,
    });
    if (result.error) throw result.error;
    const pipe = value => ({ async readString() { const output = value; value = ''; return output; } });
    return { stdout: pipe(result.stdout), stderr: pipe(result.stderr),
      async wait() { return { exitCode: result.status }; } };
  },
};
const context = { ChromeUtils: { importESModule: () => ({ Subprocess }) },
  PathUtils: { join: path.win32.join }, URL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/bootstrap.js'), 'utf8') +
  '\nglobalThis.check = { buildServerEnvironment, probeServerRuntime };', context);

function runNative(environment, command) {
  const result = spawnSync(python, ['-c',
    'import subprocess,sys; p=subprocess.run(sys.argv[1:],capture_output=True); sys.exit(p.returncode)',
    ...command], { env: environment, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  return result;
}

(async () => {
  const staging = path.resolve('D:\\Agent Workspaces\\Temp\\remote-access');
  fs.mkdirSync(staging, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(staging, 'pdf2zh-launch-check-'));
  try {
    const runtime = await context.check.probeServerRuntime(python,
      { ...inherited, Path: path.join(process.env.SystemRoot, 'System32') });
    assert.equal(runtime.prefix, path.dirname(path.dirname(python)));
    assert.equal(runtime.base_prefix, basePrefix);
    const layouts = ['envs\\fixture', 'custom-prefix', '中文 环境\\venv'];
    let checks = 0;
    for (const layout of layouts) {
      const prefix = path.join(temporary, layout);
      const scripts = path.join(prefix, 'Scripts');
      fs.mkdirSync(scripts, { recursive: true });
      fs.copyFileSync(path.join(process.env.SystemRoot, 'System32', 'cmd.exe'),
        path.join(scripts, 'pdf2zh_next.exe'));
      for (const duplicatePath of [false, true]) {
        const input = { ...inherited, Path: path.join(process.env.SystemRoot, 'System32') };
        if (duplicatePath) input.PATH = 'C:\\fixture-secondary-path';
        const selectedPython = layout.endsWith('venv') ? path.join(scripts, 'python.exe')
          : path.join(prefix, 'python.exe');
        const env = context.check.buildServerEnvironment(selectedPython, input,
          { prefix, base_prefix: basePrefix });
        assert.equal(Object.keys(env).filter(k => k.toLowerCase() === 'path').length, 1);
        assert(env.PATH.split(';').includes(scripts));
        if (duplicatePath) assert(env.PATH.includes('C:\\fixture-secondary-path'));
        const result = runNative(env, ['pdf2zh_next', '/d', '/c', 'exit 0']);
        assert.equal(result.status, 0, result.stderr);
        checks++;
      }
    }
    const env = context.check.buildServerEnvironment(python,
      { ...inherited, Path: path.join(process.env.SystemRoot, 'System32') }, runtime);
    const result = runNative(env, ['pdf2zh_next', '--help']);
    assert.equal(result.status, 0, result.stderr);
    console.log(JSON.stringify({ native_path_checks: checks, runtime_probe: 'passed',
      real_engine_launch: 'passed', command: 'pdf2zh_next --help' }));
  } finally {
    const resolved = path.resolve(temporary);
    assert(resolved.startsWith(staging + path.sep));
    function verify(directory) {
      assert(!fs.lstatSync(directory).isSymbolicLink());
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        assert(!fs.lstatSync(target).isSymbolicLink());
        if (entry.isDirectory()) verify(target);
      }
    }
    verify(resolved);
    fs.rmSync(resolved, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
