"""Print context around a regex on a fetched (cached) page.

Usage: python ctx.py <url> <regex> [width=300] [max=3]
"""
import re, sys
from verify_snippets import fetch

url, pat = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 300
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 3
text = re.sub(r"[^\x20-\x7e]", " ", re.sub(r"\s+", " ", fetch(url)))
hits = list(re.finditer(pat, text, re.I))
print(f"== {url} /{pat}/ hits={len(hits)}")
for m in hits[:limit]:
    print("...", text[max(0, m.start() - width):m.end() + width], "...\n")
