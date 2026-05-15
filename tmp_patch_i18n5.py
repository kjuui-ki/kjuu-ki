import pathlib
import re

def unescape_js_string(s: str) -> str:
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c != '\\':
            out.append(c)
            i += 1
            continue
        i += 1
        if i >= len(s):
            break
        esc = s[i]
        i += 1
        if esc == 'n':
            out.append('\n')
        elif esc == 'r':
            out.append('\r')
        elif esc == 't':
            out.append('\t')
        elif esc == 'b':
            out.append('\b')
        elif esc == 'f':
            out.append('\f')
        elif esc == '\\':
            out.append('\\')
        elif esc == '/':
            out.append('/')
        elif esc == '"':
            out.append('"')
        elif esc == "'":
            out.append("'")
        elif esc == 'u' and i + 4 <= len(s):
            hexval = s[i:i+4]
            i += 4
            out.append(chr(int(hexval, 16)))
        elif esc == 'x' and i + 2 <= len(s):
            hexval = s[i:i+2]
            i += 2
            out.append(chr(int(hexval, 16)))
        else:
            out.append(esc)
    return ''.join(out)

def parse_ar_translations(main_text: str) -> dict[str, str]:
    start = main_text.find('ar: {')
    if start < 0:
        raise SystemExit('Could not find ar block')
    brace_level = 0
    end = None
    for i in range(start, len(main_text)):
        if main_text[i] == '{':
            brace_level += 1
        elif main_text[i] == '}':
            brace_level -= 1
            if brace_level == 0:
                end = i
                break
    if end is None:
        raise SystemExit('Could not parse ar block')
    ar_block = main_text[start + len('ar: {'):end]
    entries = re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', ar_block)
    return {k: unescape_js_string(v) for k, v in entries}

def replace_data_i18n(html: str, trans: dict[str, str]) -> str:
    pattern = re.compile(
        r'<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)(?P<attrs>[^>]*?\bdata-i18n="(?P<key>[^"]+)"[^>]*?)>',
        re.S,
    )
    out = []
    pos = 0
    while True:
        m = pattern.search(html, pos)
        if not m:
            out.append(html[pos:])
            break
        tag = m.group('tag')
        key = m.group('key')
        attrs = m.group('attrs')
        start_tag_end = m.end()
        search_pos = start_tag_end
        depth = 1
        while True:
            open_match = re.search(fr'<{tag}\b[^>]*>', html[search_pos:], re.S | re.I)
            close_match = re.search(fr'</{tag}>', html[search_pos:], re.I)
            if not close_match:
                out.append(html[pos:])
                return ''.join(out)
            if open_match and open_match.start() < close_match.start():
                depth += 1
                search_pos += open_match.end()
                continue
            depth -= 1
            if depth == 0:
                inner_start = start_tag_end
                inner_end = search_pos + close_match.start()
                close_end = search_pos + close_match.end()
                inner_html = html[inner_start:inner_end]
                replacement = trans.get(key, inner_html)
                out.append(html[pos:m.start()])
                out.append(f'<{tag}{attrs}>{replacement}</{tag}>')
                pos = close_end
                break
            search_pos += close_match.end()
    return ''.join(out)

def replace_attr_with_translation(html: str, attr_name: str, target_attr: str, trans: dict[str, str]) -> str:
    pattern = re.compile(r'(<[^>]*\b' + re.escape(attr_name) + r'="(?P<key>[^"]+)"[^>]*>)', re.S)
    def repl(match):
        tag = match.group(1)
        key = match.group('key')
        if key not in trans:
            return tag
        attr_pattern = re.compile(r'(^|\s)' + re.escape(target_attr) + r'="([^"]*)"')
        return attr_pattern.sub(lambda m: f'{m.group(1)}{target_attr}="{trans[key]}"', tag, count=1)
    return pattern.sub(repl, html)

def replace_placeholder_attrs(html: str, trans: dict[str, str]) -> str:
    return replace_attr_with_translation(html, 'data-i18n-placeholder', 'placeholder', trans)

def replace_value_attrs(html: str, trans: dict[str, str]) -> str:
    return replace_attr_with_translation(html, 'data-i18n-value', 'value', trans)

def replace_alt_attrs(html: str, trans: dict[str, str]) -> str:
    return replace_attr_with_translation(html, 'data-i18n-alt', 'alt', trans)

def replace_data_value_attrs(html: str, trans: dict[str, str]) -> str:
    return replace_attr_with_translation(html, 'data-i18n', 'data-value', trans)

def replace_broken_alt_attrs(html: str) -> str:
    html = html.replace('alt="???? ????? ????? ????"', 'alt="شعار ماهر"')
    html = re.sub(r'alt="(?:[\?\s]+)"', 'alt="صورة"', html)
    return html

def replace_broken_placeholder_attrs(html: str) -> str:
    return re.sub(r'(\bplaceholder=")([^"]*\?[^\"]*)(")', r'\1أدخل هنا\3', html)

def replace_broken_placeholders_from_labels(html: str) -> str:
    pattern = re.compile(
        r'(<(?:input|textarea)\b[^>]*\bid="(?P<id>[^"]+)"[^>]*\bplaceholder=")([^"]*\?[^\"]*)(")',
        re.S,
    )
    def repl(match):
        element_id = match.group('id')
        label_pattern = re.compile(r'<label[^>]*\bfor="' + re.escape(element_id) + r'"[^>]*>([^<]*)</label>', re.S)
        label_match = label_pattern.search(html)
        if label_match:
            label_text = re.sub(r'\s*\*\s*$', '', label_match.group(1).strip())
            if label_text:
                return match.group(1) + 'أدخل ' + label_text + match.group(4)
        return match.group(0)
    return pattern.sub(repl, html)

def replace_broken_option_values(html: str) -> str:
    pattern = re.compile(r'(<option\b[^>]*\bvalue=")([\?\s]*)("[^>]*>)([^<]*)(</option>)', re.S)
    def repl(match):
        inner = match.group(4).strip()
        if inner:
            return match.group(1) + inner + match.group(3) + match.group(4) + match.group(5)
        return match.group(0)
    return pattern.sub(repl, html)

def replace_fallback_select_labels(html: str) -> str:
    select_fallbacks = {
        'jobsTypeFilter': {
            'aria': 'اختر نوع الوظيفة',
            'options': [
                {'value': '', 'label': 'اختر نوع الوظيفة'},
                {'value': 'دوام كامل', 'label': 'دوام كامل'},
                {'value': 'دوام جزئي', 'label': 'دوام جزئي'},
                {'value': 'عقد مؤقت', 'label': 'عقد مؤقت'},
            ],
        },
        'jobsCityFilter': {
            'aria': 'اختر المدينة',
            'options': [
                {'value': '', 'label': 'كل المدن'},
                {'value': 'الرياض', 'label': 'الرياض'},
                {'value': 'جدة', 'label': 'جدة'},
                {'value': 'الدمام', 'label': 'الدمام'},
                {'value': 'مكة', 'label': 'مكة'},
            ],
        },
    }
    for select_id, fallback in select_fallbacks.items():
        pattern = re.compile(r'(<select\b[^>]*\bid="' + re.escape(select_id) + r'"[^>]*>)((?:.|\n)*?)(</select>)', re.S)
        def repl(match):
            start_tag = match.group(1)
            if 'aria-label' in start_tag:
                start_tag = re.sub(r'(aria-label=")[^"]*(")', r'\1' + fallback['aria'] + r'\2', start_tag)
            options_html = ''.join(
                f'<option value="{opt["value"]}">{opt["label"]}</option>' for opt in fallback['options']
            )
            return start_tag + options_html + match.group(3)
        html = pattern.sub(repl, html)
    return html

def replace_broken_icon_placeholders(html: str) -> str:
    html = re.sub(r'(<[^>]+\bclass="[^"]*(?:icon|badge|avatar)[^"]*"[^>]*>)[\?\uFFFD\s]*(</[^>]+>)', r'\1•\2', html)
    html = re.sub(r'(<div class="cdash-avatar"[^>]*>)[\?\uFFFD\s]*(</div>)', r'\1👤\2', html)
    html = re.sub(r'(<span class="cdash-tab-icon"[^>]*>)[\?\uFFFD\s]*(</span>)', r'\1➕\2', html)
    return html

def replace_broken_contact_icons(html: str) -> str:
    html = re.sub(r'>(\?{2,})\s+www', '>🌐 www', html)
    html = re.sub(r'>(\?{2,})\s+<a href="tel:', '>📞 <a href="tel:', html)
    html = re.sub(r'>(\?{2,})[\?\uFFFD\s]*\s+<a href="mailto:', '>✉️ <a href="mailto:', html)
    return html

def replace_broken_title(html: str, fallback_title: str) -> str:
    return re.sub(r'(<title>)([^<]*[?�][^<]*)(</title>)', rf'\1{fallback_title}\3', html)

def replace_meta_tag_if_broken(html: str, attr_name: str, attr_value: str, replacement: str) -> str:
    pattern = re.compile(
        r'(<meta[^>]*\b' + re.escape(attr_name) + r'="' + re.escape(attr_value) + r'"[^>]*content=")([^"]*)(")',
        re.I,
    )
    def repl(match):
        value = match.group(2)
        if '?' in value or '�' in value:
            return match.group(1) + replacement + match.group(3)
        return match.group(0)
    return pattern.sub(repl, html)

def replace_broken_metadata(html: str, fallback_title: str) -> str:
    html = replace_meta_tag_if_broken(html, 'name', 'description', fallback_title)
    html = replace_meta_tag_if_broken(html, 'property', 'og:title', fallback_title)
    html = replace_meta_tag_if_broken(html, 'property', 'og:description', fallback_title)
    html = replace_meta_tag_if_broken(html, 'property', 'og:site_name', 'ماهر')
    html = replace_meta_tag_if_broken(html, 'name', 'twitter:title', fallback_title)
    html = replace_meta_tag_if_broken(html, 'name', 'twitter:description', fallback_title)
    return html

def replace_meta_title(html: str, translations: dict[str, str], page_key: str) -> str:
    if page_key not in translations:
        return html
    # Replace known title/meta tags if they are broken
    html = re.sub(r'(<title>)[^<]*(</title>)', rf'\1{translations[page_key]}\2', html)
    html = re.sub(r'(<meta[^>]+\bname="description"[^>]+content=")([^"]*)("[^>]*>)',
                  lambda m: m.group(1) + translations.get(page_key + '.desc', m.group(2)) + m.group(3),
                  html)
    return html

path_main = pathlib.Path('assets/js/main.js')
main_text = path_main.read_text(encoding='utf-8')
translations = parse_ar_translations(main_text)

# Build a small fallback mapping for HTML title replacements if exact keys exist.
static_page_titles = {
    'index.html': 'ماهر | طوّر مهاراتك وابنِ مسارك المهني',
    'jobs.html': 'الوظائف | ماهر',
    'courses.html': 'الدورات التدريبية | ماهر',
    'contact.html': 'تواصل معنا | ماهر',
    'login.html': 'تسجيل دخول | ماهر',
    'register.html': 'إنشاء حساب | ماهر',
    'seeker-login.html': 'تسجيل دخول الباحثين | ماهر',
    'employer-login.html': 'تسجيل دخول الشركات | ماهر',
    'seeker-register.html': 'إنشاء حساب باحث عن عمل | ماهر',
    'employer-register.html': 'إنشاء حساب شركة | ماهر',
    'profile.html': 'ملفي الشخصي | ماهر',
    'company-dashboard.html': 'لوحة تحكم الشركة | ماهر',
    'company-profile.html': 'ملف الشركة | ماهر',
    'dashboard.html': 'لوحة التحكم | ماهر',
    'post-job.html': 'نشر وظيفة | ماهر',
    'job-details.html': 'تفاصيل الوظيفة | ماهر',
    'my-applications.html': 'طلباتي | ماهر',
    'apply.html': 'التقديم على وظيفة | ماهر',
    'course-access.html': 'الدورات التدريبية | ماهر',
    'reset-password.html': 'نسيت كلمة المرور | ماهر',
    'mobile-preview.html': 'عرض الجوال | ماهر',
}

for path in sorted(pathlib.Path('.').glob('*.html')):
    if path.name.startswith('tmp_patch'):
        continue
    text = path.read_text(encoding='utf-8', errors='replace')
    orig = text
    text = replace_data_i18n(text, translations)
    text = replace_placeholder_attrs(text, translations)
    text = replace_value_attrs(text, translations)
    text = replace_alt_attrs(text, translations)
    text = replace_data_value_attrs(text, translations)
    text = replace_broken_alt_attrs(text)
    text = replace_broken_placeholders_from_labels(text)
    text = replace_broken_placeholder_attrs(text)
    text = replace_broken_option_values(text)
    text = replace_fallback_select_labels(text)
    text = replace_broken_contact_icons(text)
    text = replace_broken_icon_placeholders(text)
    if path.name in static_page_titles:
        text = replace_broken_title(text, static_page_titles[path.name])
        text = replace_broken_metadata(text, static_page_titles[path.name])
    else:
        text = replace_broken_metadata(text, 'منصة ماهر للتوظيف والتدريب')

    if text != orig:
        out = pathlib.Path('tmp_patch5_' + path.name)
        out.write_text(text, encoding='utf-8')
        print('wrote', out.name, 'changed', len(text) - len(orig))
