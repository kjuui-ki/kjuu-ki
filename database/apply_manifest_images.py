# -*- coding: utf-8 -*-
"""
Assign unique cover images from assets/images/dorh/stock ONLY.
Generates course-images.js with id + title lookups pointing at stock/*.png
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JS = ROOT / "assets" / "js" / "courses_catalog.js"
STOCK_DIR = ROOT / "assets" / "images" / "dorh" / "stock"
MANIFEST = ROOT / "assets" / "images" / "dorh" / "import_manifest.json"
MAP_JS = ROOT / "assets" / "js" / "course-images.js"
STOCK_WEB = "assets/images/dorh/stock/"


def stock_sort_key(path: Path) -> int:
    m = re.search(r"stock_(\d+)", path.stem, re.I)
    return int(m.group(1)) if m else 0


def file_digest(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def list_stock_pool() -> list[Path]:
    """Prefer visually unique files first; append duplicate-content files if needed."""
    files: list[Path] = []
    for pattern in ("stock_*.png", "stock_*.jpg", "stock_*.jpeg", "stock_*.webp"):
        files.extend(STOCK_DIR.glob(pattern))
    files = sorted({p for p in files if p.is_file()}, key=stock_sort_key)
    unique: list[Path] = []
    dupes: list[Path] = []
    seen: set[str] = set()
    for p in files:
        digest = file_digest(p)
        if digest in seen:
            dupes.append(p)
        else:
            seen.add(digest)
            unique.append(p)
    return unique + dupes


def normalize_title(title: str) -> str:
    t = re.sub(r"\s+", " ", (title or "").strip())
    return t


def parse_catalog() -> list[tuple[str, str]]:
    text = CATALOG_JS.read_text(encoding="utf-8")
    return [
        (m.group(1), m.group(2))
        for m in re.finditer(r'\{\s*id:\s*"([^"]+)"\s*,\s*title:\s*"([^"]*)"', text)
    ]


def write_map_js(id_map: dict[str, str], title_map: dict[str, str], default_url: str) -> None:
    id_body = json.dumps(id_map, ensure_ascii=False, indent=2)
    title_body = json.dumps(title_map, ensure_ascii=False, indent=2)
    MAP_JS.write_text(
        "\n".join(
            [
                "/** Auto-generated — unique stock covers only (assets/images/dorh/stock) */",
                "(function (global) {",
                f'  var DEFAULT_COVER = "{default_url}";',
                f"  var MAP = {id_body};",
                f"  var TITLE_MAP = {title_body};",
                "  function normalizeTitle(t) {",
                '    return String(t || "").replace(/\\s+/g, " ").trim();',
                "  }",
                "  function maherCourseImageUrl(courseId, title) {",
                "    if (courseId && MAP[courseId]) return MAP[courseId];",
                "    var nt = normalizeTitle(title);",
                "    if (nt && TITLE_MAP[nt]) return TITLE_MAP[nt];",
                "    return DEFAULT_COVER;",
                "  }",
                "  global.maherCourseImageUrl = maherCourseImageUrl;",
                '})(typeof window !== "undefined" ? window : global);',
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    courses = parse_catalog()
    stock = list_stock_pool()
    if not stock:
        raise SystemExit(f"No images in {STOCK_DIR}")
    if len(stock) < len(courses):
        raise SystemExit(
            f"Need {len(courses)} stock images, have {len(stock)} in {STOCK_DIR}"
        )

    id_map: dict[str, str] = {}
    title_map: dict[str, str] = {}
    manifest: dict[str, dict] = {}
    used: set[str] = set()

    for i, (cid, title) in enumerate(courses):
        src = stock[i]
        web = STOCK_WEB + src.name
        if src.name in used:
            raise SystemExit(f"Duplicate stock: {src.name}")
        used.add(src.name)
        id_map[cid] = web
        nt = normalize_title(title)
        if nt and nt not in title_map:
            title_map[nt] = web
        manifest[cid] = {"title": title, "stock": src.name, "stock_only": True}

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_map_js(id_map, title_map, STOCK_WEB + stock[0].name)

    print(f"Courses: {len(courses)}")
    print(f"Stock files used: {len(used)} / {len(stock)} in folder")
    print(f"Title lookups: {len(title_map)}")


if __name__ == "__main__":
    main()
