import pathlib
import re

path_main = pathlib.Path('assets/js/main.js')
main_text = path_main.read_text(encoding='utf-8')
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
trans = {k: bytes(v, 'utf-8').decode('unicode_escape') for k, v in entries}

for path in sorted(pathlib.Path('.').glob('*.html')):
    text = path.read_text(encoding='utf-8', errors='ignore')
    orig = text

    # Replace data-i18n content
    text = re.sub(
        r'(<[^>]*\bdata-i18n="([^"]+)"[^>]*>)(.*?)(</[^>]+>)',
        lambda m: m.group(1) + trans.get(m.group(2), m.group(3)) + m.group(4),
        text,
        flags=re.S,
    )
    # Replace data-i18n-placeholder
    text = re.sub(
        r'(<[^>]*\bdata-i18n-placeholder="([^"]+)"[^>]*\bplaceholder=")([^"]*)(")',
        lambda m: m.group(1) + trans.get(m.group(2), m.group(3)) + m.group(4),
        text,
    )
    # Replace data-i18n-value
    text = re.sub(
        r'(<[^>]*\bdata-i18n-value="([^"]+)"[^>]*\bvalue=")([^"]*)(")',
        lambda m: m.group(1) + trans.get(m.group(2), m.group(3)) + m.group(4),
        text,
    )

    if text != orig:
        out = pathlib.Path('tmp_patch2_' + path.name)
        out.write_text(text, encoding='utf-8')
        print('wrote', out.name, 'changed', len(text) - len(orig))
