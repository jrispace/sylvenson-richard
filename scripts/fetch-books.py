#!/usr/bin/env python3
"""Sync the Books section — discovers every title by the configured author on Amazon.

Source: Amazon's Kindle store search filtered by author name, then each ASIN's detail page.
Output: books.json + books/<asin>.jpg covers, consumed by index.html at runtime.

Usage:  python3 scripts/fetch-books.py [--author "Sylvenson Richard"] [--market US]

JRiSpace | Sylvenson Richard
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
BOOKS_DIR = ROOT / "books"
OUT = ROOT / "books.json"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")

MARKETS = {
    "US": ("www.amazon.com", "en-US"),
    "FR": ("www.amazon.fr", "fr-FR"),
    "BR": ("www.amazon.com.br", "pt-BR"),
    "CA": ("www.amazon.ca", "en-CA"),
    "UK": ("www.amazon.co.uk", "en-GB"),
    "DE": ("www.amazon.de", "de-DE"),
}


def get(url: str, lang: str = "en-US") -> str:
    r = subprocess.run(
        ["curl", "-s", "-m", "30", "-A", UA, "-H", f"Accept-Language: {lang},en;q=0.8",
         "-H", "Accept: text/html,application/xhtml+xml", "-L", url],
        capture_output=True, text=True, errors="ignore")
    return r.stdout or ""


def plain(fragment: str) -> str:
    """Visible text from an HTML fragment."""
    frag = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", fragment, flags=re.S | re.I)
    frag = re.sub(r"<br\s*/?>|</p>", "\n", frag, flags=re.I)
    return re.sub(r"[ \t]+", " ", html.unescape(re.sub(r"<[^>]+>", " ", frag))).strip()


def search_asins(author: str, host: str, lang: str) -> list[str]:
    """All ASINs whose byline carries the author's name, across result pages."""
    found: list[str] = []
    for page in range(1, 6):
        q = urllib.parse.urlencode({"i": "digital-text", "field-author": author, "page": page})
        src = get(f"https://{host}/s?{q}", lang)
        if not src:
            continue
        hits = [(m.start(), m.group(1)) for m in re.finditer(r'data-asin="(B0[A-Z0-9]{8})"', src)]
        if not hits:
            break
        before = len(found)
        for i, (pos, asin) in enumerate(hits):
            end = hits[i + 1][0] if i + 1 < len(hits) else min(len(src), pos + 14000)
            block = plain(src[pos:end])[:600]
            # keep only results whose byline names this author
            surnames = [w for w in author.lower().split() if len(w) > 2]
            if all(s in block.lower() for s in surnames) and asin not in found:
                found.append(asin)
        if len(found) == before:      # nothing new on this page
            break
    return found


def detail(asin: str, host: str, lang: str) -> dict | None:
    src = get(f"https://{host}/dp/{asin}", lang)
    if not src or "Page Not Found" in src[:400]:
        return None

    def first(pattern: str, flags=re.S) -> str | None:
        m = re.search(pattern, src, flags)
        return m.group(1).strip() if m else None

    title = first(r'id="productTitle"[^>]*>(.*?)</span>')
    if not title:
        return None
    title = re.sub(r"\s+", " ", plain(title))

    author = first(r'class="author[^"]*"[^>]*>.*?<a[^>]*>([^<]+)</a>') or first(r'id="bylineInfo"[^>]*>(.*?)</div>')

    desc_raw = first(r'id="bookDescription_feature_div".*?<div[^>]*>(.*?)</div>', re.S) \
        or first(r'<meta name="description" content="([^"]+)"')
    desc = re.sub(r"\s+", " ", plain(desc_raw or ""))
    desc = re.sub(r"^(Product description|Description)\s*", "", desc).strip()

    def meta(label: str) -> str | None:
        """Amazon's rpi-attribute blocks: label span, then the value span."""
        m = re.search(r"rpi-attribute-label[^>]*>\s*<span>\s*" + label + r"\s*</span>.*?"
                      r"rpi-attribute-value[^>]*>\s*<span[^>]*>([^<]{1,60})", src, re.S)
        return html.unescape(m.group(1)).strip() if m else None

    pages = meta("Print length")
    if not pages:
        blk = re.search(r"ebook_pages.*?rpi-attribute-value[^>]*>(.*?)</div>", src, re.S)
        if blk:
            num = re.search(r"\b([0-9]{1,4})\b", plain(blk.group(1)))
            pages = num.group(1) if num else None
    language = meta("Language")
    published = meta("Publication date")

    cover = first(r'data-old-hires="([^"]+)"') or first(r'id="imgBlkFront"[^>]*src="([^"]+)"') \
        or first(r'<meta property="og:image" content="([^"]+)"')
    price = first(r'"priceAmount":\s*([0-9.]+)')
    if not price:
        # the price lives in three spans: symbol / whole (with a nested decimal) / fraction
        at = src.find("apex-pricetopay-value")
        blk = src[at:at + 900] if at > 0 else ""
        whole = re.search(r'a-price-whole">([0-9]+)', blk)
        frac = re.search(r'a-price-fraction">([0-9]{2})', blk)
        if whole and frac:
            price = f"{whole.group(1)}.{frac.group(1)}"
    currency = first(r'a-price-symbol">([^<]*)</span>')
    rating = first(r'([0-9]+\.[0-9]) out of 5 stars')
    publisher = meta("Publisher")
    isbn = first(r'ASIN[^<]*</span>[^<]*</span>\s*<span[^>]*>\s*(B0[A-Z0-9]{8})')

    return {
        "asin": asin,
        "title": title,
        "author": re.sub(r"\s+", " ", plain(author or "")) or None,
        "description": desc[:600] or None,
        "pages": pages,
        "language": language,
        "published": published,
        "price": price,
        "currency": currency,
        "rating": rating,
        "publisher": publisher,
        "isbn": isbn,
        "url": f"https://{host}/dp/{asin}",
        "cover_url": cover,
    }


def shrink(src: pathlib.Path, dest: pathlib.Path, max_px: int) -> None:
    """Downscale with sips on macOS; on Linux runners fall back to Pillow, then to a plain copy."""
    if shutil.which("sips"):
        subprocess.run(["sips", "-Z", str(max_px), str(src), "--out", str(dest)], capture_output=True)
        if dest.exists():
            return
    try:
        from PIL import Image  # noqa: PLC0415
        with Image.open(src) as im:
            im.thumbnail((max_px, max_px))
            im.convert("RGB").save(dest, "JPEG", quality=86, optimize=True)
        return
    except Exception:
        pass
    shutil.copyfile(src, dest)


def save_cover(book: dict) -> str | None:
    if not book.get("cover_url"):
        return None
    BOOKS_DIR.mkdir(exist_ok=True)
    dest = BOOKS_DIR / f"{book['asin']}.jpg"
    tmp = BOOKS_DIR / f"{book['asin']}.raw"
    r = subprocess.run(["curl", "-s", "-m", "45", "-A", UA, book["cover_url"], "-o", str(tmp)],
                       capture_output=True, text=True)
    if not tmp.exists() or tmp.stat().st_size < 5000:
        tmp.unlink(missing_ok=True)
        return None
    shrink(tmp, dest, 1000)
    tmp.unlink(missing_ok=True)
    return f"books/{dest.name}" if dest.exists() else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--author", default="Sylvenson Richard")
    ap.add_argument("--market", default="US", choices=sorted(MARKETS))
    args = ap.parse_args()

    host, lang = MARKETS[args.market]
    print(f"author : {args.author}\namazon : {host}")

    asins = search_asins(args.author, host, lang)
    print(f"found  : {len(asins)} asin(s) → {', '.join(asins) or 'none'}")
    if not asins:
        print("nothing to write; leaving books.json untouched", file=sys.stderr)
        return 1

    books = []
    for asin in asins:
        b = detail(asin, host, lang)
        if not b:
            print(f"  ! {asin}: detail page unreadable, skipped")
            continue
        cover = save_cover(b)
        b["cover"] = cover
        books.append(b)
        print(f"  ✓ {asin}  {b['title'][:58]}  cover={'yes' if cover else 'no'}")

    # newest first when the publication date is parseable
    def key(b):
        return b.get("published") or ""

    books.sort(key=key, reverse=True)
    OUT.write_text(json.dumps({"author": args.author, "market": host,
                               "synced_at": __import__("datetime").datetime.now(
                                   __import__("datetime").timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                               "count": len(books), "books": books}, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"\nwrote {OUT.relative_to(ROOT)} with {len(books)} book(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
