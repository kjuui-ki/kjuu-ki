#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extract course objectives from Maher PDF and generate course-objectives.js."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from difflib import SequenceMatcher

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = Path(r"C:\Users\krama\Downloads\دليل دورات معهد ماهر جديد-نهائي.pdf")
CATALOG_JS = ROOT / "assets" / "js" / "courses_catalog.js"
OUT_JS = ROOT / "assets" / "js" / "course-objectives.js"
REPORT = ROOT / "database" / "course_objectives_report.txt"

GOAL_RE = re.compile(r"الهدف\s+العام(?:\s+للدورة)?\s*:")
DETAIL_RE = re.compile(r"هداف\s+(?:التفصيلية|الخاصة)\s*:")
SKIP_TITLE_RE = re.compile(r"(يتضمن هذا المسار|دبلومات،|المسار من المرتكزات|كالتالي:)", re.I)
DURATION_RE = re.compile(
    r"(مدة\s|سنتان|شهر|أشهر|ساعة|ســــاعة|بمعدل|٣\s*أيام|٦\s*أشهر|٠٤٢|٠٢١|٠٠١)"
)
PAGE_NUM_RE = re.compile(r"^\d{1,4}$")
GARBAGE_RE = re.compile(r"^(tfosorciM|droW|lecxe|rewoP|sseccA|kooltuO|tniop)", re.I)
OBJECTIVE_VERB_RE = re.compile(
    r"^(تنمية|تحسين|تطوير|تعريف|تطبيق|تحليل|فهم|إتقان|إكساب|إعداد|تأهيل|تزويد|تعزيز|تمكين|رفع|بناء|تقوية|إكساب|معرفة|القدرة|يدير|ينظم|يشارك|يطبق|يميز|يتعامل)"
)

def fix_line(s: str) -> str:
    return (s or "").strip()[::-1]


def norm_ar(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    for a, b in (
        ("اال", "ال"),
        ("األ", "ال"),
        ("اإل", "ال"),
        ("الل", "ال"),
        ("إستر", "استر"),
        ("إست", "است"),
        ("إد", "اد"),
    ):
        s = s.replace(a, b)
    s = s.replace("ّ", "").replace("ـ", "")
    s = re.sub(r"^[0-9٠-٩]+\s*", "", s)
    s = re.sub(r"^(دورة|دبلوم|برنامج)\s+", "", s)
    s = re.sub(r"[0٠]$", "", s).strip()
    return s


def norm_match(s: str) -> str:
    s = norm_ar(s)
    for ch in "إأآى":
        s = s.replace(ch, "ا")
    return s


PATH_BLEED_RE = re.compile(
    r"(مسار\s|أكاديمية ماهر|يعــد|فــي ظــ|البرامــج|المهنيــة|انطالقــا|كالتالي|^\d+\s+\d+)",
    re.I,
)


def clean_details(details: list[str]) -> list[str]:
    out: list[str] = []
    for d in details:
        d = re.sub(r"\s+", " ", (d or "").strip())
        if len(d) < 10:
            continue
        if PATH_BLEED_RE.search(d):
            continue
        if re.match(r"^\d{1,3}(\s|$)", d):
            continue
        out.append(d)
    return out[:14]


def manual_pdf_title_for_catalog(cat_title: str) -> str | None:
    """Map catalog title to PDF block title when wording differs."""
    pairs = {
        "دبلوم الذكاء الاصطناعي": "الذكاء الاصطناعي",
        "الذكاء الاصطناعي": "الذكاء الاصطناعي",
        "دورة إدخال البيانات ومعالجة النصوص": "إدخال البيانات ومعالجة النصوص",
        "دورة قيادة فرق العمل": "قيادة فرق العمل",
        "دورة برنامج القيادة التحويلية المتفردة": "القيادة التحويلية المتفردة",
        "دورة تنمية المهارات القيادية على التأثير والاقناع": "تنمية المهارات القيادية على التأثير والإقناع",
        "دورة تطوير المحتوى الإعلامي الفعّال": "تطوير المحتوى الإعلامي الفعّال",
        "دورة تطوير قدرات مسؤولي التدريب والتطوير": "تطوير قدرات مسؤولي التدريب والتطوير",
        "الإشراف على السكن الجماعي": "الإشراف على السكن الجماعي",
        "دورة تعزيز الصحة العامة من خلال الرياضة": "تعزيز الصحة العامة من خلال الرياضة",
        "دورة الاحتراف في إعداد كراسة الشروط والمواصفات": "الاحتراف في إعداد كراسة الشروط والمواصفات",
        "دورة إعداد وصياغة المذكرات القانونية": "إعداد وصياغة المذكرات القانونية",
        "دورة التخطيط وإدارة الوقت والأولويات": "التخطيط وإدارة الوقت والأولويات",
        "دورة أساسيات الأمن والسلامة": "أساسيات الأمن والسلامة",
        "دورة الطهي المتقدم والتقنيات الحديثة": "الطهي المتقدم والتقنيات الحديثة",
    }
    return pairs.get(cat_title)


def load_catalog() -> list[dict]:
    text = CATALOG_JS.read_text(encoding="utf-8")
    return [
        {"id": m.group(1), "title": m.group(2)}
        for m in re.finditer(r'\{\s*id:\s*"([^"]+)"\s*,\s*title:\s*"([^"]+)"', text)
    ]


def extract_pdf_text() -> str:
    lines: list[str] = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or "").split("\n"):
                fixed = fix_line(line)
                if fixed:
                    lines.append(fixed)
    return "\n".join(lines)


def is_overview_line(line: str) -> bool:
    if re.search(r"\d+\s+\d+\s+", line):
        return True
    if re.search(r"\d{2,3}\s+\S", line) and len(line) < 80:
        return True
    if line.endswith(".") and len(line) < 45:
        return True
    return False


def extract_title_before(text: str, goal_start: int) -> str:
    pre = text[:goal_start]
    raw_lines = [l.strip() for l in pre.split("\n") if l.strip()]

    title_parts: list[str] = []
    for line in reversed(raw_lines[-14:]):
        norm_line = line.replace("األ", "ال").replace("اال", "ال")
        if GOAL_RE.search(norm_line) or DETAIL_RE.search(norm_line):
            break
        if DURATION_RE.search(line):
            continue
        if PAGE_NUM_RE.match(line):
            continue
        if is_overview_line(line):
            break
        if line.startswith("مسار ") and len(line) > 30:
            break
        if len(line) > 120:
            continue
        if re.search(r"\s\d{1,2}\s", line):
            continue
        if OBJECTIVE_VERB_RE.match(line) and title_parts:
            break
        if "." in line and len(line) > 40 and title_parts:
            break
        title_parts.insert(0, line)
        if len(title_parts) >= 5:
            break

    title = " ".join(title_parts)
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"^(دورة|دبلوم|برنامج)\s+", "", title)
    title = re.sub(r"^\d+\s+", "", title)
    return title


def parse_body(body: str) -> tuple[str, list[str]]:
    general_lines: list[str] = []
    detail_lines: list[str] = []
    mode = "general"

    for line in body.split("\n"):
        line = line.strip()
        if not line:
            continue
        norm_line = line.replace("األ", "ال").replace("اال", "ال")
        if DETAIL_RE.search(norm_line):
            mode = "detail"
            continue
        if GOAL_RE.search(norm_line):
            break
        if DURATION_RE.search(line):
            continue
        if PAGE_NUM_RE.match(line):
            continue
        if GARBAGE_RE.search(line):
            continue
        if line.startswith("مسار ") and len(line) > 40:
            break

        if mode == "general":
            general_lines.append(line)
        else:
            if PATH_BLEED_RE.search(line):
                break
            detail_lines.append(line.rstrip("."))

    general = re.sub(r"\s+", " ", " ".join(general_lines)).strip()
    general = re.sub(r"[0٠]$", "", general).strip()
    # Keep only first paragraph for general (before detail bleed)
    if len(general) > 350 and "." in general:
        general = general.split(".")[0].strip() + "."
    details = [re.sub(r"\s+", " ", d).strip() for d in detail_lines if len(d.strip()) > 4]
    return general, details


def parse_courses(text: str) -> list[dict]:
    matches = list(GOAL_RE.finditer(text))
    courses: list[dict] = []

    for i, m in enumerate(matches):
        title = extract_title_before(text, m.start())
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end() : end]
        general, details = parse_body(body)

        if not title or len(title) < 4 or not general:
            continue
        if len(title) > 100 or SKIP_TITLE_RE.search(title):
            continue
        if len(general) > 400:
            continue
        if not details:
            continue

        courses.append(
            {
                "title": title,
                "title_norm": norm_ar(title),
                "general_objective": general,
                "detailed_objectives": details,
            }
        )

    by_norm: dict[str, dict] = {}
    for c in courses:
        key = c["title_norm"]
        if key not in by_norm or len(c["detailed_objectives"]) > len(
            by_norm[key]["detailed_objectives"]
        ):
            by_norm[key] = c
    return list(by_norm.values())


def score_match(a: str, b: str) -> float:
    na, nb = norm_ar(a), norm_ar(b)
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.95
    return SequenceMatcher(None, na, nb).ratio()


def extract_block_by_title_search(text: str, cat_title: str) -> dict | None:
    """Fallback: locate PDF block by matching title keywords before الهدف العام."""
    norm = norm_match(cat_title)
    words = [w for w in norm.split() if len(w) > 2]
    if len(words) < 2:
        return None
    need = words[: min(5, len(words))]
    matches = list(GOAL_RE.finditer(text))

    best: dict | None = None
    best_hits = 0
    for i, m in enumerate(matches):
        pre = text[max(0, m.start() - 600) : m.start()]
        pre_norm = norm_match(pre)
        hits = sum(1 for w in need if w in pre_norm)
        if hits < max(2, len(need) - 1):
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end() : end]
        general, details = parse_body(body)
        details = clean_details(details)
        if not general or not details:
            continue
        if hits > best_hits:
            best_hits = hits
            best = {
                "title": extract_title_before(text, m.start()) or cat_title,
                "general_objective": general,
                "detailed_objectives": details,
            }
    return best


def match_to_catalog(parsed: list[dict], catalog: list[dict], full_text: str) -> tuple[dict, list, list]:
    by_id: dict[str, dict] = {}
    used_pdf: set[str] = set()
    unmatched_catalog: list[str] = []

    pdf_by_norm = {c["title_norm"]: c for c in parsed}

    for cat in catalog:
        cat_norm = norm_ar(cat["title"])
        best = None
        best_score = 0.0

        candidates = list(parsed)
        mapped_title = manual_pdf_title_for_catalog(cat["title"])
        if mapped_title:
            mn = norm_ar(mapped_title)
            if mn in pdf_by_norm:
                candidates = [pdf_by_norm[mn]] + candidates

        for c in candidates:
            s = score_match(cat["title"], c["title"])
            if s > best_score:
                best_score = s
                best = c

        if best and best_score >= 0.62:
            by_id[cat["id"]] = {
                "general_objective": best["general_objective"],
                "detailed_objectives": clean_details(best["detailed_objectives"]),
                "pdf_title": best["title"],
                "catalog_title": cat["title"],
                "score": round(best_score, 3),
            }
            used_pdf.add(best["title_norm"])
        else:
            fallback = extract_block_by_title_search(full_text, cat["title"])
            if fallback:
                by_id[cat["id"]] = {
                    "general_objective": fallback["general_objective"],
                    "detailed_objectives": fallback["detailed_objectives"],
                    "pdf_title": fallback["title"],
                    "catalog_title": cat["title"],
                    "score": 0.5,
                }
            else:
                unmatched_catalog.append(cat["title"])

    unmatched_pdf = [c["title"] for c in parsed if c["title_norm"] not in used_pdf]
    return by_id, unmatched_catalog, unmatched_pdf


def js_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def write_js(data: dict) -> None:
    lines = [
        "/**",
        " * أهداف الدورات والدبلومات — مُستخرجة من دليل دورات معهد ماهر",
        " * المفتاح: معرّف الدورة (UUID) من courses_catalog.js",
        " */",
        '(function () {',
        '    "use strict";',
        "    window.maherCourseObjectives = {",
    ]
    for cid, obj in sorted(data.items()):
        gen = js_escape(obj["general_objective"])
        details = ", ".join(f'"{js_escape(d)}"' for d in obj["detailed_objectives"])
        lines.append(f'        "{cid}": {{')
        lines.append(f'            general: "{gen}",')
        lines.append(f"            detailed: [{details}]")
        lines.append("        },")
    lines.append("    };")
    lines.append("})();")
    lines.append("")
    OUT_JS.write_text("\n".join(lines), encoding="utf-8")


MANUAL_OBJECTIVES_BY_ID = {
    "8497dd97-1a1e-5e3b-b6d1-6683749958a8": {
        "general_objective": "تنمية المعارف والمهارات اللازمة لضمان السلامة والأمن في مختلف بيئات العمل.",
        "detailed_objectives": [
            "تعريف المتدربين بأهمية الأمن والسلامة في بيئات العمل",
            "توضيح المبادئ الأساسية للأمن والسلامة",
            "تحسين القدرة على التعرف على المخاطر المحتملة في العمل",
            "تطوير المهارات اللازمة لتنفيذ إجراءات الطوارئ",
            "تطبيق قواعد السلامة الأساسية في حالات الطوارئ",
            "تحسين التواصل الفعال حول مسائل السلامة بين العاملين",
            "تعزيز الوعي بأهمية الوقاية من الحوادث في بيئة العمل",
            "تطبيق إجراءات السلامة عند التعامل مع المعدات والمواد الخطرة",
            "تحسين مهارات الإسعافات الأولية والاستجابة للحالات الطارئة",
            "تعريف المتدربين بأنظمة وقواعد السلامة المعتمدة في المنشآت",
            "تطوير ثقافة السلامة المهنية بين جميع العاملين",
            "تطبيق معايير الأمن والسلامة وفق الأنظمة واللوائح المعمول بها",
        ],
    }
}


def main() -> int:
    if not PDF_PATH.exists():
        print(f"PDF not found: {PDF_PATH}", file=sys.stderr)
        return 1

    catalog = load_catalog()
    text = extract_pdf_text()
    parsed = parse_courses(text)
    matched, unmatched_cat, unmatched_pdf = match_to_catalog(parsed, catalog, text)
    for cid, obj in MANUAL_OBJECTIVES_BY_ID.items():
        matched[cid] = {
            "general_objective": obj["general_objective"],
            "detailed_objectives": clean_details(obj["detailed_objectives"]),
            "pdf_title": "(manual)",
            "catalog_title": cid,
            "score": 1.0,
        }
    write_js(matched)

    report_lines = [
        f"Catalog courses: {len(catalog)}",
        f"PDF blocks parsed: {len(parsed)}",
        f"Matched: {len(matched)}",
        f"Unmatched catalog ({len(unmatched_cat)}):",
        *["  - " + t for t in unmatched_cat],
        f"Unmatched PDF ({len(unmatched_pdf)}):",
        *["  - " + t for t in unmatched_pdf],
    ]
    REPORT.write_text("\n".join(report_lines), encoding="utf-8")

    print(f"Matched {len(matched)}/{len(catalog)}")
    print(f"Wrote {OUT_JS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
