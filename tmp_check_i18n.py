import pathlib
import re
path = pathlib.Path('assets/js/main.js')
main = path.read_text(encoding='utf-8')
# Find the ar translation block
m = re.search(r"ar:\s*\{(.*?\n\s*\})\s*\}", main, re.S)
if not m:
    raise SystemExit('ar block not found')
text = m.group(1)
entries = re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
trans = {k: bytes(v, 'utf-8').decode('unicode_escape') for k, v in entries}
for key in ['hero.title', 'hero.subtitle', 'hero.search.submit', 'section.why.title']:
    print(key, repr(trans.get(key)))
html = pathlib.Path('index.html').read_text(encoding='utf-8', errors='ignore')
# replace hero.title sample
sample = re.sub(r'(<[^>]+data-i18n="hero\.title"[^>]*>)(.*?)(</[^>]+>)', lambda m: m.group(1) + trans.get('hero.title', '') + m.group(3), html)
print(sample[:200])
