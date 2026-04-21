#!/usr/bin/env python3
"""
Fix double-encoded Arabic text in HTML files.
Pattern: UTF-8 bytes were misread as Windows-1252, then re-encoded as UTF-8.
Fix: decode as UTF-8 -> encode as cp1252 -> decode as utf-8.

Only applies targeted fixes to avoid breaking already-correct content.
"""
import re

def reverse_mojibake(text):
    """Convert CP1252-mojibake back to correct Unicode.
    
    The double-encoding: UTF-8 bytes → read as CP1252 chars → written as UTF-8.
    To reverse: read as UTF-8 (gives CP1252 chars) → encode as CP1252 bytes → decode as UTF-8.
    
    Handles undefined CP1252 positions (0x81, 0x8D, 0x8F, 0x90, 0x9D) via Latin-1 fallback,
    and CP1252 special chars (Ÿ=U+0178→0x9F, Š=U+0160→0x8A, etc.) via explicit table.
    """
    # CP1252 special characters (0x80-0x9F range with non-Latin-1 Unicode values)
    CP1252_ENCODE = {
        0x20AC: 0x80,  # €
        0x201A: 0x82,  # ‚
        0x0192: 0x83,  # ƒ
        0x201E: 0x84,  # „
        0x2026: 0x85,  # …
        0x2020: 0x86,  # †
        0x2021: 0x87,  # ‡
        0x02C6: 0x88,  # ˆ
        0x2030: 0x89,  # ‰
        0x0160: 0x8A,  # Š
        0x2039: 0x8B,  # ‹
        0x0152: 0x8C,  # Œ
        0x017D: 0x8E,  # Ž
        0x2018: 0x91,  # '
        0x2019: 0x92,  # '
        0x201C: 0x93,  # "
        0x201D: 0x94,  # "
        0x2022: 0x95,  # •
        0x2013: 0x96,  # –
        0x2014: 0x97,  # —
        0x02DC: 0x98,  # ˜
        0x2122: 0x99,  # ™
        0x0161: 0x9A,  # š
        0x203A: 0x9B,  # ›
        0x0153: 0x9C,  # œ
        0x017E: 0x9E,  # ž
        0x0178: 0x9F,  # Ÿ
    }
    result = bytearray()
    for ch in text:
        cp = ord(ch)
        if cp < 0x80:
            result.append(cp)           # ASCII
        elif cp <= 0x00FF:
            result.append(cp)           # Latin-1 (includes C1 controls for undefined CP1252 positions)
        elif cp in CP1252_ENCODE:
            result.append(CP1252_ENCODE[cp])  # CP1252 special chars
        else:
            # Non-CP1252 character — already correct Unicode (e.g., emoji fixed earlier)
            # Re-encode as UTF-8 to preserve
            result.extend(ch.encode('utf-8'))
    try:
        return result.decode('utf-8')
    except UnicodeDecodeError:
        return text  # If bytes don't form valid UTF-8, return original

def fix_attr_value(m):
    """Fix a regex match group that is a mojibake attribute value."""
    quote = m.group(1)
    val = m.group(2)
    fixed = reverse_mojibake(val)
    return f'{quote}{fixed}{quote}'

def fix_tag_content(m):
    """Fix text content between tags."""
    prefix = m.group(1)
    content = m.group(2)
    suffix = m.group(3)
    fixed = reverse_mojibake(content)
    return f'{prefix}{fixed}{suffix}'

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix placeholder attributes that contain mojibake
    def fix_placeholder(m):
        val = m.group(1)
        fixed = reverse_mojibake(val)
        if fixed != val:
            return f'placeholder="{fixed}"'
        return m.group(0)
    
    content = re.sub(r'placeholder="([^"]*[\u00C0-\u017E]+[^"]*)"', fix_placeholder, content)
    
    # Fix aria-label attributes that contain mojibake
    def fix_aria(m):
        val = m.group(1)
        fixed = reverse_mojibake(val)
        if fixed != val:
            return f'aria-label="{fixed}"'
        return m.group(0)
    
    content = re.sub(r'aria-label="([^"]*[\u00C0-\u017E]+[^"]*)"', fix_aria, content)
    
    # Fix option value attributes that contain mojibake
    def fix_value(m):
        val = m.group(1)
        fixed = reverse_mojibake(val)
        if fixed != val:
            return f'value="{fixed}"'
        return m.group(0)
    
    # Match value="..." where the value has mojibake (Latin Extended block chars)
    content = re.sub(r'value="([^"]*[\u00C0-\u017E][^"]*)"', fix_value, content)
    
    # Fix option text content (between > and <) that contains mojibake
    def fix_option_text(m):
        tag = m.group(1)
        text = m.group(2)
        close = m.group(3)
        # Fix only the mojibake portions — split on high-Unicode chars (emoji already correct)
        # Process char by char: run of mojibake chars (U+00C0-U+017E and CP1252 specials and C1 controls)
        # vs already-correct chars (emoji U+1F000+, correct Arabic U+0600-U+06FF)
        def is_mojibake_char(c):
            cp = ord(c)
            return (0x0080 <= cp <= 0x00FF) or cp in (0x20AC, 0x201A, 0x0192, 0x201E, 0x2026,
                0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017D, 0x2018,
                0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161,
                0x203A, 0x0153, 0x017E, 0x0178)
        
        # Group consecutive mojibake chars and fix each run
        runs = []
        current_run = []
        current_is_mojibake = None
        for c in text:
            is_moj = is_mojibake_char(c)
            if current_is_mojibake is None:
                current_is_mojibake = is_moj
            if is_moj == current_is_mojibake:
                current_run.append(c)
            else:
                runs.append((current_is_mojibake, ''.join(current_run)))
                current_run = [c]
                current_is_mojibake = is_moj
        if current_run:
            runs.append((current_is_mojibake, ''.join(current_run)))
        
        fixed_parts = []
        for is_moj, run in runs:
            if is_moj and len(run) >= 2:  # Only fix runs of >=2 mojibake chars (single chars are likely real)
                fixed = reverse_mojibake(run)
                fixed_parts.append(fixed)
            else:
                fixed_parts.append(run)
        
        return f'{tag}{"".join(fixed_parts)}{close}'
    
    content = re.sub(r'(<option[^>]*>)([^<]*[\u00C0-\u017E][^<]*)(<\/option>)', fix_option_text, content)
    
    # Fix text content in ALL HTML elements (handles hardcoded emoji not covered by data-i18n)
    # reverse_mojibake is safe for already-correct content (passes through unchanged)
    def fix_text_node(m):
        text = m.group(1)
        # Only fix if it contains mojibake indicator chars
        has_mojibake = any(
            (0x0080 <= ord(c) <= 0x00FF) or ord(c) in (
                0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030,
                0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
                0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178
            ) for c in text
        )
        if not has_mojibake:
            return m.group(0)
        fixed = reverse_mojibake(text)
        if fixed != text:
            return f'>{fixed}<'
        return m.group(0)
    
    content = re.sub(r'>([^<]+)<', fix_text_node, content)
    # Already handled by the broad text node fix above.
    
    # Legacy explicit emoji map (kept for safety)
    emoji_fixes = []  # now handled by reverse_mojibake in text node fix
    for bad, good in emoji_fixes:
        content = content.replace(bad, good)
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {path}")
    else:
        print(f"No changes: {path}")
    
    return content

if __name__ == '__main__':
    import sys, os
    
    files = sys.argv[1:] if len(sys.argv) > 1 else []
    
    if not files:
        # Process all HTML files in current directory
        files = [f for f in os.listdir('.') if f.endswith('.html')]
    
    for f in files:
        try:
            process_file(f)
        except Exception as e:
            print(f"ERROR {f}: {e}")
