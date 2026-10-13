"""Actual pinned engine against a local synthetic OpenAI-compatible responder."""
import collections
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import sys
import threading

work=Path(sys.argv[1]).resolve(strict=True)
counts=collections.Counter()
class Responder(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        system=request["messages"][0]["content"]
        prompt=request["messages"][-1]["content"]
        counts["requests"]+=1
        if counts["requests"]==1:
            content="invalid schema"
        elif "exactly src and tgt" in system:
            content=json.dumps([{"src":"scientific","tgt":"科研"}],ensure_ascii=False)
        else:
            def translated(text):
                tokens=re.findall(r"\{\s*v\s*\d+\s*\}|<\s*/?\s*style\b[^>]*>|\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]",text,re.I)
                return "此合成段落仅用于验证科研方法的版面与完整运行流程。"+" ".join(tokens)
            if "exactly id" in system:
                items=json.loads(prompt.rsplit("## Here is the input:",1)[-1])
                content=json.dumps([{"id":x["id"],"output":translated(x["input"])} for x in items],ensure_ascii=False)
            else:content=json.dumps({"translation":translated(prompt.rsplit("Now translate the following text:",1)[-1])},ensure_ascii=False)
        payload=json.dumps({"id":"synthetic-test","object":"chat.completion","created":0,"model":"synthetic",
                            "choices":[{"index":0,"message":{"role":"assistant","content":content},"finish_reason":"stop"}],
                            "usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}).encode()
        self.send_response(200);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(payload)));self.end_headers();self.wfile.write(payload)
server=ThreadingHTTPServer(("127.0.0.1",0),Responder)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
    output=work/"engine-output";output.mkdir(exist_ok=True)
    command=[sys.executable,str(Path(__file__).resolve().parents[1]/"src"/"quality"/"quality_engine.py"),str(work/"synthetic-contents.pdf"),
             "--openai","--openai-model","synthetic-companion-test","--openai-base-url",f"http://127.0.0.1:{server.server_port}/v1",
             "--openai-api-key","synthetic-not-a-secret","--output",str(output),"--lang-in","en","--lang-out","zh-CN",
             "--qps","4","--pool-max-worker","4","--watermark-output-mode","no_watermark","--ignore-cache"]
    before_preflight={path.name:path.read_bytes() for path in output.glob("*.pdf")}
    for options in (["--pages","2"], ["--only-include-translated-page"], ["--max-pages-per-part","50"]):
        rejected=subprocess.run(command+options,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding="utf-8",timeout=60)
        assert rejected.returncode==1, rejected.stdout[-3000:]
        assert "Quality enhancement unavailable:" in rejected.stdout and "关闭" in rejected.stdout, rejected.stdout[-3000:]
        assert counts["requests"]==0, "Unsupported scope must not consume model requests"
        assert {path.name:path.read_bytes() for path in output.glob("*.pdf")}==before_preflight, "Preflight must not change any result"
    result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding="utf-8",timeout=240)
    if result.returncode:
        print(result.stdout[-3000:]);raise SystemExit(result.returncode)
    report=json.loads(next(output.glob("*.quality-checks.json")).read_text("utf-8"))
    assert len(report["outputs"])==2
    assert all(x["font_resource_errors"]==[] for x in report["outputs"])
    assert report["counters"]["toc_entries_rendered"]==10
    assert report["counters"].get("rejected_response",0)>=1
    assert report["counters"].get("accepted_api",0)>=10
    assert "translate 100/100" in result.stdout
    print(json.dumps({"status":"passed","model_calls":"local synthetic responder only","requests":counts["requests"],
                      "output_modes":2,"contents_entries":10,"automatic_terms":"enabled","invalid_response_retried":True,
                      "unsupported_scope_preflight":"3 cases rejected with zero model requests"}))
finally:server.shutdown();server.server_close()
