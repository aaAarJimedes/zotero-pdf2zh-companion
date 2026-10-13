"""Offline checks for rejection, bounded retry and cache safety."""
import json
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src" / "quality"))
from types import SimpleNamespace as N
from quality_guard import QualityGuard, RejectedTranslation, validate,validate_batch,batch_of


def run():
    source="The free energy changes when temperature increases {v1} [37]."
    assert validate(source,"温度升高时自由能改变 {v1} [37]。") == []
    assert "model_commentary" in validate(source,"Let's check the glossary. 温度变化 {v1} [37]。")
    assert "placeholder_mismatch" in validate(source,"温度升高时自由能改变 [37]。")
    assert "citation_mismatch" in validate(source,"温度升高时自由能改变 {v1} [38]。")
    assert "untranslated_prose" in validate(source,source)
    assert validate("[]",'[{"src":"free energy","tgt":"自由能"}]',json_mode=True)==[]
    assert validate("[]",'[{"src":"free energy"}]',json_mode=True)
    assert validate("Scope","Scope",strict_language=True)
    batch=[{"id":0,"input":source},{"id":1,"input":"Scope"}]
    valid_batch=json.dumps([{"id":1,"output":"范围"},{"id":0,"output":"温度升高时自由能改变 {v1} [37]。"}])
    assert batch_of("## Here is the input:\n"+json.dumps(batch))==batch
    assert validate_batch(batch,valid_batch,"zh-CN")==[]
    assert validate_batch(batch,'[{"id":0,"output":"范围"}]',"zh-CN")==["batch_count_mismatch"]
    assert validate_batch(batch,'[{"src":"free energy","tgt":"自由能"}]',"zh-CN")
    saved={source:"Let's translate. "+source}
    responses=iter([json.dumps({"translation":source}),json.dumps({"translation":"温度升高时自由能改变 {v1} [37]。"})])
    calls=[]
    def create(**args):
        calls.append(args)
        return N(choices=[N(message=N(content=next(responses)))],usage=None)
    translator=N(ignore_cache=False,cache=N(get=saved.get,set=lambda k,v:saved.__setitem__(k,v)),lang_out="zh-CN",translate_call_count=0,translate_cache_call_count=0,
                 rate_limiter=N(wait=lambda p:None),model="test",options={},client=N(chat=N(completions=N(create=create))),prompt=lambda text:[{"content":text}])
    g=QualityGuard({"pages":[]})
    assert g.translate(translator,source)=="温度升高时自由能改变 {v1} [37]。"
    assert len(calls)==2 and "Let's" not in saved[source]
    assert g.translate(translator,source)==saved[source] and len(calls)==2
    assert g.counts["rejected_cache"]==1
    assert not any(source in str(v) for v in g.report().values())
    translator.client.chat.completions.create=lambda **k:N(choices=[N(message=N(content='{"translation":""}'))],usage=None)
    before=dict(saved)
    try:g.translate(translator,"Another paragraph",ignore_cache=True)
    except RejectedTranslation:pass
    else:raise AssertionError("invalid output accepted")
    assert saved==before and g.counts["unresolved_translation"]==1
    prompt="## Here is the input:\n"+json.dumps(batch)
    translator.client.chat.completions.create=lambda **k:N(choices=[N(message=N(content=valid_batch))],usage=None)
    assert json.loads(g.translate(translator,prompt,llm=True,rate_limit_params={"request_json_mode":True}))==json.loads(valid_batch)
    if "--offline" in sys.argv:
        print("PASS: offline response/cache/batch checks");return
    # Verify against the actual pinned runtime, including its procress spelling.
    from pdf2zh_next.translator.base_translator import BaseTranslator
    from babeldoc.format.pdf.document_il.midend.layout_parser import LayoutParser
    from babeldoc.format.pdf.document_il.midend.automatic_term_extractor import AutomaticTermExtractor
    from babeldoc.format.pdf.document_il.midend.il_translator_llm_only import ILTranslatorLLMOnly
    originals=(BaseTranslator.translate,LayoutParser.process)
    assert callable(AutomaticTermExtractor.procress)
    g.install();g.restore()
    assert originals==(BaseTranslator.translate,LayoutParser.process)
    original_page=ILTranslatorLLMOnly.process_page
    seen=[];advanced=[]
    def native_submit(owner,page,executor,pbar,*a,**k):
        seen.extend(p.layout_label for p in page.pdf_paragraph)
    ILTranslatorLLMOnly.process_page=native_submit
    paragraphs=[N(layout_label="plain text"),N(layout_label="abandon")]
    page=N(pdf_paragraph=paragraphs)
    try:
        g.install()
        ILTranslatorLLMOnly.process_page(None,page,None,N(advance=advanced.append))
        assert seen==["plain text"] and advanced==[1] and page.pdf_paragraph is paragraphs
        assert not ILTranslatorLLMOnly._should_translate_paragraph(None,paragraphs[1])
    finally:
        g.restore();ILTranslatorLLMOnly.process_page=original_page
    print("PASS: output checks, invalid-cache rejection, retries and no invalid cache writes")


if __name__=="__main__":run()
