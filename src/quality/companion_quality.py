"""Small Server hook. Read the add-on preference once for each new job."""
import json
import os
from pathlib import Path
import sys
import shutil


def prepare_quality_runtime_command(command, environment):
    root = Path(__file__).resolve().parents[1] / "companion-quality"
    settings = root / "settings.json"
    if not settings.is_file():
        return command
    enabled = json.loads(settings.read_text("utf-8")).get("enabled", True)
    if not enabled:
        return command
    cmd = list(command)
    name = Path(cmd[0]).stem.lower() if cmd else ""
    if name == "pdf2zh_next":
        resolved = shutil.which(cmd[0], path=environment.get("PATH")) or cmd[0]
        python = Path(resolved).parent / ("python.exe" if os.name == "nt" else "python")
        if not python.is_file():raise ValueError("Cannot locate the engine interpreter")
        return [str(python), str(root / "quality_engine.py"), *cmd[1:]]
    if len(cmd) >= 3 and cmd[1:3] == ["-m", "pdf2zh_next"]:
        return [cmd[0], str(root / "quality_engine.py"), *cmd[3:]]
    return command  # Legacy engine, standalone exe and other tools stay native.
