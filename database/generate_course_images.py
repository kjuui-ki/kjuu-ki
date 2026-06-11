#!/usr/bin/env python3
"""
Generate professional course banners — NO text on images (avoids broken Arabic rendering).
Uses reference illustrations + unique color/crop/composite per course.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "assets" / "js" / "courses_catalog.js"
OUT_DIR = ROOT / "assets" / "images" / "dorh"
REFS_DIR = OUT_DIR / "refs"
JS_OUT = ROOT / "assets" / "js" / "course-images.js"
W, H = 960, 540

REF_FILES = {
    "digital": REFS_DIR / "ref-digital.png",
    "business": REFS_DIR / "ref-business.png",
    "office": REFS_DIR / "ref-office.png",
}


def parse_courses() -> list[dict]:
    text = CATALOG.read_text(encoding="utf-8")
    courses = []
    for block in re.finditer(
        r'\{\s*id:\s*"([^"]+)"\s*,\s*title:\s*"([^"]*)"(?:[^}]*category:\s*"([^"]*)")?(?:[^}]*content_type:\s*"([^"]*)")?',
        text,
    ):
        courses.append(
            {
                "id": block.group(1),
                "title": block.group(2),
                "category": block.group(3) or "",
                "content_type": block.group(4) or "course",
            }
        )
    return courses


def hseed(*parts: str) -> int:
    h = hashlib.sha256("||".join(parts).encode("utf-8")).hexdigest()
    return int(h[:16], 16)


def pick_ref_key(title: str, category: str, content_type: str, seed: int) -> str:
    t = (title + " " + category).lower()
    if any(k in t for k in ["تقنية", "معلومات", "حاسب", "رقمي", "ذكاء", "سيبر", "بيانات", "إنترنت", "ميكروسوفت", "إكسل"]):
        return "digital"
    if any(k in t for k in ["قياد", "إدارة", "مشروع", "مالي", "محاسب", "موارد بشر", "قانون", "تفاوض", "اتفاق"]):
        return "business"
    if any(k in t for k in ["إعلام", "تسويق", "تواصل", "تعليم", "صح", "فندق", "سياح", "رياض", "غذاء", "هندس"]):
        return "office"
    if content_type == "diploma":
        return "business"
    keys = ["digital", "business", "office"]
    return keys[seed % 3]


def hue_shift(img: Image.Image, degrees: float) -> Image.Image:
    if degrees == 0:
        return img
    hsv = img.convert("HSV")
    h, s, v = hsv.split()
    h = h.point(lambda p: (p + int(degrees / 360 * 255)) % 256)
    return Image.merge("HSV", (h, s, v)).convert("RGB")


def cover_crop(src: Image.Image, tw: int, th: int, ox: float, oy: float) -> Image.Image:
    sw, sh = src.size
    scale = max(tw / sw, th / sh) * (1.0 + (hseed(str(ox), str(oy)) % 15) / 100)
    nw, nh = int(sw * scale), int(sh * scale)
    src = src.resize((nw, nh), Image.Resampling.LANCZOS)
    max_x = max(0, nw - tw)
    max_y = max(0, nh - th)
    left = int(max_x * ox)
    top = int(max_y * oy)
    return src.crop((left, top, left + tw, top + th))


def add_neon_overlay(base: Image.Image, seed: int, accent: tuple[int, int, int]) -> Image.Image:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer = ImageDraw.Draw(overlay)

    for i in range(2):
        cx = (seed >> (i * 11)) % base.width
        cy = (seed >> (i * 11 + 5)) % base.height
        r = 120 + (seed >> (i * 7)) % 180
        layer.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(*accent, 35 + i * 20),
        )

    overlay = overlay.filter(ImageFilter.GaussianBlur(40))
    out = Image.alpha_composite(base.convert("RGBA"), overlay)

    vignette = Image.new("L", base.size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle([0, 0, base.width, base.height], fill=200)
    vd.rectangle([40, 30, base.width - 40, base.height - 20], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(25))
    dark = Image.new("RGBA", base.size, (5, 8, 22, 0))
    dark.putalpha(ImageOps.invert(vignette).point(lambda p: int(p * 0.55)))
    out = Image.alpha_composite(out, dark)

    top_grad = Image.new("RGBA", base.size, (0, 0, 0, 0))
    tg = ImageDraw.Draw(top_grad)
    for y in range(base.height // 2):
        a = int(90 * (1 - y / (base.height // 2)))
        tg.line([(0, y), (base.width, y)], fill=(5, 8, 22, a))
    out = Image.alpha_composite(out, top_grad)

  # bottom gradient for title area on site (visual only, no text)
    bot = Image.new("RGBA", base.size, (0, 0, 0, 0))
    bg = ImageDraw.Draw(bot)
    for y in range(base.height // 3):
        yy = base.height - base.height // 3 + y
        a = int(160 * (y / (base.height // 3)))
        bg.line([(0, yy), (base.width, yy)], fill=(5, 8, 22, a))
    out = Image.alpha_composite(out, bot)

    line = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    ld.line([(0, base.height - 1), (base.width, base.height - 1)], fill=(147, 197, 253, 90), width=2)
    return Image.alpha_composite(out, line).convert("RGB")


def accent_from_seed(seed: int) -> tuple[int, int, int]:
    hues = [210, 230, 255, 265, 195, 280, 175]
    h = hues[seed % len(hues)]
    rad = math.radians(h)
    r = int(40 + 50 * math.sin(rad + 1))
    g = int(90 + 60 * math.sin(rad + 2))
    b = int(180 + 50 * math.sin(rad + 3))
    return (min(255, r), min(255, g), min(255, b))


def render_course(course: dict, ref_cache: dict[str, Image.Image]) -> None:
    cid = course["id"]
    title = course["title"]
    category = course["category"]
    ctype = course["content_type"]
    seed = hseed(cid, title)

    ref_key = pick_ref_key(title, category, ctype, seed)
    src = ref_cache[ref_key].copy()

    ox = ((seed >> 3) % 100) / 100
    oy = ((seed >> 9) % 100) / 100
    frame = cover_crop(src, W, H, ox, oy)

    if seed % 2 == 0:
        frame = ImageOps.mirror(frame)

    shift = ((seed % 50) - 25) * 1.2
    frame = hue_shift(frame, shift)
    frame = ImageEnhance.Contrast(frame).enhance(1.05 + (seed % 10) / 50)
    frame = ImageEnhance.Color(frame).enhance(1.08 + (seed % 8) / 40)
    frame = ImageEnhance.Brightness(frame).enhance(0.92 + (seed % 6) / 50)

    accent = accent_from_seed(seed)
    frame = add_neon_overlay(frame, seed, accent)

    out = OUT_DIR / f"{cid}.jpg"
    frame.save(out, "JPEG", quality=92, optimize=True, progressive=True)


def render_default(ref_cache: dict[str, Image.Image]) -> None:
    seed = 42
    frame = cover_crop(ref_cache["digital"], W, H, 0.5, 0.4)
    frame = add_neon_overlay(frame, seed, accent_from_seed(seed))
    frame.save(OUT_DIR / "_default.jpg", "JPEG", quality=92)


def write_js(courses: list[dict]) -> None:
    mapping = {c["id"]: f"assets/images/dorh/{c['id']}.jpg" for c in courses}
    payload = json.dumps(mapping, ensure_ascii=False, indent=2)
    js = f"""/**
 * Course cover images — assets/images/dorh/{'{id}'}.jpg
 * Regenerate: python database/generate_course_images.py
 */
(function () {{
    "use strict";
    var MAP = {payload};

    function normalizeId(courseOrId) {{
        if (!courseOrId) return "";
        if (typeof courseOrId === "string") return courseOrId.trim();
        return String(courseOrId.id || "").trim();
    }}

    window.maherCourseImagesMap = MAP;

    window.maherCourseImageUrl = function maherCourseImageUrl(courseOrId) {{
        var id = normalizeId(courseOrId);
        if (id && MAP[id]) return MAP[id];
        if (id) return "assets/images/dorh/" + id + ".jpg";
        return "assets/images/dorh/_default.jpg";
    }};
}})();
"""
    JS_OUT.write_text(js, encoding="utf-8", newline="\n")


def main() -> None:
    for name, path in REF_FILES.items():
        if not path.is_file():
            raise SystemExit(f"Missing reference image: {path}")

    courses = parse_courses()
    if not courses:
        raise SystemExit("No courses in catalog")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ref_cache = {k: Image.open(p).convert("RGB") for k, p in REF_FILES.items()}

    print(f"Generating {len(courses)} banners (no text, ref-based)...")
    for i, c in enumerate(courses, 1):
        render_course(c, ref_cache)
        if i % 25 == 0 or i == len(courses):
            print(f"  {i}/{len(courses)}")

    render_default(ref_cache)
    write_js(courses)
    print("Done:", OUT_DIR)


if __name__ == "__main__":
    main()
