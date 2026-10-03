#!/usr/bin/env python3
"""
PDF -> paper.json  +  a list of exactly WHICH questions need a screenshot.

  pip install pdfplumber pypdfium2 pillow
  python scripts/pdf_to_paper.py "SSC-CGL-Paper.pdf" --title "SSC CGL 13 Sep 2025 Shift 1"

Creates the folder  build/<pdf-name>/
    paper.json    -> upload this in Admin > Papers (it carries the flags below)
    review.html   -> open in your browser: every question, answer, flags and crops side by side
    report.txt    -> the plain list of problems / flagged questions
    images/       -> a ready-made crop of every flagged question (whole question, answer line removed)

It reads the REAL layout of the PDF (not just text), so it can see:
    * tables / boxes / drawn diagrams       * pictures (figures, picture options)
    * stacked fractions & equations         * math fonts, superscripts / subscripts
and flags those questions. Two levels:
    NEEDS IMAGE  - text cannot be trusted -> attach a screenshot in the admin screen (import is blocked until you do)
    CHECK        - probably fine, but look (e.g. a square-root sign)
Nothing is guessed: unreadable questions are reported, never silently imported.
Option index convention everywhere: 0 = A, 1 = B, 2 = C, 3 = D.
"""
import argparse, html, json, os, re, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_pdf import ANS_RE, LETTERS, ans_index, find_options, missing_letters, parse_key  # noqa: E402

try:
    import pdfplumber
except ImportError:
    sys.exit("Install the tools first:  pip install pdfplumber pypdfium2 pillow")

ANS_LINE = re.compile(r"^\s*(?:correct\s+)?ans(?:wer)?\b", re.I)
SOL_LINE = re.compile(r"^\s*(?:sol(?:ution)?|explanation|exp)\s*[.:\-]", re.I)
KEY_LINE = re.compile(r"^\s*(?:final\s+)?answer\s*key\b", re.I)
MENTION = re.compile(r"\b(table|figure|diagram|graph|chart|pie|histogram|venn|caselet|image|picture|shown below|given below|following data)\b", re.I)
MATH_SYM = re.compile(r"[∑∫∏∠△∥⊥≈≠≤≥∞∂√∛∜°′″⁄½¼¾⅓⅔⅛]")
SUPER = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉]")
PUA = re.compile(r"[\uE000-\uF8FF\uFFFD]")


def region_bands(page, args):
    """Where the repeating header (logo + rule) ends and the footer starts, in PDF points from the top."""
    W, H = page.width, page.height
    hb, ft = 0.0, H
    if args.header_height is not None:
        hb = args.header_height
    else:
        for im in page.images:
            if im["bottom"] < 0.22 * H and (im["bottom"] - im["top"]) < 0.15 * H:
                hb = max(hb, im["bottom"])
        for o in list(page.rects) + list(page.lines):
            if (o["bottom"] - o["top"]) < 3 and (o["x1"] - o["x0"]) > 0.6 * W and o["top"] < 0.22 * H:
                hb = max(hb, o["bottom"])
        hb = hb + 1 if hb else 0.0
    if args.footer_height is not None:
        ft = H - args.footer_height
    else:
        for im in page.images:
            if im["top"] > 0.88 * H and (im["bottom"] - im["top"]) < 0.1 * H:
                ft = min(ft, im["top"])
        for o in list(page.rects) + list(page.lines):
            if (o["bottom"] - o["top"]) < 3 and (o["x1"] - o["x0"]) > 0.6 * W and o["top"] > 0.88 * H:
                ft = min(ft, o["top"])
    return hb, ft


def load(pdf, args, strip_re):
    pages, items = [], []
    for pi, page in enumerate(pdf.pages):
        W, H = page.width, page.height
        hb, ft = region_bands(page, args)
        big = 0.2 * W * H  # watermark-size images are ignored
        inside = lambda o: o["top"] >= hb - 0.5 and o["bottom"] <= ft + 0.5
        imgs = [o for o in page.images if inside(o) and (o["x1"] - o["x0"]) * (o["bottom"] - o["top"]) < big]
        gfx = [o for o in list(page.rects) + list(page.lines) + list(page.curves)
               if inside(o) and not ((o["bottom"] - o["top"]) < 3 and (o["x1"] - o["x0"]) > 0.9 * W)]
        pages.append(dict(W=W, H=H, hb=hb, ft=ft, imgs=imgs, gfx=gfx))
        for ln in page.extract_text_lines(strip=True, return_chars=True):
            if ln["top"] < hb - 1 or ln["bottom"] > ft + 1:
                continue
            if strip_re.search(ln["text"]):
                continue
            items.append(dict(page=pi, top=ln["top"], bottom=ln["bottom"], x0=ln["x0"], x1=ln["x1"], text=ln["text"], chars=ln.get("chars", [])))
    return pages, items


def find_anchors(items, expected):
    """Question starts, using sequential numbering so numbers inside text are never mistaken for questions."""
    anchors, warnings, n, key_start = {}, [], 1, None
    start_re = lambda k: re.compile(r"^\s*(?:Q(?:uestion)?\.?\s*)?%d\s*[.):\-]\s*(.*)$" % k, re.I)
    for i, it in enumerate(items):
        if KEY_LINE.match(it["text"]):
            key_start = i
            break
        for k in (n, n + 1, n + 2):
            if k > expected:
                break
            if k > n:
                prev = anchors.get(n - 1)
                cur = "\n".join(x["text"] for x in items[prev:i]) if prev is not None else ""
                if not prev or not find_options(cur):
                    continue
            if start_re(k).match(it["text"]):
                for s in range(n, k):
                    warnings.append(f"Question {s}: start marker not found - check the PDF around this question.")
                anchors[k] = i
                n = k + 1
                break
    return anchors, warnings, key_start


def inside_rect(o, page, top, bottom):
    cy = (o["top"] + o["bottom"]) / 2
    return top <= cy <= bottom


def analyse(q, items, a, e, pages, expected_text_flags):
    """Everything about one question: text, answer, geometry pieces, and flags."""
    seg = items[a:e]
    cut, ans_line = len(seg), None
    for j, it in enumerate(seg):
        if j > 0 and (ANS_LINE.match(it["text"]) and ANS_RE.search(it["text"])):
            cut, ans_line = j, it
            break
        if j > 0 and SOL_LINE.match(it["text"]):
            cut = j
            break
    content = seg[:cut]
    text = "\n".join(c["text"] for c in content)
    text = re.sub(r"^\s*(?:Q(?:uestion)?\.?\s*)?\d+\s*[.):\-]\s*", "", text, count=1, flags=re.I)

    answer = None
    if ans_line:
        m = ANS_RE.search(ans_line["text"])
        answer = ans_index(m.group(1))
    else:  # answer printed on the same line as the options, or on a later line before the next question
        ms = list(ANS_RE.finditer("\n".join(x["text"] for x in seg)))
        if ms:
            answer = ans_index(ms[-1].group(1))
            text = ANS_RE.sub("", text) if ANS_RE.search(text) else text

    errors, flags = [], []
    found = find_options(text)
    if found:
        qtext = "\n".join(s.strip() for s in found[0].split("\n") if s.strip())
        opts = found[1]
        for i, o in enumerate(opts):
            if not o:
                errors.append(f"Question {q}: option {LETTERS[i]} is empty.")
                flags.append(("image", f"option {LETTERS[i]} is empty (probably a picture)"))
        if not qtext:
            errors.append(f"Question {q}: question text is empty.")
    else:
        miss = missing_letters(text)
        errors.append(f"Could not parse Question {q}. Possible reason: option marker{'s' if len(miss) > 1 else ''} {', '.join(miss)} missing.")
        flags.append(("image", f"options not detected (marker {', '.join(miss)} missing) - options may be pictures"))
        qtext, opts = text.strip(), ["", "", "", ""]

    # ---- pieces (page, top, bottom) covering the question across page breaks
    p0, p1 = content[0]["page"], content[-1]["page"] if content else seg[0]["page"]
    if ans_line:
        p1 = ans_line["page"]
    elif e < len(items):
        p1 = max(p1, items[e]["page"])
    pieces = []
    for p in range(p0, p1 + 1):
        pg = pages[p]
        top = items[a]["top"] - 3 if p == p0 else pg["hb"]
        if p == p1:
            if ans_line:
                bottom = ans_line["top"] - 2
            elif e < len(items) and items[e]["page"] == p:
                bottom = items[e]["top"] - 2
            else:
                bottom = pg["ft"]
        else:
            bottom = pg["ft"]
        if bottom > top:
            pieces.append((p, top, bottom))

    # ---- layout flags
    n_img = n_gfx = 0
    for p, top, bottom in pieces:
        pg = pages[p]
        n_img += sum(1 for o in pg["imgs"] if inside_rect(o, pg, top, bottom))
        n_gfx += sum(1 for o in pg["gfx"] if inside_rect(o, pg, top, bottom))
    if n_img:
        flags.append(("image", f"contains {n_img} picture(s) / figure(s)"))
    if n_gfx >= 3:
        flags.append(("image", "contains a table, box or drawn diagram"))
    elif n_gfx:
        flags.append(("check", "contains a few drawn lines / boxes"))

    chars = [c for it in content for c in it.get("chars", []) if c.get("text", "").strip()]
    if chars:
        med = statistics.median(c["size"] for c in chars)
        small = [c for c in chars if c["size"] < 0.72 * med]
        if len(small) >= 2:
            flags.append(("image", "small raised/lowered text (superscript, subscript or fraction part)"))
        if any(re.search(r"math|cmmi|cmsy|cmex|symbol", c.get("fontname", ""), re.I) for c in chars):
            flags.append(("image", "equation / math font"))
    for a_, b_ in zip(content, content[1:]):
        if a_["page"] == b_["page"]:
            ov = min(a_["bottom"], b_["bottom"]) - max(a_["top"], b_["top"])
            if ov > 0.35 * min(a_["bottom"] - a_["top"], b_["bottom"] - b_["top"]) and abs(a_["x0"] - b_["x0"]) < 200:
                flags.append(("image", "stacked lines of text (fraction or equation)"))
                break
    # borderless tables: several lines that are mostly numbers laid out in columns
    def tableish(t):
        toks = t.split()
        nums = sum(1 for x in toks if re.fullmatch(r"[\d.,%\u20b9$+\-:/]+", x))
        return len(toks) >= 4 and nums >= 3 and not re.match(r"^\s*[(\[]?[a-dA-D][)\].]", t)
    if sum(1 for c in content[1:] if tableish(c["text"])) >= 2:
        flags.append(("image", "rows of numbers laid out like a table (no borders drawn)"))
    alltext = qtext + "\n" + "\n".join(opts)
    if PUA.search(alltext):
        flags.append(("image", "unreadable / private-use characters (equation font)"))
    if MENTION.search(qtext):
        flags.append(("image", "mentions a table / figure / graph / data set"))
    if MATH_SYM.search(alltext):
        flags.append(("check", "contains math symbols (e.g. a root sign) - verify the text"))
    if SUPER.search(alltext):
        flags.append(("check", "contains superscript characters - verify"))
    if ans_line is None and answer is not None:
        flags.append(("check", "answer was not on its own line - the crop may show it"))

    # de-duplicate, keep order
    seen, uniq = set(), []
    for lv, why in flags:
        if why not in seen:
            seen.add(why)
            uniq.append({"level": lv, "reason": why})
    return dict(question_number=q, question_text=qtext, options=opts, correct_option=answer,
                page=p0 + 1, flags=uniq, _pieces=pieces), errors


def make_crop(pieces, pages, renders, items_by_page, dpi, out_path):
    from PIL import Image
    scale = dpi / 72.0
    crops = []
    for p, top, bottom in pieces:
        pg = pages[p]
        xs0, xs1, ys0, ys1 = [], [], [], []
        for it in items_by_page[p]:
            if top <= (it["top"] + it["bottom"]) / 2 <= bottom:
                xs0.append(it["x0"]); xs1.append(it["x1"]); ys0.append(it["top"]); ys1.append(it["bottom"])
        for o in pg["imgs"] + pg["gfx"]:
            if inside_rect(o, pg, top, bottom):
                xs0.append(o["x0"]); xs1.append(o["x1"]); ys0.append(o["top"]); ys1.append(o["bottom"])
        if not xs0:
            continue
        pad = 6
        # vertical padding is clamped to the piece so the "Ans.(x)" line below can NEVER peek into the crop
        box = (max(0, min(xs0) - pad), max(top, min(ys0) - pad), min(pg["W"], max(xs1) + pad), min(bottom, max(ys1) + pad))
        if p not in renders:
            renders[p] = pg["_pdfium"].render(scale=scale).to_pil().convert("RGB")
        im = renders[p]
        crops.append(im.crop(tuple(int(v * scale) for v in box)))
    if not crops:
        return False
    w, h = max(c.width for c in crops), sum(c.height for c in crops)
    sheet = Image.new("RGB", (w, h), "white")
    y = 0
    for c in crops:
        sheet.paste(c, (0, y)); y += c.height
    sheet.save(out_path, optimize=True)
    return True


def review_html(paper, folder):
    rows = []
    for q in paper["questions"]:
        fl = "".join(f'<li class="{f["level"]}">{"NEEDS IMAGE" if f["level"] == "image" else "check"}: {html.escape(f["reason"])}</li>' for f in q["flags"])
        ans = LETTERS[q["correct_option"]] if q["correct_option"] is not None else "?"
        img = f'<img src="{q["crop"]}">' if q.get("crop") else ""
        opts = "<br>".join(f"{LETTERS[i]}) {html.escape(o)}" for i, o in enumerate(q["options"]))
        rows.append(f'<tr class="{"flag" if any(f["level"] == "image" for f in q["flags"]) else ""}"><td><b>Q{q["question_number"]}</b><br>p.{q["page"]}<br>Ans: <b>{ans}</b></td>'
                    f'<td><ul>{fl}</ul>{img}</td><td>{html.escape(q["question_text"])}<br><br>{opts}</td></tr>')
    css = ("body{font-family:system-ui;margin:20px}table{border-collapse:collapse;width:100%}td{border:1px solid #ccc;padding:8px;vertical-align:top;font-size:14px}"
           "tr.flag{background:#fff6e0}img{max-width:560px;border:1px solid #bbb}li.image{color:#b00020;font-weight:600}li.check{color:#8a6d00}ul{padding-left:18px;margin:0 0 6px}")
    s = "".join(rows)
    open(os.path.join(folder, "review.html"), "w", encoding="utf-8").write(
        f"<!doctype html><meta charset=utf-8><title>Review</title><style>{css}</style><h2>{html.escape(paper['title'])}</h2>"
        f"<p>Highlighted rows need a screenshot. Compare each answer and text with the PDF.</p><table>{s}</table>")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--title", default=None)
    ap.add_argument("--out", default=None, help="output folder (default build/<pdf-name>)")
    ap.add_argument("--expected", type=int, default=100)
    ap.add_argument("--dpi", type=int, default=170, help="resolution of the crops")
    ap.add_argument("--no-crops", action="store_true", help="do not render crop images")
    ap.add_argument("--all-images", action="store_true", help="treat EVERY question as a screenshot (use for Hindi PDFs whose text comes out garbled): crops for all questions")
    ap.add_argument("--header-height", type=float, default=None, help="force header height in points (default: auto-detect logo + rule)")
    ap.add_argument("--footer-height", type=float, default=None)
    ap.add_argument("--strip", default=r"adda\s*247|get\s*it\s*on|google\s*play|telegram|join\s+our", help="regex of watermark/ad lines to ignore")
    args = ap.parse_args()

    strip_re = re.compile(args.strip, re.I)
    name = os.path.splitext(os.path.basename(args.pdf))[0]
    folder = args.out or os.path.join("build", name)
    os.makedirs(os.path.join(folder, "images"), exist_ok=True)

    with pdfplumber.open(args.pdf) as pdf:
        pages, items = load(pdf, args, strip_re)
        if sum(len(i["text"]) for i in items) < 100:
            sys.exit("No text found - this looks like a scanned PDF. Run OCR first:  ocrmypdf in.pdf out.pdf")
        anchors, warnings, key_start = find_anchors(items, args.expected)
        end_all = key_start if key_start is not None else len(items)
        key = parse_key("\n".join(i["text"] for i in items[key_start:]) if key_start is not None else "", args.expected)

        renders, items_by_page = {}, {}
        for it in items:
            items_by_page.setdefault(it["page"], []).append(it)
        if not args.no_crops:
            try:
                import pypdfium2 as pdfium
                doc = pdfium.PdfDocument(args.pdf)
                for i, pg in enumerate(pages):
                    pg["_pdfium"] = doc[i]
            except ImportError:
                print("(pypdfium2 not installed - skipping crop images)")
                args.no_crops = True

        order = sorted(anchors)
        questions, errors = [], []
        for q in range(1, args.expected + 1):
            if q not in anchors:
                errors.append(f"Could not parse Question {q}. Possible reason: the question number marker was not found.")
                questions.append(dict(question_number=q, question_text="", options=["", "", "", ""], correct_option=key.get(q), page=0,
                                      flags=[{"level": "image", "reason": "question not found in the PDF text"}], crop=None))
                continue
            a = anchors[q]
            nxt = [anchors[k] for k in order if k > q]
            e = nxt[0] if nxt else end_all
            rec, errs = analyse(q, items, a, e, pages, None)
            errors += errs
            if args.all_images:
                rec["flags"].insert(0, {"level": "image", "reason": "all-images mode"})
            if rec["correct_option"] is None:
                rec["correct_option"] = key.get(q)
            elif q in key and key[q] != rec["correct_option"]:
                warnings.append(f"Question {q}: inline answer ({LETTERS[rec['correct_option']]}) differs from the answer key ({LETTERS[key[q]]}). Inline answer used - verify.")
            if rec["correct_option"] is None:
                errors.append(f'Question {q}: answer not found (no "Ans" line and not in the answer key).')
            rec["crop"] = None
            if rec["flags"] and not args.no_crops:
                path = os.path.join(folder, "images", f"q{q:03d}.png")
                if make_crop(rec["_pieces"], pages, renders, items_by_page, args.dpi, path):
                    rec["crop"] = f"images/q{q:03d}.png"
            del rec["_pieces"]
            questions.append(rec)

    if len(anchors) != args.expected:
        errors.insert(0, f"Detected {len(anchors)} questions but expected {args.expected}.")
    title = args.title or name.replace("-", " ").replace("_", " ")
    paper = dict(title=title, description="", source_filename=os.path.basename(args.pdf), correct_marks=1, wrong_marks=0,
                 report=dict(errors=errors, warnings=warnings), questions=questions)
    json.dump(paper, open(os.path.join(folder, "paper.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    review_html(paper, folder)

    need = [q for q in questions if any(f["level"] == "image" for f in q["flags"])]
    chk = [q for q in questions if q["flags"] and q not in need]
    lines = [f"{os.path.basename(args.pdf)}: {len(anchors)}/{args.expected} questions found, {len(errors)} problem(s), {len(warnings)} warning(s)", ""]
    lines.append(f"NEEDS A SCREENSHOT ({len(need)}): " + (", ".join(f"Q{q['question_number']}" for q in need) or "none"))
    for q in need:
        lines.append(f"  Q{q['question_number']} (PDF page {q['page']}): " + "; ".join(f["reason"] for f in q["flags"]))
    lines += ["", f"CHECK THE TEXT ({len(chk)}): " + (", ".join(f"Q{q['question_number']}" for q in chk) or "none")]
    for q in chk:
        lines.append(f"  Q{q['question_number']} (PDF page {q['page']}): " + "; ".join(f["reason"] for f in q["flags"]))
    if errors or warnings:
        lines += ["", "PROBLEMS / WARNINGS:"] + [f"  - {x}" for x in errors + warnings]
    report = "\n".join(lines)
    open(os.path.join(folder, "report.txt"), "w", encoding="utf-8").write(report)
    print(report)
    print(f"\nOutput folder: {folder}\n  - open {os.path.join(folder, 'review.html')} in your browser to eyeball everything\n  - upload {os.path.join(folder, 'paper.json')} in Admin > Papers")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
