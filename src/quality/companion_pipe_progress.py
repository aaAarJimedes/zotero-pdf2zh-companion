"""Pipe-mode progress adapter for Zotero PDF2zh Server 4.1.7 (MIT).

Keep the upstream console path intact. This adapter is used only when stdout
is not a Windows console, e.g. a server started by Zotero's Subprocess API.
"""
import codecs
import os
import re
import subprocess
import sys


def execute_pipe(cmd, env, task_id, cols):
    from utils.execute import _parse_progress
    from utils.task_manager import task_manager

    child_env = dict(env)
    child_env.update(PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1",
                     COLUMNS=str(max(160, cols)), TERM="xterm-256color",
                     FORCE_COLOR="1", FORCE_TERMINAL="1")
    child_env.pop("NO_COLOR", None)
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, env=child_env, bufsize=0)
    if task_id is not None:
        task_manager.update_task(task_id, {"status": "running",
            "message": "翻译引擎已启动，等待阶段进度…"})
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    pending = ""
    try:
        while True:
            chunk = os.read(process.stdout.fileno(), 8192)
            if not chunk:
                break
            text = decoder.decode(chunk)
            # Continue forwarding upstream logs, but don't let a closed log
            # consumer prevent draining the child pipe (which would deadlock).
            try:
                sys.stdout.write(text)
                sys.stdout.flush()
            except (OSError, ValueError, UnicodeError):
                pass
            pending += text
            lines = re.split(r"[\r\n]", pending)
            pending = lines.pop()
            for line in lines:
                _parse_progress(line, task_id)
            # Bound memory even for malformed/unbroken engine output.
            if len(pending) > 65536:
                _parse_progress(pending, task_id)
                pending = pending[-4096:]
        pending += decoder.decode(b"", final=True)
        if pending:
            _parse_progress(pending, task_id)
    except BaseException:
        if process.poll() is None:
            process.terminate()
        raise
    finally:
        process.stdout.close()
        return_code = process.wait()
    if return_code:
        raise subprocess.CalledProcessError(return_code, cmd)
