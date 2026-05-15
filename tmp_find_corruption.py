from pathlib import Path
import re

for path in sorted(Path('.').glob('*.html')):
    text = path.read_text(encoding='utf-8', errors='replace')
    for i, line in enumerate(text.splitlines(), 1):
        if '??' in line or '�' in line:
            print(path.name, i, line.strip())
