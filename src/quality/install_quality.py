"""Install only the known Server hook and this add-on's private runtime."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path

IMPORT = "from utils.companion_quality import prepare_quality_runtime_command\n"
ANCHOR = "    final_cmd = prepare_deepseek_runtime_command(final_cmd, final_env)\n"
HOOK = "    final_cmd = prepare_quality_runtime_command(final_cmd, final_env)\n"
WINDOWS = "        _execute_with_inherit(final_cmd, final_env, task_id, cols)"
PIPE = ("        if _windows_visible_console_size() is None:\n"
        "            from utils.companion_pipe_progress import execute_pipe\n"
        "            execute_pipe(final_cmd, final_env, task_id, cols)\n"
        "        else:\n" + "    " + WINDOWS)


def patch_execute(text):
    newline = "\r\n" if "\r\n" in text else "\n"
    canonical = text.replace("\r\n", "\n")
    if not (canonical.count(IMPORT) == 1 and canonical.count(ANCHOR + HOOK) == 1):
        if IMPORT in canonical or HOOK in canonical or canonical.count(ANCHOR) != 1:
            raise ValueError("Unsupported Server execution hook; no files changed")
        canonical = IMPORT + canonical.replace(ANCHOR, ANCHOR + HOOK, 1)
    if PIPE not in canonical:
        if ("from utils.companion_pipe_progress" in canonical
                or canonical.count(WINDOWS + "\n") != 1
                or "def _windows_visible_console_size():" not in canonical):
            raise ValueError("Unsupported Server progress hook; no files changed")
        canonical = canonical.replace(WINDOWS, PIPE, 1)
    return canonical.replace("\n", newline)


def atomic(path, data):
    tmp = path.with_name(path.name + ".companion-quality.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def install(server, enabled):
    if server.is_symlink() or server.is_junction():
        raise ValueError("Linked Server path is not supported")
    server = server.resolve(strict=True)
    execute = server / "utils" / "execute.py"
    if (server / "utils").is_symlink() or (server / "utils").is_junction() or execute.is_symlink():
        raise ValueError("Linked Server path is not supported")
    before = execute.read_bytes()
    after = patch_execute(before.decode("utf-8")).encode("utf-8")
    compile(after, str(execute), "exec")
    source = Path(__file__).resolve().parent
    target = server / "companion-quality"
    if target.exists() and (target.is_symlink() or target.is_junction()):
        raise ValueError("Linked runtime directory is not supported")
    target.mkdir(exist_ok=True)
    for name in ("quality_guard.py", "quality_engine.py", "figure_guard.py"):
        dest = target / name
        if dest.is_symlink():raise ValueError("Linked runtime file")
        atomic(dest, (source / name).read_bytes())
    for name in ("companion_quality.py", "companion_pipe_progress.py"):
        helper = server / "utils" / name
        if helper.is_symlink():raise ValueError("Linked hook file")
        atomic(helper, (source / name).read_bytes())
    atomic(target / "settings.json", (json.dumps({"schema": 1, "enabled": enabled}) + "\n").encode())
    if execute.read_bytes() != before:
        raise RuntimeError("Server changed during installation")
    if after != before:atomic(execute, after)
    return {"enabled": enabled, "hook_changed": after != before, "version": "2.2.0"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("server", type=Path)
    parser.add_argument("enabled", choices=("true", "false"))
    args = parser.parse_args()
    try:
        if args.enabled == "true":
            for package, required in (("pdf2zh-next", "2.9.0"), ("BabelDOC", "0.6.2")):
                try:actual = importlib.metadata.version(package)
                except importlib.metadata.PackageNotFoundError:actual = "未安装"
                if actual != required:
                    raise ValueError(f"所选 Python 的 {package} 为 {actual}，当前增强需要 {required}。请按子插件安装说明配置翻译环境。")
            for package in ("Flask", "toml", "pypdf", "PyMuPDF"):
                try:importlib.metadata.version(package)
                except importlib.metadata.PackageNotFoundError:
                    raise ValueError(f"所选 Python 缺少 {package}，请按子插件安装说明补齐依赖。") from None
        print(json.dumps(install(args.server, args.enabled == "true"), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}))
        raise SystemExit(1)
