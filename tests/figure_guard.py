"""Exercise raw figure characters/vectors against installed, unmodified APIs."""
import hashlib
import os
from pathlib import Path
import sys
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "quality"))
from figure_guard import should_preserve_character, should_preserve_graphic


def boundaries():
    def box(*values):
        return NS(**dict(zip(("x", "y", "x2", "y2"), values)))
    layouts = {
        0: NS(class_name="figure", box=box(10, 10, 100, 100)),
        1: NS(class_name="fallback_line", box=box(0, 40, 190, 60)),
        2: NS(class_name="figure_caption", box=box(10, 90, 100, 110)),
        3: NS(class_name="table_cell", box=box(120, 10, 145, 30)),
        4: NS(class_name="chart_title", box=box(30, 70, 90, 85)),
    }
    class Index:
        def intersection(self, coordinates):
            return layouts  # Coverage still excludes all non-overlapping boxes.
    index, config = Index(), NS()
    def preserve(bounds):
        return should_preserve_character(NS(box=bounds, visual_bbox=None), index, layouts, config)
    assert preserve(box(40, 45, 50, 55))
    assert preserve(box(125, 15, 135, 25))
    assert preserve(box(40, 73, 50, 83))
    assert not preserve(box(40, 94, 50, 104)), "Captions remain translatable"
    assert not preserve(box(99, 45, 109, 55)), "Don't absorb adjacent prose"
    assert not preserve(box(100, 45, 110, 55))
    assert preserve(box(9, 45, 19, 55)), "Exactly 90% is protected"
    assert should_preserve_graphic(NS(box=box(20, 20, 90, 20)), index, layouts, config)
    config.preserve_figure_table = False
    assert not preserve(box(40, 45, 50, 55))
    os.environ["PDF2ZH_PRESERVE_FIGURE_TABLE"] = "1"
    assert preserve(box(40, 45, 50, 55))
    os.environ.pop("PDF2ZH_PRESERVE_FIGURE_TABLE")


def integration():
    from babeldoc.format.pdf.document_il.il_version_1 import (
        Box, Page, PageLayout, PdfCharacter, PdfCurve, PdfForm, PdfFormula,
        PdfParagraph, PdfParagraphComposition, PdfStyle, VisualBbox,
    )
    from babeldoc.format.pdf.document_il.midend import paragraph_finder, styles_and_formulas
    from quality_guard import QualityGuard
    ParagraphFinder = paragraph_finder.ParagraphFinder
    StylesAndFormulas = styles_and_formulas.StylesAndFormulas
    sources = [Path(module.__file__) for module in (paragraph_finder, styles_and_formulas)]
    snapshots = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in sources}
    originals = (ParagraphFinder.process_page, StylesAndFormulas._collect_element_formula_candidates,
                 StylesAndFormulas.remove_non_formula_lines_from_paragraphs)
    layouts = [
        PageLayout(id=1, class_name="figure", box=Box(10, 10, 100, 100)),
        PageLayout(id=2, class_name="fallback_line", box=Box(0, 40, 190, 60)),
        PageLayout(id=3, class_name="table_cell", box=Box(120, 10, 145, 30)),
        PageLayout(id=4, class_name="figure_caption", box=Box(10, 90, 100, 110)),
        PageLayout(id=5, class_name="image", box=Box(150, 10, 170, 100)),
        PageLayout(id=6, class_name="fallback_line", box=Box(10, 90, 100, 110)),
    ]
    def char(text, bounds, cid):
        return PdfCharacter(char_unicode=text, box=bounds, visual_bbox=VisualBbox(box=bounds),
                            pdf_style=PdfStyle(font_id="OriginalFont", font_size=10),
                            pdf_character_id=cid, xobj_id=1, render_order=cid, vertical=False)
    retained = [char("figure-marker", Box(40, 45, 50, 55), 1),
                char("cell-marker", Box(125, 15, 135, 25), 2)]
    body = char("body-marker", Box(175, 45, 185, 55), 3)
    caption = char("caption-marker", Box(40, 94, 50, 104), 4)
    guard = QualityGuard({"pages": [{"protected": [], "height": 200}]})
    finder = ParagraphFinder.__new__(ParagraphFinder)
    finder.translation_config = NS(preserve_figure_table=True, formular_font_pattern=None,
                                   ocr_workaround=False, debug=False, split_short_lines=False)
    guard.install()
    try:
        page = Page(page_number=0, page_layout=layouts, pdf_character=[*retained, body, caption])
        finder.process_page(page)
        assert [id(c) for c in page.pdf_character] == [id(c) for c in retained]
        text = " ".join(p.unicode for p in page.pdf_paragraph)
        assert "body-marker" in text and "caption-marker" in text
        assert "figure-marker" not in text and "cell-marker" not in text
        # The native term extractor consumes only these paragraphs, never raw
        # page characters. Protected labels therefore cannot become glossary input.
        assert guard.counts["protected_structure_characters"] == 2
        protected_curve = PdfCurve(box=Box(20, 20, 90, 20), xobj_id=1)
        image_curve = PdfCurve(box=Box(155, 20, 165, 30), xobj_id=1)
        ordinary_curve = PdfCurve(box=Box(175, 20, 185, 30), xobj_id=1)
        protected_form = PdfForm(box=Box(20, 20, 80, 80), xobj_id=1)
        ordinary_form = PdfForm(box=Box(175, 20, 185, 30), xobj_id=1)
        formula = PdfFormula(box=Box(0, 0, 200, 115))
        page.pdf_paragraph = [PdfParagraph(box=Box(0, 0, 200, 115), xobj_id=1,
            pdf_paragraph_composition=[PdfParagraphComposition(pdf_formula=formula)])]
        page.pdf_curve = [protected_curve, image_curve, ordinary_curve]
        page.pdf_form = [protected_form, ordinary_form]
        styles = StylesAndFormulas.__new__(StylesAndFormulas)
        styles.translation_config = NS(preserve_figure_table=True,
            figure_table_protection_threshold=0.9, non_formula_line_iou_threshold=0.9)
        _, curves, forms = styles._collect_element_formula_candidates(page)
        assert set(curves) == {2} and set(forms) == {1}
        styles.collect_contained_elements(page)
        assert page.pdf_curve == [protected_curve, image_curve]
        assert page.pdf_form == [protected_form]
        assert formula.pdf_curve == [ordinary_curve] and formula.pdf_form == [ordinary_form]
        page.pdf_curve.append(ordinary_curve)
        styles.remove_non_formula_lines_from_paragraphs(page)
        assert page.pdf_curve == [protected_curve, image_curve]
        assert page.pdf_curve[0] is protected_curve and page.pdf_curve[1] is image_curve
    finally:
        guard.restore()
    assert originals == (ParagraphFinder.process_page, StylesAndFormulas._collect_element_formula_candidates,
                         StylesAndFormulas.remove_non_formula_lines_from_paragraphs)
    assert snapshots == {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in sources}


previous = os.environ.pop("PDF2ZH_PRESERVE_FIGURE_TABLE", None)
try:
    boundaries()
    if "--offline" not in sys.argv:
        integration()
        print("PASS: figure boundaries/captions, raw character/vector preservation, reversible process hooks")
    else:
        print("PASS: offline figure coverage, caption, adjacent prose and switch checks")
finally:
    if previous is None:
        os.environ.pop("PDF2ZH_PRESERVE_FIGURE_TABLE", None)
    else:
        os.environ["PDF2ZH_PRESERVE_FIGURE_TABLE"] = previous
