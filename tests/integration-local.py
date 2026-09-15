"""Opt-in one-page live translation test; never runs in CI.
Uses the configured siliconflowfree service. May consume service quota.
Copies server/config locally; never modifies the original server or Zotero.
"""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import time
import urllib.request

import fitz
import psutil

spec = importlib.util.spec_from_file_location('native', Path(__file__).with_name('windows-native.py'))
native = importlib.util.module_from_spec(spec); spec.loader.exec_module(native)
parser = argparse.ArgumentParser()
parser.add_argument('--server', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
source = Path(args.server).resolve()
output = Path(args.output).resolve()
output.mkdir(exist_ok=False)
runtime = output / 'server'
shutil.copytree(source, runtime, ignore=shutil.ignore_patterns('translated', '__pycache__', '*.pdf', '*.log', '.DS_Store'))
(runtime / 'translated').mkdir()
doc = fitz.open(); page = doc.new_page()
page.insert_text((60, 80), 'Translation verification', fontsize=18)
page.insert_textbox(fitz.Rect(60, 120, 530, 450), 'Water is essential for life. Plants use sunlight to produce energy.\n\nThis short document contains no personal information. It is used to verify that the translation service can produce a readable Chinese PDF.', fontsize=12)
sample = output / 'sample.pdf'; doc.save(sample)
page.get_pixmap().save(output / 'sample.png'); doc.close()
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
env = native.fixed_environment(sys.executable, dict(os.environ))
command = [sys.executable, '-u', str(runtime / 'server.py'), '--port', str(port), '--enable_venv', 'false', '--check_update', 'false', '--skip_install', 'true', '--debug', 'false']
k, pi = native.launch(command, env, str(runtime), str(output / 'server.log'))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
base = f'http://127.0.0.1:{port}'
def request(route, data=None):
    req = urllib.request.Request(base + route, data=json.dumps(data).encode() if data else None, headers={'Content-Type':'application/json'})
    with opener.open(req, timeout=20) as response:
        return json.load(response)
try:
    for attempt in range(60):
        try:
            if request('/health')['status'] == 'ok': break
        except Exception: time.sleep(1)
    else: raise RuntimeError('test server did not start')
    print('Isolated server ready; unique PATH; submitting approved synthetic page', flush=True)
    job = request('/translate', {'fileName':'sample.pdf', 'fileContent':base64.b64encode(sample.read_bytes()).decode(), 'engine':'pdf2zh_next', 'service':'siliconflowfree', 'next_service':'siliconflowfree', 'sourceLang':'en', 'targetLang':'zh-CN', 'qps':1, 'mono':True, 'dual':True, 'dualMode':'LR', 'noWatermark':True, 'asyncJob':True})
    assert job['status'] == 'accepted', job
    task_id = job['taskId']
    for attempt in range(90):
        history = request('/api/history').get('history', [])
        task = next((item for item in history if item['taskId'] == task_id), None)
        if task and task.get('finished'):
            print('Task result:', task.get('status'), task.get('error'), flush=True)
            if task['status'] != 'success': raise RuntimeError('translation task failed; inspect local log')
            break
        if attempt % 6 == 0: print('Translation still running', flush=True)
        time.sleep(5)
    else: raise TimeoutError('translation exceeded 450 seconds')
    files = list((runtime / 'translated').glob('*mono*.pdf')) + list((runtime / 'translated').glob('*dual*.pdf'))
    assert len(files) >= 2, 'mono/dual missing'
    for pdf in files:
        with fitz.open(pdf) as document:
            text = ''.join(page.get_text() for page in document)
            chinese = sum('\u4e00' <= c <= '\u9fff' for c in text)
            assert chinese > 10, f'Chinese output missing: {pdf.name}'
            document[0].get_pixmap().save(output / (pdf.stem + '.png'))
            print('Verified PDF:', pdf.name, 'pages:',len(document), 'Chinese characters:',chinese, flush=True)
finally:
    try:
        process = psutil.Process(pi.pid)
        children = process.children(recursive=True)
        for child in reversed(children):
            try: child.terminate()
            except psutil.NoSuchProcess: pass
        psutil.wait_procs(children, timeout=5)
    except psutil.NoSuchProcess:
        pass
    k.TerminateProcess(pi.process, 0)
    k.WaitForSingleObject(pi.process, 5000)
    k.CloseHandle(pi.thread); k.CloseHandle(pi.process)
