import os, re

files = [f for f in os.listdir('.') if f.endswith('.html')]
for fname in files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'maher-loading' not in content:
        content = re.sub(r'<html\b', '<html class="maher-loading"', content, count=1)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated:', fname)
    else:
        print('Skip:', fname)
