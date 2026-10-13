"""Real PDF geometry regression with synthetic content; no model calls."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"src"/"quality"))
import fitz
from quality_guard import QualityGuard, build_structure_plan, toc_overlay, inspect_layout, verify_preservation, audit_font_resources

work=Path(sys.argv[1]).resolve(strict=True)
source=work/"synthetic-contents.pdf"
doc=fitz.open()
for _ in range(2):doc.new_page(width=600,height=800)
page=doc[0];page.insert_text((40,40),"Contents",fontsize=15)
for i in range(10):
    y=90+i*28
    page.insert_text((40,y),f"{i+1} Example scientific section {i+1}",fontsize=10)
    page.insert_text((300,y),"............................",fontsize=10)
    page.insert_text((530,y),"2",fontsize=10)
    page.insert_link({"kind":fitz.LINK_GOTO,"from":fitz.Rect(40,y-11,285,y+3),"page":1,"to":fitz.Point(40,60+i*12)})
doc[1].insert_text((40,60),"This synthetic text checks output geometry without translating a user paper.",fontsize=10)
for page in doc:
    page.draw_line((20,735),(580,735),width=.3)
    page.insert_text((40,760),"Publication footer: immutable source",fontsize=9)
doc.save(source);doc.close()
plan=build_structure_plan(source)
assert len(plan["toc_entries"])==10
for mode,first in [("LR",False),("LR",True),("mono",True),("alternating",False),("alternating",True)]:
    original=fitz.open(source);raw=fitz.open()
    for i,page in enumerate(original):
        if mode=="LR":
            out=raw.new_page(width=1200,height=800)
            out.show_pdf_page(fitz.Rect(0,0,600,800),original,i)
            out.show_pdf_page(fitz.Rect(600,0,1200,800),original,i)
        else:
            for _ in range(2 if mode=="alternating" else 1):
                out=raw.new_page(width=600,height=800);out.show_pdf_page(out.rect,original,i)
    name=f"{mode}-{'first' if first else 'second'}"
    raw_path=work/(name+"-raw.pdf");output=work/(name+".pdf")
    raw.save(raw_path);raw.close();original.close()
    guard=QualityGuard(plan,workers=2)
    guard.translate=lambda translator,text,**kw:"科研方法章节"
    toc_overlay(source,raw_path,output,plan,guard,None,mode=mode,translate_first=first)
    assert guard.counts["toc_entries_rendered"]==10
    assert guard.counts["source_footers_restored"]==2
    result=fitz.open(output)
    index=0 if mode!="alternating" or first else 1
    offset=600 if mode=="LR" and not first else 0
    assert "科研" in result[index].get_text(clip=fitz.Rect(offset,0,offset+600,800))
    assert len([link for link in result[index].get_links() if link.get("page")== (2 if mode=="alternating" and first else 3 if mode=="alternating" else 1)])>=10
    result.close()
    assert audit_font_resources(output)==[]
    inspect_layout(output,plan,mode=mode,translate_first=first)
    if mode=="LR" and not first:
        check=verify_preservation(source,output,plan)
        assert not check["original_text_mismatch_pages"]
        assert not check["toc_page_number_mismatch_entries"]
        assert not check["toc_link_mismatch_entries"]
broken=fitz.open();page=broken.new_page()
stream=broken.get_new_xref();broken.update_object(stream,"<<>>");broken.update_stream(stream,b"BT /MissingQualityFont 10 Tf 30 30 Td (test) Tj ET")
page.set_contents(stream);broken_path=work/"missing-font-negative.pdf";broken.save(broken_path);broken.close()
assert audit_font_resources(broken_path)==[{"page":1,"kind":"missing_font_resource","resource":"/MissingQualityFont"}]
print(json.dumps({"synthetic_pages":2,"contents_entries":10,"output_modes_checked":5,"font_resources":"passed including negative case","model_calls":0}))
