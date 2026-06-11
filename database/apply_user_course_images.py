# -*- coding: utf-8 -*-
"""Apply user-provided course -> image mappings to course-images.js and import_manifest.json."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JS = ROOT / "assets" / "js" / "courses_catalog.js"
MAP_JS = ROOT / "assets" / "js" / "course-images.js"
MANIFEST = ROOT / "assets" / "images" / "dorh" / "import_manifest.json"
DORH_WEB = "assets/images/dorh/"

# User mapping: course title -> absolute or relative image path
USER_MAPPINGS: list[tuple[str, str]] = [
    ("دبلوم الموارد البشرية", r"assets\images\dorh\stock\stock_087.png"),
    ("دبلوم الإرشاد السياحي", r"assets\images\dorh\stock\stock_025.png"),
    ("دبلوم الذكاء الاصطناعي", r"assets\images\dorh\stock\stock_066.png"),
    ("إدخال البيانات ومعالجة النصوص", r"assets\images\dorh\stock\stock_042.png"),
    ("استخدام الحاسب الآلي في الأعمال المكتبية", r"assets\images\dorh\stock\stock_057.png"),
    ("الإشراف على السكن الجماعي", r"assets\images\dorh\stock\sssss.png"),
    ("التخطيط الإستراتيجي", r"assets\images\dorh\stock\stock_086.png"),
    ("تنمية قدرات القادة على التأثير والإقناع", r"assets\images\dorh\stock\stock_040.png"),
    ("قيادة فرق العمل", r"assets\images\dorh\stock\stock_089.png"),
    ("برنامج القيادة التحويلية المتفردة", r"assets\images\dorh\stock\stock_141.png"),
    ("بناء الرؤية الإبداعية وكيفية صياغة الأهداف الإستراتيجية", r"assets\images\dorh\stock\stock_047.png"),
    ("قيادة تطبيقات العمل المؤسسي", r"assets\images\dorh\stock\stock_072.png"),
    ("الاتجاهات الحديثة في القيادة الفعالة", r"assets\images\dorh\3f9b97b4-5063-597d-ac0c-2c0f59b736f1.jpg"),
    ("دور المديرين والقادة في التطوير الإداري", r"assets\images\dorh\stock\stock_085.png"),
    ("الإدارة المتفوقة", r"assets\images\dorh\stock\stock_022.png"),
    ("مهارات حل المشكلات واتخاذ القرارات", r"assets\images\dorh\stock\stock_193.png"),
    ("المهارات المتقدمة في التخطيط الإستراتيجي", r"assets\images\dorh\stock\stock_052.png"),
    ("التميز المؤسسي", r"assets\images\dorh\stock\stock_117.png"),
    ("القيادة التنظيمية في اتخاذ القرار", r"assets\images\dorh\stock\stock_172.png"),
    ("إدارة المخاطر والأزمات", r"assets\images\dorh\stock\stock_197.png"),
    ("إدارة المشاريع", r"assets\images\dorh\stock\stock_126.png"),
    ("إدارة التغيير والتخطيط التشغيلي ومؤشرات القياس", r"assets\images\dorh\stock\stock_157.png"),
    ("تطوير القيادة المتوسطة", r"assets\images\dorh\stock\stock_001.png"),
    ("مهارات التنظيم وإدارة الفعاليات والمؤتمرات والمعارض", r"assets\images\dorh\stock\stock_049.png"),
    ("هندسة التغيير المخطط له", r"assets\images\dorh\stock\stock_034.png"),
    ("إدارة سلاسل الإمداد والتموين", r"assets\images\dorh\84b1154e-1582-527a-a53f-8463db8c6352.jpg"),
    ("تنمية المهارات القيادية على التأثير والإقناع", r"assets\images\dorh\stock\stock_082.png"),
    ("إدارة وتطوير الجودة والتميز المؤسسي", r"assets\images\dorh\stock\stock_122.png"),
    ("مؤشرات الأداء", r"assets\images\dorh\stock\stock_094.png"),
    ("تأهيل القيادات الوسطى لمهام ومسؤوليات القيادات العليا", r"assets\images\dorh\stock\stock_093.png"),
    ("إعداد الخطط الإعلامية في التسويق", r"assets\images\dorh\stock\stock_189.png"),
    ("تنمية مهارات التواصل والتعامل مع وسائل الإعلام", r"assets\images\dorh\ffb3ef8b-5cd7-584d-ba20-78660160dbdf.jpg"),
    ("أخلاقيات الإعلام", r"assets\images\dorh\stock\stock_099.png"),
    ("المتحدث الرسمي الإعلامي", r"assets\images\dorh\stock\stock_200.png"),
    ("الإتيكيت والبروتوكول", r"assets\images\dorh\stock\stock_109.png"),
    ("الإعلام الرقمي وشبكات التواصل الاجتماعي", r"assets\images\dorh\stock\stock_202.png"),
    ("تخطيط وإدارة البرامج الإعلامية والاتصالية", r"assets\images\dorh\stock\stock_140.png"),
    ("تطوير المحتوى الإعلامي الفعال", r"assets\images\dorh\stock\stock_096.png"),
    ("الذكاء الاصطناعي", r"assets\images\dorh\stock\stock_006.png"),
    ("الأمن السيبراني", r"assets\images\dorh\stock\stock_152.png"),
    ("الأمن السيبراني المتقدم", r"assets\images\dorh\stock\stock_137.png"),
    ("تحليل البيانات", r"assets\images\dorh\stock\stock_153.png"),
    ("التحول الرقمي", r"assets\images\dorh\stock\stock_023.png"),
    ("التصميم الجرافيكي", r"assets\images\dorh\stock\stock_196.png"),
    ("مهارات توظيف الأوفيس في العمل الإداري", r"assets\images\dorh\stock\stock_151.png"),
    ("إدخال البيانات", r"assets\images\dorh\stock\stock_161.png"),
    ("مهارات التسويق الرقمي", r"assets\images\dorh\stock\stock_004.png"),
    ("تصميم وإنتاج الموشن جرافيك", r"assets\images\dorh\stock\stock_008.png"),
    ("إنترنت الأشياء", r"assets\images\dorh\stock\stock_206.png"),
    ("احتراف ميكروسوفت وورد", r"assets\images\dorh\stock\stock_078.png"),
    ("احتراف ميكروسوفت إكسل", r"assets\images\dorh\stock\stock_062.png"),
    ("احتراف ميكروسوفت بوربوينت", r"assets\images\dorh\stock\stock_024.png"),
    ("دراسات الجدوى للمشاريع", r"assets\images\dorh\0f70c3ce-ab87-587c-b09b-864ec07dfc43.jpg"),
    ("استخدام الإكسل في الإدارة المالية", r"assets\images\dorh\stock\stock_121.png"),
    ("إدارة العمليات المالية والتخطيط المالي المتقدم", r"assets\images\dorh\stock\stock_171.png"),
    ("حماية المال العام", r"assets\images\dorh\stock\stock_016.png"),
    ("ضبط التكلفة وإدارة الجودة", r"assets\images\dorh\stock\stock_210.png"),
    ("أساسيات المحاسبة لغير المحاسبين", r"assets\images\dorh\stock\stock_080.png"),
    ("إعداد القوائم المالية", r"assets\images\dorh\stock\stock_114.png"),
    ("التخطيط المالي والموازنات التخطيطية", r"assets\images\dorh\stock\stock_124.png"),
    ("دراسة جدوى المشروعات", r"assets\images\dorh\stock\stock_154.png"),
    ("تطبيق المعايير المحاسبية الدولية في القطاع الحكومي", r"assets\images\dorh\stock\stock_147.png"),
    ("التحليل المالي", r"assets\images\dorh\stock\stock_097.png"),
    ("إدارة المخزون", r"assets\images\dorh\af58b5ec-8b27-5e58-9bf0-d6271d9b765f.jpg"),
    ("إعداد التقارير المالية", r"assets\images\dorh\stock\stock_176.png"),
    ("إدارة الأزمات المالية", r"assets\images\dorh\stock\stock_178.png"),
    ("إدارة الموارد البشرية", r"assets\images\dorh\stock\stock_177.png"),
    ("المهارات التطبيقية لمؤشرات أداء الموارد البشرية", r"assets\images\dorh\stock\stock_036.png"),
    ("مهارات تقييم الأداء الوظيفي", r"assets\images\dorh\stock\stock_132.png"),
    ("تطبيقات الجدارات الوظيفية المتقدمة", r"assets\images\dorh\stock\stock_098.png"),
    ("مهارات استقطاب المواهب في إدارة الموارد البشرية بفاعلية", r"assets\images\dorh\stock\stock_205.png"),
    ("تطوير أنظمة وإجراءات شؤون الموظفين", r"assets\images\dorh\stock\stock_090.png"),
    ("تطوير قدرات مسؤولي التدريب والتطوير", r"assets\images\dorh\stock\stock_083.png"),
    ("النجاح الوظيفي وتنظيم وتطوير أساليب العمل", r"assets\images\dorh\stock\stock_148.png"),
    ("إدارة المسار الوظيفي وعلاقته بالوصف الوظيفي والترقيات", r"assets\images\dorh\stock\stock_081.png"),
    ("المهارات الاحترافية في إدارة الموارد البشرية", r"assets\images\dorh\stock\stock_156.png"),
    ("السلامة الغذائية", r"assets\images\dorh\stock\stock_018.png"),
    ("مهارات أخصائي سلامة الغذاء", r"assets\images\dorh\stock\stock_039.png"),
    ("السلامة والصحة المهنية في مجال خدمة الغذاء", r"assets\images\dorh\stock\stock_026.png"),
    ("نظام إدارة سلامة الغذاء - أيزو 22000- 2018", r"assets\images\dorh\stock\stock_104.png"),
    ("نظم إدارة سلامة الغذاء: التوثيق والتطبيق والمراجعة - الأيزو 22000- 2005", r"assets\images\dorh\stock\stock_104.png"),
    ("خدمة العملاء في مجال الخدمات الغذائية", r"assets\images\dorh\stock\stock_028.png"),
    ("إدارة الخدمات الغذائية", r"assets\images\dorh\stock\stock_079.png"),
    ("نظام تحليل المخاطر ونقاط التحكم الحرجة (HACCP)", r"assets\images\dorh\stock\stock_209.png"),
    ("إدارة خدمات التغذية", r"assets\images\dorh\stock\stock_102.png"),
    ("استلام وتخزين الخامات الغذائية", r"assets\images\dorh\stock\stock_199.png"),
    ("إدارة الأغذية والمشروبات", r"assets\images\dorh\stock\stock_005.png"),
    ("القانون الرياضي", r"assets\images\dorh\d7de6645-5e63-5b56-850c-fb53306a2a4f.jpg"),
    ("إدارة المخاطر في المؤسسات الرياضية", r"assets\images\dorh\stock\stock_108.png"),
    ("الإسعافات الأولية للرياضيين", r"assets\images\dorh\stock\stock_169.png"),
    ("تعزيز الصحة العامة من خلال الرياضة", r"assets\images\dorh\stock\stock_002.png"),
    ("التميز المؤسسي في المؤسسات الرياضية", r"assets\images\dorh\stock\stock_115.png"),
    ("إعداد مدرب اللياقة البدنية", r"assets\images\dorh\stock\stock_076.png"),
    ("التدريب البدني وتطوير الأداء الرياضي", r"assets\images\dorh\stock\stock_100.png"),
    ("إدارة الأنشطة والبرامج الرياضية", r"assets\images\dorh\stock\stock_054.png"),
    ("قياسات اللياقة البدنية والوظيفية", r"assets\images\dorh\stock\stock_043.png"),
    ("الاحتراف في إعداد كراسة الشروط والمواصفات", r"assets\images\dorh\stock\stock_186.png"),
    ("إعداد وصياغة المذكرات القانونية", r"assets\images\dorh\stock\stock_050.png"),
    ("برنامج حوكمة الإجراءات وتعزيز النزاهة لمكافحة الفساد الإداري والمالي", r"assets\images\dorh\stock\stock_188.png"),
    ("دور المنظمات الدولية غير الحكومية في مجال حقوق الإنسان", r"assets\images\dorh\stock\stock_058.png"),
    ("أحكام المسؤولية الجنائية والتأديبية في مجال الوظيفة العامة", r"assets\images\dorh\stock\stock_107.png"),
    ("جهود المنظمات الدولية غير الحكومية في حماية البيئة من التلوث", r"assets\images\dorh\stock\stock_112.png"),
    ("آليات الحماية في إطار القانون الدولي الإنساني", r"assets\images\dorh\stock\stock_103.png"),
    ("المسؤولية القانونية للممارس الصحي", r"assets\images\dorh\stock\stock_077.png"),
    ("أحكام نظام العمل السعودي", r"assets\images\dorh\stock\stock_135.png"),
    ("مهارات الصلح", r"assets\images\dorh\stock\stock_020.png"),
    ("حوكمة الموارد البشرية", r"assets\images\dorh\stock\stock_162.png"),
    ("التحكيم الإداري", r"assets\images\dorh\stock\stock_091.png"),
    ("نشر ثقافة القانون الدولي الإنساني", r"assets\images\dorh\a6601073-d7cc-599a-b9cb-6f39a01dd255.jpg"),
    ("ضوابط فحص العروض في العقود العامة", r"assets\images\dorh\stock\stock_070.png"),
    ("أحكام الصلح الشرعية والنظامية", r"assets\images\dorh\stock\stock_055.png"),
    ("التخطيط وإدارة الوقت والأولويات", r"assets\images\dorh\stock\stock_182.png"),
    ("مهارات التعامل مع ضغوط العمل", r"assets\images\dorh\stock\stock_038.png"),
    ("الإبداع والابتكار وتطوير بيئة العمل", r"assets\images\dorh\stock\stock_009.png"),
    ("مهارات القراءة السريعة ودورها في دقة وسرعة توجيه المعاملات", r"assets\images\dorh\stock\stock_067.png"),
    ("جودة الحياة", r"assets\images\dorh\stock\stock_175.png"),
    ("خدمة العملاء", r"assets\images\dorh\stock\stock_010.png"),
    ("الكتابة الوظيفية", r"assets\images\dorh\stock\stock_138.png"),
    ("تطوير خدمات المستفيدين", r"assets\images\dorh\stock\stock_013.png"),
    ("السكرتير التنفيذي المحترف", r"assets\images\dorh\stock\stock_158.png"),
    ("تدريب المدربين", r"assets\images\dorh\stock\stock_044.png"),
    ("التعلم النشط", r"assets\images\dorh\stock\stock_149.png"),
    ("التعليم عبر الجوال", r"assets\images\dorh\stock\stock_167.png"),
    ("إدارة البيئة الصفية", r"assets\images\dorh\stock\stock_191.png"),
    ("تنمية مهارات الإشراف والمتابعة", r"assets\images\dorh\stock\stock_203.png"),
    ("مهارات العرض والإلقاء", r"assets\images\dorh\stock\stock_208.png"),
    ("طرائق التدريس", r"assets\images\dorh\stock\stock_164.png"),
    ("التقويم من أجل التعليم", r"assets\images\dorh\stock\stock_037.png"),
    ("دمج التقنية في التعليم والتدريب", r"assets\images\dorh\stock\stock_088.png"),
    ("استخدام أدوات جوجل في التعليم", r"assets\images\dorh\stock\stock_185.png"),
    ("تصميم وإنتاج الكتاب الإلكتروني", r"assets\images\dorh\stock\stock_166.png"),
    ("تصميم وإنتاج المحتوى الرقمي في التعليم والتدريب", r"assets\images\dorh\stock\stock_136.png"),
    ("أساسيات الأمن والسلامة", r"assets\images\dorh\stock\stock_041.png"),
    ("المهارات الأمنية لرجال الأمن", r"assets\images\dorh\stock\stock_056.png"),
    ("الكود السعودي للحماية من الحرائق", r"assets\images\dorh\stock\stock_063.png"),
    ("الأمن والسلامة والصحة المهنية", r"assets\images\dorh\stock\stock_030.png"),
    ("السلامة والوقاية من الحرائق في بيئة العمل", r"assets\images\dorh\stock\stock_131.png"),
    ("برنامج الأمن والسلامة والصحة المهنية للمنشآت الحكومية", r"assets\images\dorh\stock\stock_017.png"),
    ("الأمن والسلامة المتقدمة", r"assets\images\dorh\stock\stock_017.png"),
    ("إدارة العمليات الأمنية", r"assets\images\dorh\stock\stock_032.png"),
    ("إدارة مخاطر الأمن", r"assets\images\dorh\stock\stock_019.png"),
    ("الإشراف الأمني الفعال", r"assets\images\dorh\stock\stock_179.png"),
    ("الأمن والسلامة في المنشآت الصحية", r"assets\images\dorh\380dc435-7c6b-5b22-bf8a-24291dbf5b4b.jpg"),
    ("مدير السلامة والصحة المهنية", r"assets\images\dorh\stock\stock_190.png"),
    ("مكافحة الحريق والإخلاء الآمن", r"assets\images\dorh\stock\stock_071.png"),
    ("الاتجاهات الحديثة في إدارة وتطوير الخدمة الصحية", r"assets\images\dorh\stock\stock_160.png"),
    ("النظم الحديثة في إدارة وتطوير الخدمات الصحية", r"assets\images\dorh\stock\stock_053.png"),
    ("إدارة مواقع الإنشاءات والإشراف عليها", r"assets\images\dorh\stock\stock_113.png"),
    ("مهارات إدارة المشروعات الهندسية", r"assets\images\dorh\603aa385-6200-53a9-a57a-d75aff87518f.jpg"),
    ("نظم أرشفة الرسوم الهندسية", r"assets\images\dorh\stock\stock_014.png"),
    ("تقييم الأثر البيئي للمشاريع الهندسية", r"assets\images\dorh\stock\stock_139.png"),
    ("بناء المدن الذكية", r"assets\images\dorh\stock\stock_033.png"),
    ("كود البناء السعودي", r"assets\images\dorh\stock\stock_144.png"),
    ("تخطيط وتصميم ومتابعة المشاريع الهندسية", r"assets\images\dorh\stock\stock_075.png"),
    ("إدارة المخاطر في المشاريع الإنشائية", r"assets\images\dorh\stock\stock_201.png"),
    ("إدارة الجودة في المشاريع الهندسية", r"assets\images\dorh\stock\stock_113.png"),
    ("التفتيش والرقابة على المنشآت", r"assets\images\dorh\stock\stock_198.png"),
    ("إدارة المدن", r"assets\images\dorh\stock\stock_060.png"),
    ("إدارة النفايات", r"assets\images\dorh\stock\stock_051.png"),
    ("إدارة الفنادق", r"assets\images\dorh\stock\stock_134.png"),
    ("أساسيات الطهي", r"assets\images\dorh\stock\stock_105.png"),
    ("استخدام التقنيات الحديثة في الطهي", r"assets\images\dorh\stock\stock_192.png"),
    ("إدارة المطابخ والمطاعم", r"assets\images\dorh\stock\stock_118.png"),
    ("خدمة العملاء والضيافة", r"assets\images\dorh\stock\stock_130.png"),
]

# Exact catalog titles that differ from user labels
CATALOG_OVERRIDES: dict[str, str] = {
    "دورة تطوير المحتوى الإعلامي الفعّال": r"assets\images\dorh\stock\stock_096.png",
    "دورة النجاح الوظيفي وتنظيم أساليب العمل وتطويرها": r"assets\images\dorh\stock\stock_101.png",
    "دورة نظام إدارة سلامة الغذاء أيزو 22000:2018": r"assets\images\dorh\stock\stock_104.png",
    "دورة نظم إدارة سلامة الغذاء: التوثيق والتطبيق والمراجعة الأيزو 22000:2005": r"assets\images\dorh\stock\stock_104.png",
    "دورة الطهي المتقدم والتقنيات الحديثة": r"assets\images\dorh\stock\stock_192.png",
}


def normalize_title(title: str) -> str:
    t = unicodedata.normalize("NFKC", title or "")
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^(دورة|دبلوم)\s+", "", t)
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ؤ", "و").replace("ئ", "ي")
    t = t.replace("ى", "ي").replace("ة", "ه").replace("ّ", "")
    t = re.sub(r"[^\w\s\u0600-\u06FF]", "", t)
    return t.lower()


def to_web_path(path_str: str) -> str:
    p = path_str.replace("\\", "/")
    if p.startswith("C:"):
        idx = p.lower().find("/assets/images/dorh/")
        if idx >= 0:
            p = p[idx + 1:]
    if not p.startswith("assets/"):
        p = DORH_WEB + p.split("/")[-1] if "/" in p else DORH_WEB + p
    return p


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
                "/** Auto-generated — user-assigned course cover images */",
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
    user_by_norm: dict[str, tuple[str, str]] = {}
    for title, path in USER_MAPPINGS:
        user_by_norm[normalize_title(title)] = (title, to_web_path(path))

    id_map: dict[str, str] = {}
    title_map: dict[str, str] = {}
    manifest: dict[str, dict] = {}
    matched: list[str] = []
    unmatched_catalog: list[str] = []
    unmatched_user: set[str] = set(user_by_norm.keys())

    for cid, catalog_title in courses:
        if catalog_title in CATALOG_OVERRIDES:
            web = to_web_path(CATALOG_OVERRIDES[catalog_title])
            id_map[cid] = web
            nt = re.sub(r"\s+", " ", catalog_title.strip())
            title_map[nt] = web
            manifest[cid] = {
                "title": catalog_title,
                "image": web.replace(DORH_WEB, ""),
                "user_title": catalog_title,
            }
            matched.append(catalog_title)
            continue

        norm = normalize_title(catalog_title)
        hit = user_by_norm.get(norm)
        if not hit:
            # try substring / best overlap
            best = None
            best_len = 0
            for un, (ut, up) in user_by_norm.items():
                if un in norm or norm in un:
                    overlap = min(len(un), len(norm))
                    if overlap > best_len:
                        best_len = overlap
                        best = (ut, up)
            hit = best
        if hit:
            user_title, web = hit
            id_map[cid] = web
            nt = re.sub(r"\s+", " ", catalog_title.strip())
            title_map[nt] = web
            manifest[cid] = {
                "title": catalog_title,
                "image": web.replace(DORH_WEB, ""),
                "user_title": user_title,
            }
            matched.append(catalog_title)
            unmatched_user.discard(normalize_title(user_title))
        else:
            unmatched_catalog.append(catalog_title)

    # Keep existing mappings for courses not in user list (fallback from current file)
    if MAP_JS.exists():
        old = MAP_JS.read_text(encoding="utf-8")
        for m in re.finditer(r'"([0-9a-f-]{36})":\s*"([^"]+)"', old):
            cid, url = m.group(1), m.group(2)
            if cid not in id_map:
                id_map[cid] = url

    default = "assets/images/dorh/stock/stock_001.png"
    write_map_js(id_map, title_map, default)
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Catalog courses: {len(courses)}")
    print(f"User mappings: {len(USER_MAPPINGS)}")
    print(f"Matched: {len(matched)}")
    report = ROOT / "database" / "course_image_mapping_report.txt"
    lines = [
        f"Catalog courses: {len(courses)}",
        f"User mappings: {len(USER_MAPPINGS)}",
        f"Matched: {len(matched)}",
    ]
    if unmatched_catalog:
        lines.append(f"\nUnmatched catalog ({len(unmatched_catalog)}):")
        lines.extend(f"  - {t}" for t in unmatched_catalog)
    if unmatched_user:
        lines.append(f"\nUnmatched user entries ({len(unmatched_user)}):")
        lines.extend(f"  - {user_by_norm[k][0]}" for k in sorted(unmatched_user))
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Report: {report}")


if __name__ == "__main__":
    main()
