#!/usr/bin/env python3
"""
Offline PDF -> JSON importer (same rules as the in-browser importer).

  pip install pypdf
  python scripts/import_pdf.py my-paper.pdf -o data/my-paper.json --title "SSC CGL Shift 1"

Then in Admin > Papers choose the .json file, review/fix highlighted questions, click Import.
Option index convention everywhere: 0 = A, 1 = B, 2 = C, 3 = D.
Handles:  Q1. / 1. / 1) / Question 1:   (a) / a) / A.   Ans.(b) / Ans: b   and a trailing "Answer Key".
Never guesses: every problem is printed per question and left empty/null in the JSON for you to fix.
"""
import argparse, json, re, sys

LETTERS = "ABCD"
NOISE = re.compile(r"^\s*(?:page\s*\d+(?:\s*(?:of|/)\s*\d+)?|-\s*\d+\s*-|\d+\s*/\s*\d+)\s*$", re.I)
ANS_RE = re.compile(r"ans(?:wer)?\s*(?:[.:\-\u2013]\s*[(\[]?|[(\[])\s*([a-dA-D1-4])\s*[)\]]?(?![A-Za-z])", re.I)
SOL_RE = re.compile(r"\n\s*(?:sol(?:ution)?|explanation|exp)\s*[.:\-]", re.I)


def ans_index(tok):
    return int(tok) - 1 if tok.isdigit() else LETTERS.index(tok.upper())


def parse_key(text, expected):
    out = {}
    for m in re.finditer(r"(?:Q\.?\s*)?(\d{1,3})\s*[.\-:)]*\s*[(\[]?\s*([a-dA-D1-4])\s*[)\]]?(?![A-Za-z0-9])", text):
        n = int(m.group(1))
        if 1 <= n <= expected and n not in out:
            out[n] = ans_index(m.group(2))
    return out


def marker(l):
    return re.compile(r"(?:^|\s)[(\[]?%s[)\]\.]\s*" % l, re.I)


def find_options(t):
    a_matches = list(marker("a").finditer(t))
    for am in reversed(a_matches):  # last "a" whose b,c,d follow in order
        pos = [(am.start(), am.end() - am.start())]
        frm, ok = am.end(), True
        for l in "bcd":
            m = marker(l).search(t, frm)
            if not m:
                ok = False
                break
            pos.append((m.start(), m.end() - m.start()))
            frm = m.end()
        if not ok:
            continue
        opts = []
        for k, (i, ln) in enumerate(pos):
            end = pos[k + 1][0] if k < 3 else len(t)
            opts.append(re.sub(r"\s+", " ", t[i + ln:end]).strip())
        return t[: pos[0][0]].strip(), opts
    return None


def missing_letters(t):
    miss, frm = [], 0
    for l in "abcd":
        m = marker(l).search(t, frm)
        if not m:
            miss.append(l.upper())
        else:
            frm = m.end()
    return miss


def parse(raw, expected=100):
    errors, warnings = [], []
    text = re.sub(r"[ \t]+", " ", raw.replace("\r", "").replace("\u00a0", " "))
    key_text = ""
    hdr = list(re.finditer(r"^\s*(?:final\s+)?answer\s*key\b.*$", text, re.I | re.M))
    if hdr:
        key_text, text = text[hdr[-1].start():], text[: hdr[-1].start()]
    key = parse_key(key_text, expected)

    lines = [l for l in text.split("\n") if not NOISE.match(l)]
    start_re = lambda n: re.compile(r"^\s*(?:Q(?:uestion)?\.?\s*)?%d\s*[.):\-]\s*(.*)$" % n, re.I)
    blocks, title_lines, n, cur = {}, [], 1, None
    for line in lines:
        started = False
        for k in (n, n + 1, n + 2):
            if k > expected:
                break
            if k > n and (not cur or not find_options("\n".join(blocks[cur]))):
                continue
            m = start_re(k).match(line)
            if m:
                for s in range(n, k):
                    warnings.append(f"Question {s}: start marker not found - check the PDF around this question.")
                cur, n = k, k + 1
                blocks[k] = [m.group(1)]
                started = True
                break
        if started:
            continue
        if cur:
            blocks[cur].append(line)
        elif line.strip():
            title_lines.append(line.strip())

    questions = []
    for q in range(1, expected + 1):
        if q not in blocks:
            errors.append(f"Could not parse Question {q}. Possible reason: the question number marker was not found.")
            questions.append({"question_number": q, "question_text": "", "options": ["", "", "", ""], "correct_option": key.get(q)})
            continue
        t = "\n".join(blocks[q])
        inline = None
        ms = list(ANS_RE.finditer(t))
        if ms:
            inline = ans_index(ms[-1].group(1))
            t = t[: ms[-1].start()]
        sm = SOL_RE.search(t)
        if sm:
            t = t[: sm.start()]
        found = find_options(t)
        qtext, opts = "", ["", "", "", ""]
        if not found:
            miss = missing_letters(t)
            errors.append(f"Could not parse Question {q}. Possible reason: option marker{'s' if len(miss) > 1 else ''} {', '.join(miss)} missing.")
            qtext = t.strip()
        else:
            qtext = "\n".join(s.strip() for s in found[0].split("\n") if s.strip())
            opts = found[1]
            for i, o in enumerate(opts):
                if not o:
                    errors.append(f"Question {q}: option {LETTERS[i]} is empty.")
            if not qtext:
                errors.append(f"Question {q}: question text is empty.")
        correct = inline if inline is not None else key.get(q)
        if correct is None:
            errors.append(f'Question {q}: answer not found (no "Ans" line and not in the answer key).')
        elif inline is not None and q in key and key[q] != inline:
            warnings.append(f"Question {q}: inline answer ({LETTERS[inline]}) differs from the answer key ({LETTERS[key[q]]}). Inline answer used - please verify.")
        questions.append({"question_number": q, "question_text": qtext, "options": opts, "correct_option": correct})
    if len(blocks) != expected:
        errors.insert(0, f"Detected {len(blocks)} questions but expected {expected}.")
    title = next((l for l in title_lines if len(l) <= 120), "")
    return {"title": title, "questions": questions}, errors, warnings


def read_text(path):
    if path.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            sys.exit("Install pypdf first:  pip install pypdf")
        return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)
    return open(path, encoding="utf-8").read()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help=".pdf or .txt")
    ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--title", default=None)
    ap.add_argument("--expected", type=int, default=100)
    a = ap.parse_args()
    text = read_text(a.file)
    if len(text.strip()) < 50:
        sys.exit("No text found - this looks like a scanned PDF. Run OCR first (e.g. ocrmypdf in.pdf out.pdf).")
    paper, errors, warnings = parse(text, a.expected)
    if a.title:
        paper["title"] = a.title
    paper["source_filename"] = a.file.split("/")[-1]
    out = a.out or re.sub(r"\.\w+$", "", a.file) + ".json"
    json.dump(paper, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"Wrote {out}: {len(paper['questions'])} question slots, {len(errors)} problem(s), {len(warnings)} warning(s).")
    for e in errors + warnings:
        print(" -", e)
    sys.exit(1 if errors else 0)
