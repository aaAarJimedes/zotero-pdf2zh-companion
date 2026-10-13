"""Standard-library regression: known hook, disabled jobs and compatibility."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile

root = Path(__file__).resolve().parents[1] / "src" / "quality"
sys.path.insert(0, str(root))
from install_quality import patch_execute, install, ANCHOR, IMPORT, HOOK, WINDOWS, PIPE
from quality_engine import validate_output_scope, UnsupportedQualitySettings
from types import SimpleNamespace

# No pages/ranges means full-document processing. Zero means native splitting
# is disabled; optional false/empty values must not reject the normal defaults.
for pages, split in ((None, None), ("", 0)):
    validate_output_scope(SimpleNamespace(pages=pages, only_include_translated_page=False, max_pages_per_part=split))
for overrides in ({"pages":"2"}, {"pages":"1-"}, {"only_include_translated_page":True}, {"max_pages_per_part":50}):
    options={"pages":None, "only_include_translated_page":False, "max_pages_per_part":None, **overrides}
    try:validate_output_scope(SimpleNamespace(**options))
    except UnsupportedQualitySettings as error:assert "关闭" in str(error)
    else:raise AssertionError("Unsupported page mapping must fail before translation")

fixture = ("import os\ndef _windows_visible_console_size():\n    return None\ndef execute():\n"
           + ANCHOR + "    if True:\n" + WINDOWS + "\n    return final_cmd\n")
assert patch_execute(patch_execute(fixture)) == patch_execute(fixture)
assert PIPE in patch_execute(fixture)
assert patch_execute(IMPORT + fixture.replace(ANCHOR, ANCHOR + HOOK).replace(WINDOWS, PIPE)) == patch_execute(fixture)
for unknown in ("different version", fixture.replace(ANCHOR, ANCHOR*2), IMPORT+fixture):
    try:patch_execute(unknown)
    except ValueError:pass
    else:raise AssertionError("Unknown execution source must be rejected")
with tempfile.TemporaryDirectory(prefix="companion-quality-") as directory:
    server = Path(directory)
    (server/"utils").mkdir()
    (server/"utils"/"execute.py").write_text(fixture)
    assert install(server, True)["hook_changed"]
    assert not install(server, True)["hook_changed"]
    spec = importlib.util.spec_from_file_location("test_native_hook", server/"utils"/"companion_quality.py")
    hook = importlib.util.module_from_spec(spec);spec.loader.exec_module(hook)
    command=[str(Path(sys.executable).parent/"pdf2zh_next.exe"), "sample.pdf", "--openai"]
    wrapped=hook.prepare_quality_runtime_command(command, {})
    assert wrapped[0]==sys.executable and wrapped[2:]==command[1:]
    assert Path(wrapped[1]).resolve()==(server/"companion-quality"/"quality_engine.py").resolve()
    legacy=["pdf2zh", "sample.pdf"]
    assert hook.prepare_quality_runtime_command(legacy,{}) is legacy
    assert hook.prepare_quality_runtime_command(["pdf2zh.exe","sample.pdf"],{})==["pdf2zh.exe","sample.pdf"]
    install(server, False)
    assert hook.prepare_quality_runtime_command(command,{}) is command
print("PASS: idempotent installation, pinned hook, interpreter, legacy passthrough and per-job toggle")
