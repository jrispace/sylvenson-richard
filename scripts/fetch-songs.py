#!/usr/bin/env python3
"""Sync the Songs section — discovers every release by the configured artists.

Source: the public iTunes/Apple Music search API (no key, no auth).
Output: songs.json + songs/<trackId>.jpg artwork, consumed by index.html at runtime.

Artist IDs are stable per Apple Music artist page; the name search is a safety net for
releases distributed under a new artist profile.

Usage:  python3 scripts/fetch-songs.py

JRiSpace | Sylvenson Richard
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SONGS_DIR = ROOT / "songs"
OUT = ROOT / "songs.json"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")

# Apple Music artist profiles that carry Sylvenson Richard's music
ARTIST_IDS = [
    "1450464033",   # Richaerly (Christian)
    "1332065881",   # Sylvenson Richard (Richaerly) (Gospel)
    "1737295384",   # Sylvenson Richard
    "1332065888",   # Sylvenson Richard
]
NAME_TERMS = ["Richaerly", "Sylvenson Richard"]
COUNTRY = "US"


def api(params: dict) -> dict:
    url = "https://itunes.apple.com/" + params.pop("_path") + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-s", "-m", "30", "-A", UA, url], capture_output=True, text=True, errors="ignore")
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"resultCount": 0, "results": []}


def lookup_artist(artist_id: str) -> list[dict]:
    d = api({"_path": "lookup", "id": artist_id, "entity": "song", "limit": 200, "country": COUNTRY})
    return [r for r in d.get("results", []) if r.get("wrapperType") == "track"]


def search_name(term: str) -> list[dict]:
    d = api({"_path": "search", "term": term, "entity": "song", "limit": 200, "country": COUNTRY})
    out = []
    keys = [w.lower() for w in term.split()]
    for r in d.get("results", []):
        artist = (r.get("artistName") or "").lower()
        if any(k in artist for k in keys if len(k) > 2):
            out.append(r)
    return out


def shrink(src: pathlib.Path, dest: pathlib.Path, max_px: int) -> None:
    """sips on macOS, Pillow elsewhere, plain copy as the last resort."""
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


def save_art(track: dict) -> str | None:
    art = track.get("artworkUrl100")
    if not art:
        return None
    big = art.replace("100x100bb", "1000x1000bb").replace("100x100", "1000x1000")
    SONGS_DIR.mkdir(exist_ok=True)
    dest = SONGS_DIR / f"{track['trackId']}.jpg"
    tmp = SONGS_DIR / f"{track['trackId']}.raw"
    subprocess.run(["curl", "-s", "-m", "45", "-A", UA, big, "-o", str(tmp)], capture_output=True)
    if not tmp.exists() or tmp.stat().st_size < 3000:
        tmp.unlink(missing_ok=True)
        return None
    shrink(tmp, dest, 600)
    tmp.unlink(missing_ok=True)
    return f"songs/{dest.name}" if dest.exists() else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default=COUNTRY)
    args = ap.parse_args()

    seen: dict[str, dict] = {}
    for aid in ARTIST_IDS:
        tracks = lookup_artist(aid)
        print(f"artist {aid}: {len(tracks)} track(s)")
        for t in tracks:
            seen.setdefault(str(t["trackId"]), t)

    for term in NAME_TERMS:
        tracks = search_name(term)
        print(f'search "{term}": {len(tracks)} track(s)')
        for t in tracks:
            seen.setdefault(str(t["trackId"]), t)

    if not seen:
        print("no tracks found; leaving songs.json untouched")
        return 1

    songs = []
    for t in seen.values():
        songs.append({
            "id": str(t["trackId"]),
            "title": t.get("trackName"),
            "album": t.get("collectionName"),
            "artist": t.get("artistName"),
            "genre": t.get("primaryGenreName"),
            "released": (t.get("releaseDate") or "")[:10],
            "duration_ms": t.get("trackTimeMillis"),
            "art": None,
            "preview": t.get("previewUrl"),
            "url": t.get("trackViewUrl") or t.get("collectionViewUrl"),
        })

    songs.sort(key=lambda s: s["released"], reverse=True)

    print(f"\nfetching artwork for {len(songs)} track(s)")
    for s in songs:
        existing = SONGS_DIR / f"{s['id']}.jpg"
        s["art"] = f"songs/{existing.name}" if existing.exists() else save_art(seen[s["id"]])

    import datetime
    OUT.write_text(json.dumps({
        "artists": ARTIST_IDS,
        "synced_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "count": len(songs),
        "songs": songs,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"wrote {OUT.relative_to(ROOT)} with {len(songs)} song(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
