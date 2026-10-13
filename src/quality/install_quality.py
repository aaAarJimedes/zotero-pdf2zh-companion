"""Install only the known Server hook and this add-on's private runtime."""
import argparse
import json
import os
from pathlib import Path

IMPORT = "from utils.companion_quality import prepare_quality_runtime_command\n"
ANCHOR = "    final_cmd = prepare_deepseek_runtime_command(final_cmd, final_env)\n"
HOOK = "    final_cmd = prepare_quality_runtime_command(final_cmd, final_env)\n"


def patch_execute(text):
    newline = "\r\n" if "\r\n" in text else "\n"
    canonical = text.replace("\r\n", "\n")
    if canonical.count(IMPORT) == 1 and canonical.count(ANCHOR + HOOK) == 1:
        return text
    if IMPORT in canonical or HOOK in canonical or canonical.count(ANCHOR) != 1:
        raise ValueError("Unsupported Server execution hook; no files changed")
    return (IMPORT + canonical.replace(ANCHOR, ANCHOR + HOOK, 1)).replace("\n", newline)


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
    for name in ("quality_guard.py", "quality_engine.py"):
        dest = target / name
        if dest.is_symlink():raise ValueError("Linked runtime file")
        atomic(dest, (source / name).read_bytes())
    helper = server / "utils" / "companion_quality.py"
    if helper.is_symlink():raise ValueError("Linked hook file")
    atomic(helper, (source / "companion_quality.py").read_bytes())
    atomic(target / "settings.json", (json.dumps({"schema": 1, "enabled": enabled}) + "\n").encode())
    if execute.read_bytes() != before:
        raise RuntimeError("Server changed during installation")
    if after != before:atomic(execute, after)
    return {"enabled": enabled, "hook_changed": after != before, "version": "1.0.0"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("server", type=Path)
    parser.add_argument("enabled", choices=("true", "false"))
    args = parser.parse_args()
    try:print(json.dumps(install(args.server, args.enabled == "true")))
    except Exception as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}))
        raise SystemExit(1)
