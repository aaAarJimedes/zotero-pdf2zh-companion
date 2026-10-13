"""Native CLI settings, guarded replies, and checked PDF postprocessing.

The Server receives the original filenames only after postprocessing succeeds.
Diagnostic output contains counts and coordinates, never content or credentials.
"""
import asyncio
import contextlib
import hashlib
import importlib.metadata
import json
import logging
import os
from pathlib import Path
import sys
import warnings

from quality_guard import QualityGuard, build_structure_plan, toc_overlay, inspect_layout, verify_preservation, audit_font_resources

STREAM = sys.stdout


class UnsupportedQualitySettings(ValueError):
    """A fixed local message, safe to show without upstream request data."""


def validate_output_scope(pdf):
    # The structure plan uses original page indexes. Native split/reduced
    # outputs renumber them; partial requests must not translate other TOCs.
    if pdf.pages or pdf.only_include_translated_page or pdf.max_pages_per_part:
        raise UnsupportedQualitySettings(
            "译文与排版增强暂仅支持不分段的整篇翻译。使用指定页码、仅保留译页或分段翻译时，"
            "请先右键 PDF2zh Server 按钮关闭“译文与排版增强”，再重新提交。尚未发起模型请求。")


def emit(percent):
    print(f"translate {int(percent)}/100", file=STREAM, flush=True)


def digest(path):
    with Path(path).open("rb") as stream:return hashlib.file_digest(stream, "sha256").hexdigest()


async def run():
    from pdf2zh_next.config.main import ConfigManager
    from pdf2zh_next.high_level import create_babeldoc_config
    from babeldoc.format.pdf.high_level import async_translate
    from babeldoc.format.pdf.translation_config import TranslationConfig
    settings = ConfigManager().initialize_config()
    if settings.basic.version:
        print(importlib.metadata.version("pdf2zh-next"), file=STREAM);return 0
    if settings.basic.gui:raise ValueError("Use the native GUI entry point")
    if importlib.metadata.version("pdf2zh-next") != "2.9.0" or importlib.metadata.version("babeldoc") != "0.6.2":
        raise ValueError("Quality enhancement requires pdf2zh-next 2.9.0 and BabelDOC 0.6.2")
    validate_output_scope(settings.pdf)
    # Dense inline styling was a cause of the accepted comparison's poor layout.
    # This is per-job only; disabling the feature restores the saved native value.
    settings.pdf.disable_rich_text_translate = True
    settings.pdf.translate_table_text = False
    original_path = TranslationConfig.get_working_file_path
    trackers = {"translate_tracking.json", "term_extractor_tracking.json", "term_extractor_freq.json"}
    def working_path(owner, name):
        return Path(os.devnull) if name in trackers else original_path(owner, name)
    TranslationConfig.get_working_file_path = working_path
    try:
        files = sorted(settings.basic.input_files)
        if not files:raise ValueError("No input PDF")
        for source in files:
            source = Path(source).resolve(strict=True)
            source_hash = digest(source)
            plan = build_structure_plan(source)
            workers = settings.translation.pool_max_workers or 4
            guard = QualityGuard(plan, workers=max(1, workers))
            config = None
            guard.install()
            try:
                config = create_babeldoc_config(settings, source)
                config.preserve_figure_table = True
                if not hasattr(getattr(config.translator, "client", None), "chat"):
                    raise ValueError("Quality enhancement currently requires the OpenAI-compatible translation service")
                config.translator.client.max_retries = 0
                if getattr(config, "term_translator", None) and hasattr(config.term_translator, "client"):
                    config.term_translator.client.max_retries = 0
                result = None
                async for event in async_translate(config):
                    if isinstance(event.get("overall_progress"), (int, float)):
                        progress = event["overall_progress"]
                        emit(min(90, progress * .9))
                    if event.get("type") == "error":raise RuntimeError("Native translation failed")
                    if event.get("type") == "finish":
                        result = event["translate_result"];break
                if result is None:raise RuntimeError("Translation did not produce a result")
                reports = []
                seen = set()
                for field in ("mono_pdf_path", "dual_pdf_path", "no_watermark_mono_pdf_path", "no_watermark_dual_pdf_path"):
                    value = getattr(result, field, None)
                    if not value:continue
                    output = Path(value).resolve(strict=True)
                    if output in seen:continue
                    seen.add(output)
                    if output == source:raise ValueError("Output must not replace the source")
                    mode = "mono" if "mono" in field else "alternating" if settings.pdf.use_alternating_pages_dual else "LR"
                    translated_first = settings.pdf.dual_translate_first if mode != "mono" else True
                    temporary = output.with_name(output.stem + ".companion-quality.pdf")
                    try:
                        await asyncio.to_thread(toc_overlay, source, output, temporary, plan, guard, config.translator,
                                                mode=mode, translate_first=translated_first)
                        checks = {"mode": mode, "translation_first": translated_first,
                                  "layout_candidates": inspect_layout(temporary, plan, mode=mode, translate_first=translated_first)}
                        checks["font_resource_errors"] = audit_font_resources(temporary)
                        if checks["font_resource_errors"]:raise RuntimeError("PDF font resource check failed")
                        if mode == "LR" and not translated_first:
                            checks["preservation"] = verify_preservation(source, temporary, plan)
                            preservation = checks["preservation"]
                            if (not preservation["pages_match"] or preservation["geometry_mismatch_pages"]
                                    or preservation["original_text_mismatch_pages"] or preservation["reference_missing_character_regions"]):
                                raise RuntimeError("PDF preservation check failed")
                        if digest(source) != source_hash:raise RuntimeError("Source changed")
                        os.replace(temporary, output)
                        reports.append({**checks, "output_sha256": digest(output)})
                    finally:
                        with contextlib.suppress(FileNotFoundError):temporary.unlink()
                if not seen:raise RuntimeError("No PDF output")
                report = {"version": "1.0.0", "source_sha256": source_hash, "source_pages": len(plan["pages"]),
                          **guard.report(), "outputs": reports, "checks_are_heuristics_not_semantic_acceptance": True}
                # One bounded sidecar per source, alongside the native outputs.
                path = next(iter(seen)).parent / (source.stem + ".quality-checks.json")
                tmp = path.with_suffix(".json.tmp")
                tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
                os.replace(tmp, path)
                emit(100)
            finally:
                guard.restore()
                if config:
                    config.cancel_translation()
                    client = getattr(config.translator, "client", None)
                    if client:client.close()
    finally:
        TranslationConfig.get_working_file_path = original_path
    return 0


def main():
    logging.disable(logging.CRITICAL)
    warnings.simplefilter("ignore")
    with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        try:return asyncio.run(run())
        except UnsupportedQualitySettings as error:
            print("Quality enhancement unavailable: " + str(error), file=STREAM, flush=True)
            return 1
        except Exception as error:
            # Only known local validation messages are printable; upstream errors
            # may include request bodies and never belong in Server logs.
            import traceback
            frames = [{"file": Path(frame.filename).name, "line": frame.lineno, "function": frame.name}
                      for frame in traceback.extract_tb(error.__traceback__)[-4:]]
            print("Quality enhancement failed: " + json.dumps({"type": type(error).__name__, "frames": frames}), file=STREAM, flush=True)
            return 1


if __name__ == "__main__":raise SystemExit(main())
