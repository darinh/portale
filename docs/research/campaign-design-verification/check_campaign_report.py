"""Check campaign-design.md: every cited URL was fetched this session, the XP table
matches the SRD 5.2.1 PDF, and the prose has no banned dash or curly-quote characters.

Usage: python check_campaign_report.py
"""
import hashlib, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
REPORT = HERE.parent / "campaign-design.md"
CACHE = HERE / "src" / "cache"
SRD = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
FETCHED_WITH_WEB_FETCH = {
    "https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule",
    "https://slyflourish.com/lazy_gm_resource_document.html",
    "https://thealexandrian.net/wordpress/13085/roleplaying-games/xandering-the-dungeon",
    "https://www.roleplayingtips.com/5-room-dungeons/",
    "https://thealexandrian.net/wordpress/8122/roleplaying-games/node-based-scenario-design-collectors-edition",
    "https://raw.githubusercontent.com/Sagelt/Dungeon-World/master/LICENSE",
}


def cached(url: str) -> bool:
    return (CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".txt")).exists()


def downloaded_articles() -> set[str]:
    urls = set()
    for p in (HERE / "src").glob("alex-*.txt"):
        head = p.read_text(encoding="utf-8").splitlines()[:2]
        urls.update(l.split(": ", 1)[1].strip() for l in head if l.startswith(("URL:", "FINAL:")))
    return urls


def check_urls(text: str) -> int:
    urls = sorted(set(re.findall(r"\]\((https?://[^)\s]+)\)", text)))
    known = downloaded_articles() | FETCHED_WITH_WEB_FETCH
    missing = [u for u in urls if not (cached(u) or u in known)]
    print(f"urls cited: {len(urls)}, fetched this session: {len(urls) - len(missing)}")
    for u in missing:
        print(f"  NOT FETCHED: {u}")
    return len(missing)


def check_xp_table(text: str) -> int:
    rows = re.findall(r"^\| (\d{1,2}) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \|$", text, re.M)
    mine = [int(x.replace(",", "")) for row in rows for x in row]
    srd = re.sub(r"\s+", " ", (CACHE / (hashlib.sha1(SRD.encode()).hexdigest() + ".txt")).read_text(encoding="utf-8"))
    seg = srd[srd.index("XP Budget per Character Party"):srd.index("Step 3: Spend Your Budget")]
    seg = re.sub(r"(\d),(\d)", r"\1\2", re.sub(r"(\d,\d{2}) (\d)\b", r"\1\2", seg))
    theirs = [int(n) for n in re.findall(r"\b\d+\b", seg.split("High", 1)[1])]
    ok = mine == theirs and len(rows) == 20
    print(f"xp table rows: {len(rows)}, matches SRD 5.2.1: {ok}")
    if not ok:
        print("  mine:  ", mine)
        print("  theirs:", theirs)
    return 0 if ok else 1


def check_style(text: str) -> int:
    bad = {"\u2014": "em dash", "\u2013": "en dash", "\u2018": "curly quote", "\u2019": "curly quote",
           "\u201c": "curly quote", "\u201d": "curly quote"}
    hits = [(i + 1, bad[c]) for i, line in enumerate(text.splitlines()) for c in line if c in bad]
    print(f"banned characters: {len(hits)}")
    for line, what in hits[:20]:
        print(f"  line {line}: {what}")
    return len(hits)


if __name__ == "__main__":
    report = REPORT.read_text(encoding="utf-8")
    failures = check_urls(report) + check_xp_table(report) + check_style(report)
    print(f"inference tags: {report.count('[Inference]')}")
    sys.exit(1 if failures else 0)
