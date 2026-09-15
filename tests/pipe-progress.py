"""Run with the configured server Python; no PDF or external API required."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import threading

sys.path.insert(0, sys.argv[1])
from utils import execute
from utils.task_manager import task_manager

spec = importlib.util.spec_from_file_location("pipe_fix", Path(__file__).parents[1] /
                                            "server-fix/companion_pipe_progress.py")
fix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fix)
updates = []
live = threading.Event()
original_update = task_manager.update_task
def capture(task, data):
    updates.append(dict(data))
    if data.get("progress") == 25:
        live.set()
task_manager.update_task = capture
errors = []
def run():
    try:
        fix.execute_pipe([sys.executable, "-u", "-c", "import os,time; "
            "os.write(1,b'\\x1b[32mtrans');time.sleep(.05);"
            "os.write(1,b'late 1/4\\x1b[0m\\r');time.sleep(1);"
            "os.write(2,'解析\\n'.encode());os.write(1,b'translate 2/4\\rtranslate 4/4')"],
            os.environ, "test", 80)
    except BaseException as exc:
        errors.append(exc)
with contextlib.redirect_stdout(io.StringIO()):
    worker = threading.Thread(target=run)
    worker.start()
    assert live.wait(10), "No intermediate progress"
    assert worker.is_alive(), "Progress appeared only after exit"
    worker.join(10)
assert not worker.is_alive() and not errors, errors
assert [x['progress'] for x in updates if 'progress' in x] == [25, 50, 100], updates
with contextlib.redirect_stdout(io.StringIO()):
    try:
        fix.execute_pipe([sys.executable, '-c', 'raise SystemExit(7)'], os.environ, 'test', 80)
        raise AssertionError('Failure swallowed')
    except subprocess.CalledProcessError as exc:
        assert exc.returncode == 7
print('PASS: live progress before exit, fragmented ANSI/UTF-8 stream, CR, stderr, EOF, failure exit')

# Installed executor dispatch + actual Rich rendering + original task manager.
import time
from types import SimpleNamespace
task_manager.update_task = original_update
task_manager.add_task('rich-test', {'active': True, 'progress': 0})
rich_code = '''
import time
from rich.progress import Progress, TextColumn, BarColumn, MofNCompleteColumn
with Progress(TextColumn('{task.description}'), BarColumn(), MofNCompleteColumn(), refresh_per_second=10) as p:
    t=p.add_task('translate',total=4)
    for i in range(4):
        p.update(t,advance=1)
        time.sleep(.6)
'''
def rich_run():
    try:
        execute.execute_with_progress([sys.executable, '-u', '-c', rich_code],
            'rich-test', SimpleNamespace(enable_venv=False), None)
    except BaseException as exc:
        errors.append(exc)
seen = set()
with contextlib.redirect_stdout(io.StringIO()):
    worker = threading.Thread(target=rich_run)
    worker.start()
    deadline = time.monotonic()+15
    while worker.is_alive() and time.monotonic()<deadline:
        seen.add(task_manager.get_active_tasks_list()[0].get('progress', 0))
        time.sleep(.05)
    worker.join(1)
assert not worker.is_alive() and not errors, errors
assert any(0 < p < 100 for p in seen), seen
assert task_manager.get_active_tasks_list()[0]['progress'] == 100
print('PASS: installed Windows pipe dispatch, real Rich rendering, real task manager:', sorted(seen))
