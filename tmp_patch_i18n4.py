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
    pattern = re.compile(r'<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)(?P<attrs>[^>]*?\bdata-i18n="(?P<key>[^"]+)"[^>]*?)>', re.S)
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


def replace_attr_value(html: str, attr_name: str, trans: dict[str, str]) -> str:
    pattern = re.compile(r'(' + re.escape(attr_name) + r'="([^"]+)")')
    def repl(match):
        full = match.group(0)
        key = match.group(2)
        return f'{attr_name}="{trans.get(key, key)}"'
    return pattern.sub(repl, html)


path_main = pathlib.Path('assets/js/main.js')
main_text = path_main.read_text(encoding='utf-8')
translations = parse_ar_translations(main_text)

for path in sorted(pathlib.Path('.').glob('*.html')):
    if path.name.startswith('tmp_patch'):
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    orig = text
    text = replace_data_i18n(text, translations)
    text = replace_attr_value(text, 'data-i18n-placeholder', translations)
    text = replace_attr_value(text, 'data-i18n-value', translations)

    if text != orig:
        out = pathlib.Path('tmp_patch4_' + path.name)
        out.write_text(text, encoding='utf-8')
        print('wrote', out.name, 'changed', len(text) - len(orig))
