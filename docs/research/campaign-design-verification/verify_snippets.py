"""Check that each (url, snippet) claim appears on the fetched page.

Usage: python verify_snippets.py claims.tsv
claims.tsv rows: url<TAB>snippet. Pages are cached under src/cache.
Prints FOUND, PARTIAL (best contiguous match ratio), or FETCH-ERR per row.
"""
import difflib, hashlib, html, io, pathlib, re, sys, urllib.request

HERE = pathlib.Path(__file__).parent
CACHE = HERE / "src" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def fetch(url: str) -> str:
    key = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".txt")
    if key.exists():
        return key.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read()
        ctype = r.headers.get("Content-Type", "")
    if url.lower().endswith(".pdf") or "pdf" in ctype or data[:4] == b"%PDF":
        from pypdf import PdfReader
        text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
    else:
        raw = data.decode("utf-8", "replace")
        raw = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
        text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    key.write_text(text, encoding="utf-8")
    return text


def norm(s: str) -> str:
    s = s.lower()
    s = s.translate(str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
                                   "\u2013": "-", "\u2014": "-", "\u00d7": "x", "\u00a0": " "}))
    s = re.sub(r"[*_`#>]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main(path: str) -> None:
    rows = [l.split("\t", 1) for l in pathlib.Path(path).read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")]
    for url, snippet in rows:
        try:
            page = norm(fetch(url))
        except Exception as e:
            print(f"FETCH-ERR\t{url}\t{type(e).__name__}: {e}")
            continue
        snip = norm(snippet)
        if snip in page:
            print(f"FOUND\t{url}\t{snippet[:70]}")
            continue
        m = difflib.SequenceMatcher(None, page, snip, autojunk=False).find_longest_match(0, len(page), 0, len(snip))
        print(f"PARTIAL {m.size / max(1, len(snip)):.2f}\t{url}\t{snippet[:70]}\t| page: {page[m.a:m.a + m.size][:60]}")


if __name__ == "__main__":
    main(sys.argv[1])
