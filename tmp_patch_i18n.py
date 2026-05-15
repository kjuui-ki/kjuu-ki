import pathlib
import re
import json
from pprint import pprint

# Load Arabic translation dictionary from main.js
main_text = pathlib.Path('assets/js/main.js').read_text(encoding='utf-8')
# Find ar block by simple parse
start = main_text.find('ar: {')
if start < 0:
    raise SystemExit('Could not find ar block')
brace_level = 0
end = None
for i in range(start, len(main_text)):
    ch = main_text[i]
    if ch == '{':
        brace_level += 1
    elif ch == '}':
        brace_level -= 1
        if brace_level == 0:
            end = i
            break
if end is None:
    raise SystemExit('Could not parse ar block')
ar_block = main_text[start + len('ar: {'):end]
entries = re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', ar_block)
trans = {k: bytes(v, 'utf-8').decode('unicode_escape') for k, v in entries}

html_files = sorted([p for p in pathlib.Path('.').glob('*.html')])
changes = {}
for path in html_files:
    text = path.read_text(encoding='utf-8', errors='ignore')
    orig = text
    # replace data-i18n text content
    def repl_text(m):
        key = m.group(1)
        if key in trans:
            return m.group(0).replace(m.group(2), trans[key])
        return m.group(0)
    text = re.sub(r'(data-i18n="([^"]+)")[^>]*>(.*?)</', lambda m: m.group(0).replace(m.group(3), trans.get(m.group(2), m.group(3))), text, flags=re.S)
    # replace placeholders
    text = re.sub(r'(data-i18n-placeholder="([^"]+)")[^>]*placeholder="([^"]*)"', lambda m: m.group(0).replace(m.group(3), trans.get(m.group(2), m.group(3))), text)
    # replace values
    text = re.sub(r'(data-i18n-value="([^"]+)")[^>]*value="([^"]*)"', lambda m: m.group(0).replace(m.group(3), trans.get(m.group(2), m.group(3))), text)
    if text != orig:
        changes[path.name] = {'original_len': len(orig), 'new_len': len(text), 'diff_count': sum(1 for o,n in zip(orig,text) if o!=n)}
        # report only first 300 chars of changed segments
        diff = []
        for line in text.splitlines():
            if '????' in line or '??' in line or 'data-i18n' in line:
                pass
        pathlib.Path('tmp_patch_'+path.name).write_text(text, encoding='utf-8')

pprint(changes)
print('wrote temporary patched files tmp_patch_*.html')
