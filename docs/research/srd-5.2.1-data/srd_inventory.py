"""Rebuild the SRD 5.2.x inventory counts cited in docs/research/rules-srd-5.2.1.md.

Usage: python srd_inventory.py [workdir]
Needs PyMuPDF (pip install pymupdf). Downloads the official PDFs into workdir.
"""
import collections
import os
import re
import sys
import urllib.request

import pymupdf

PDFS = {
    "5.2.1": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
    "5.2.0": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf",
}
SCHOOLS = "Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation"
SIZES = r"^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b"
HEADER_FONT = "GillSans-SemiBold"


def fetch(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def lines(doc, first, last_exclusive):
    text = "\n".join(doc[i - 1].get_text() for i in range(first, last_exclusive))
    return [l.strip() for l in text.split("\n")]


def headers(doc, first, last_exclusive):
    found = []
    for pno in range(first, last_exclusive):
        for block in doc[pno - 1].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                t = "".join(s["text"] for s in line["spans"]
                            if s["font"] == HEADER_FONT and abs(s["size"] - 12) < 0.1).strip()
                if t:
                    found.append(t)
    merged = []
    for h in found:
        # A wrapped header continues on a line that starts lowercase, with "and", or with a [Tag].
        if merged and (h[0].islower() or h.startswith("and ") or h.startswith("[")):
            merged[-1] += " " + h
        else:
            merged.append(h)
    return merged


def inventory(path):
    doc = pymupdf.open(path)
    toc = doc.get_toc()
    sec = {t: p for lvl, t, p in toc if lvl == 2}
    monsters_start = sec["Monsters"]

    spell_lines = lines(doc, sec["Spells"], sec["Rules Glossary"])
    spells = []
    for i, l in enumerate(spell_lines):
        m = re.match(rf"^(?:Level (\d) ({SCHOOLS})|({SCHOOLS}) Cantrip) \(", l)
        if m:
            spells.append((spell_lines[i - 1], 0 if m.group(3) else int(m.group(1))))

    mon_lines = lines(doc, monsters_start, doc.page_count + 1)
    monsters = []
    for i, l in enumerate(mon_lines):
        if re.match(r"^AC \d+", l):
            k = i - 1
            while k > i - 4 and not re.match(SIZES, mon_lines[k]):
                k -= 1
            cr = next((re.match(r"^CR ([\d/]+)", x).group(1) for x in mon_lines[i:i + 80]
                       if re.match(r"^CR ([\d/]+)", x)), None)
            monsters.append((mon_lines[k - 1], cr))

    items_start = next((p for lvl, t, p in toc if lvl == 3 and t.startswith("Magic Items A")), None)
    items = headers(doc, items_start, monsters_start) if items_start else []

    glossary = headers(doc, sec["Rules Glossary"], sec["Gameplay Toolbox"])
    return spells, monsters, items, glossary


def main():
    work = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(work, exist_ok=True)
    results = {}
    for version, url in PDFS.items():
        path = fetch(url, os.path.join(work, f"srd-{version}.pdf"))
        spells, monsters, items, glossary = inventory(path)
        results[version] = (spells, monsters, items, glossary)
        print(f"SRD {version}: spells={len(spells)} statblocks={len(monsters)} "
              f"magic_items={len(items) or 'n/a'} glossary_entries={len(glossary)}")
        print("  spells by level:", dict(sorted(collections.Counter(l for _, l in spells).items())))
    new, old = results["5.2.1"], results["5.2.0"]
    print("stat blocks only in 5.2.1:", sorted({n for n, _ in new[1]} - {n for n, _ in old[1]}))
    print("magic items only in 5.2.1:", sorted(set(new[2]) - set(old[2])))
    with open(os.path.join(work, "srd521-spells.tsv"), "w", encoding="utf-8") as f:
        f.write("\n".join(f"{lvl}\t{name}" for name, lvl in new[0]) + "\n")
    with open(os.path.join(work, "srd521-statblocks.tsv"), "w", encoding="utf-8") as f:
        f.write("\n".join(f"{name}\t{cr}" for name, cr in new[1]) + "\n")
    with open(os.path.join(work, "srd521-magic-items.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(new[2]) + "\n")
    with open(os.path.join(work, "srd521-glossary.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(new[3]) + "\n")


if __name__ == "__main__":
    main()
