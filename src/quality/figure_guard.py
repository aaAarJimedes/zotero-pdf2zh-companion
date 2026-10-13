"""Process-local figure/table protection for BabelDOC 0.6.2.

Use the native layout index and original character/vector objects. No installed
package files are changed, and an older installed protection patch is harmless.
"""
import math
import os

MIN_COVERAGE = 0.9
AREA_LABELS = frozenset({"figure", "table", "image"})
CONTENT_LABELS = frozenset({
    "figure_text", "figure_text_hybrid", "table_text", "table_cell",
    "table_cell_hybrid", "wired_table_cell", "wireless_table_cell",
    "figure_title", "chart_title", "table_title",
})
CAPTION_LABELS = frozenset({
    "figure_caption", "table_caption", "caption", "caption_hybrid",
    "table_footnote",
})


def enabled(config):
    override = os.environ.get("PDF2ZH_PRESERVE_FIGURE_TABLE")
    if override is not None:
        if override.strip().lower() in {"0", "false", "off", "no"}:
            return False
        if override.strip().lower() in {"1", "true", "on", "yes"}:
            return True
        raise ValueError("Invalid PDF2ZH_PRESERVE_FIGURE_TABLE switch")
    return bool(getattr(config, "preserve_figure_table", True))


def _coordinates(box):
    if box is None:
        return None
    values = tuple(float(getattr(box, key)) for key in ("x", "y", "x2", "y2"))
    if not all(math.isfinite(value) for value in values):
        return None
    if values[2] < values[0] or values[3] < values[1]:
        return None
    return values


def _coverage(item, region):
    """Use the object's area/length; don't expand into neighbouring prose."""
    x, y, x2, y2 = item
    rx, ry, rx2, ry2 = region
    width, height = x2 - x, y2 - y
    overlap_x = max(0.0, min(x2, rx2) - max(x, rx))
    overlap_y = max(0.0, min(y2, ry2) - max(y, ry))
    if width and height:
        return overlap_x * overlap_y / (width * height)
    if width:
        return overlap_x / width if ry <= y <= ry2 else 0.0
    if height:
        return overlap_y / height if rx <= x <= rx2 else 0.0
    return float(rx <= x <= rx2 and ry <= y <= ry2)


def _covering_labels(box, layout_index, layout_map):
    coordinates = _coordinates(box)
    if coordinates is None:
        return set()
    labels = set()
    for key in layout_index.intersection(coordinates):
        layout = layout_map[key]
        label = layout.class_name
        if label not in AREA_LABELS | CONTENT_LABELS | CAPTION_LABELS:
            continue
        region = _coordinates(layout.box)
        if region is not None and _coverage(coordinates, region) >= MIN_COVERAGE:
            labels.add(label)
    return labels


def should_preserve_character(char, layout_index, layout_map, config):
    if not enabled(config):
        return False
    visual_box = getattr(getattr(char, "visual_bbox", None), "box", None)
    labels = _covering_labels(visual_box or char.box, layout_index, layout_map)
    if labels & CONTENT_LABELS:
        return True
    if labels & CAPTION_LABELS:
        return False
    return bool(labels & AREA_LABELS)


def should_preserve_graphic(element, layout_index, layout_map, config):
    if not enabled(config):
        return False
    labels = _covering_labels(element.box, layout_index, layout_map)
    return bool(labels & (AREA_LABELS | CONTENT_LABELS))


def install_graphics(replace):
    """Register reversible wrappers with the quality guard's existing lifecycle."""
    from babeldoc.format.pdf.document_il.midend.styles_and_formulas import StylesAndFormulas
    from babeldoc.format.pdf.document_il.utils.layout_helper import build_layout_index

    original_candidates = StylesAndFormulas._collect_element_formula_candidates

    def candidates(owner, page):
        formulas, curves, forms = original_candidates(owner, page)
        index, layouts = build_layout_index(page)
        def keep(values):
            return {key: value for key, value in values.items()
                    if not should_preserve_graphic(value[0], index, layouts, owner.translation_config)}
        return formulas, keep(curves), keep(forms)

    replace(StylesAndFormulas, "_collect_element_formula_candidates", candidates)
    original_cleanup = StylesAndFormulas.remove_non_formula_lines_from_paragraphs

    def cleanup(owner, page):
        index, layouts = build_layout_index(page)
        original_curves = page.pdf_curve
        protected = {id(curve) for curve in original_curves
                     if should_preserve_graphic(curve, index, layouts, owner.translation_config)}
        if not protected:
            return original_cleanup(owner, page)
        page.pdf_curve = [curve for curve in original_curves if id(curve) not in protected]
        try:
            return original_cleanup(owner, page)
        finally:
            remaining = {id(curve) for curve in page.pdf_curve}
            # Native cleanup only removes curves. Preserve source ordering and
            # identity, including zero-width lines and the original PDF Forms.
            page.pdf_curve = [curve for curve in original_curves
                              if id(curve) in protected or id(curve) in remaining]

    replace(StylesAndFormulas, "remove_non_formula_lines_from_paragraphs", cleanup)
