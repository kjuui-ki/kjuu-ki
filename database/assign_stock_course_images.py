# -*- coding: utf-8 -*-
"""Assign user stock PNGs to course cover JPGs and regenerate course-images.js."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    raise SystemExit("pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JS = ROOT / "assets" / "js" / "courses_catalog.js"
STOCK_SRC = Path(
    r"C:\Users\krama\.cursor\projects\c-Users-krama-Desktop-kjuu-ki\assets"
)
STOCK_DIR = ROOT / "assets" / "images" / "dorh" / "stock"
OUT_DIR = ROOT / "assets" / "images" / "dorh"
MAP_JS = ROOT / "assets" / "js" / "course-images.js"
W, H = 960, 540

# Title keywords -> prefer stock bucket (0..N-1) for semantic-ish matching
TITLE_BUCKETS = [
    (("فندق", "ضياف", "سياح", "مطعم", "طهي", "طبخ", "مطبخ", "تغذية", "غذاء"), "hospitality"),
    (("هندس", "بناء", "إنشاء", "تشييد", "معماري", "مدني", "مشروع", "مقاول"), "engineering"),
    (("تقني", "برمج", "حاسب", "رقمي", "ذكاء", "بيانات", "شبك", "أمن سيبر"), "tech"),
    (("مالي", "محاسب", "ميزان", "تكلف", "ميزانية", "استثمار"), "finance"),
    (("موارد بشر", "توظيف", "تعاقد", "رواتب"), "hr"),
    (("قانون", "نظام", "تشريع", "عقود"), "law"),
    (("إعلام", "اتصال", "علاقات عام", "تسويق", "إعلان"), "media"),
    (("صح", "طبي", "مستشف", "تمريض", "إدارة صح"), "health"),
    (("أمن", "سلامة", "مخاطر", "حريق", "وقاية"), "safety"),
    (("تعليم", "تربية", "تدريب", "تعلم"), "education"),
    (("رياض", "لياقة", "بدني"), "sport"),
    (("استدام", "بيئ", "طاقة متجد"), "sustain"),
    (("قيادة", "إدارة", "تنفيذي", "مدير", "استراتيج"), "leadership"),
]

BUCKET_ORDER = [
    "leadership",
    "tech",
    "engineering",
    "finance",
    "hr",
    "media",
    "health",
    "safety",
    "education",
    "sport",
    "sustain",
    "law",
    "hospitality",
    "general",
]


def parse_courses() -> list[dict]:
    text = CATALOG_JS.read_text(encoding="utf-8")
    courses = []
    for block in re.finditer(
        r"\{\s*id:\s*\"([^\"]+)\"[^}]*?title:\s*\"([^\"]+)\"[^}]*?category:\s*\"([^\"]+)\"",
        text,
        re.DOTALL,
    ):
        courses.append(
            {"id": block.group(1), "title": block.group(2), "category": block.group(3)}
        )
    return courses


def course_bucket(title: str, category: str) -> str:
    hay = title + " " + category
    for keys, bucket in TITLE_BUCKETS:
        if any(k in hay for k in keys):
            return bucket
    if "فندقة" in category or "دبلوم" in category:
        return "hospitality"
    if "تقنية" in category:
        return "tech"
    if "هندسي" in category or "فني" in category:
        return "engineering"
    if "مالي" in category:
        return "finance"
    if "موارد" in category:
        return "hr"
    if "قانون" in category:
        return "law"
    if "إعلام" in category:
        return "media"
    if "صحية" in category:
        return "health"
    if "أمن" in category or "سلامة" in category:
        return "safety"
    if "تعليم" in category:
        return "education"
    if "رياضة" in category:
        return "sport"
    if "تنمية" in category:
        return "sustain"
    if "قيادة" in category or "إدارة" in category:
        return "leadership"
    return "general"


def collect_stock() -> list[Path]:
    STOCK_DIR.mkdir(parents=True, exist_ok=True)
    pngs = sorted(STOCK_SRC.glob("c__Users_krama_*_images_*.png"))
    if not pngs:
        pngs = sorted(STOCK_DIR.glob("*.png"))
    if not pngs:
        raise SystemExit("No stock PNG files found")
    for i, src in enumerate(pngs):
        dest = STOCK_DIR / f"stock_{i:03d}.png"
        if not dest.exists() or dest.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dest)
    return sorted(STOCK_DIR.glob("stock_*.png"))


def split_buckets(stock_files: list[Path]) -> dict[str, list[Path]]:
    n = len(stock_files)
    buckets: dict[str, list[Path]] = {b: [] for b in BUCKET_ORDER}
    per = max(1, n // len(BUCKET_ORDER))
    idx = 0
    for b in BUCKET_ORDER:
        buckets[b] = stock_files[idx : idx + per]
        idx += per
    buckets["general"] = stock_files[idx:] or stock_files[-per:]
    return buckets


def pick_image(
    course: dict, buckets: dict[str, list[Path]], used: set[str]
) -> Path:
    bucket_name = course_bucket(course["title"], course["category"])
    pool = buckets.get(bucket_name) or buckets["general"]
    if not pool:
        pool = buckets["general"]
    seed = int(hashlib.md5(course["id"].encode()).hexdigest(), 16)
    for off in range(len(pool) * 3):
        path = pool[(seed + off) % len(pool)]
        key = str(path)
        if key not in used:
            used.add(key)
            return path
    for path in pool:
        key = str(path)
        if key not in used:
            used.add(key)
            return path
    return pool[seed % len(pool)]


def process_cover(src: Path, dest: Path) -> None:
    img = Image.open(src).convert("RGB")
    sw, sh = img.size
    target_ratio = W / H
    src_ratio = sw / sh
    if src_ratio > target_ratio:
        nw = int(sh * target_ratio)
        left = (sw - nw) // 2
        img = img.crop((left, 0, left + nw, sh))
    else:
        nh = int(sw / target_ratio)
        top = (sh - nh) // 2
        img = img.crop((0, top, sw, top + nh))
    img = img.resize((W, H), Image.Resampling.LANCZOS)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    img = ImageEnhance.Color(img).enhance(1.08)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=3))
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=88, optimize=True)


def write_map_js(mapping: dict[str, str]) -> None:
    lines = [
        "/** Auto-generated — course cover image paths by id */",
        "(function (global) {",
        '  var BASE = "assets/images/dorh/";',
        "  var MAP = " + json.dumps(mapping, ensure_ascii=False, indent=2) + ";",
        "  function maherCourseImageUrl(courseId) {",
        "    if (!courseId) return BASE + \"_default.jpg\";",
        "    return MAP[courseId] || BASE + courseId + \".jpg\";",
        "  }",
        "  global.maherCourseImageUrl = maherCourseImageUrl;",
        "})(typeof window !== \"undefined\" ? window : global);",
        "",
    ]
    MAP_JS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    courses = parse_courses()
    stock = collect_stock()
    buckets = split_buckets(stock)
    used: set[str] = set()
    mapping: dict[str, str] = {}
    default_src = stock[0]

    for c in courses:
        src = pick_image(c, buckets, used)
        dest = OUT_DIR / f"{c['id']}.jpg"
        process_cover(src, dest)
        mapping[c["id"]] = f"assets/images/dorh/{c['id']}.jpg"

    process_cover(default_src, OUT_DIR / "_default.jpg")
    write_map_js(mapping)
    print(f"Assigned {len(courses)} courses from {len(stock)} stock images")


if __name__ == "__main__":
    main()
