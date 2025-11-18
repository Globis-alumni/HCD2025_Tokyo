#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv, os, re, io

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
data = os.path.join(root, "data")
assets_dir = os.path.join(root, "assets")

assets_src = os.path.join(data, "HCD2025_assets_full.csv")
sched_src  = os.path.join(data, "HCD2025_schedule_master.csv")
spk_src    = os.path.join(data, "HCD2025_speakers_master.csv")

assets_out = os.path.join(data, "assets_full.csv")
sched_out  = os.path.join(data, "schedule.csv")
spk_out    = os.path.join(data, "speakers_master.csv")

def load_text(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return f.read().replace("\r\n", "\n").replace("\r", "\n")

def strip_first_label_line(text):
    lines = [ln for ln in text.split("\n") if ln.strip() != ""]
    if lines and lines[0].strip().startswith("HCD2025_"):
        lines = lines[1:]
    return "\n".join(lines)

def sniff_delim(sample_line):
    return "\t" if ("\t" in sample_line) else ","

def parse_table_text(text):
    """csv.Sniffer を使わず、検出した delim で csv.reader する（クォート対応）"""
    lines = [ln for ln in text.split("\n") if ln.strip()!=""]
    if not lines: return [], []
    delim = sniff_delim(lines[0])
    rdr = csv.reader(io.StringIO("\n".join(lines)), delimiter=delim)
    rows = list(rdr)
    if not rows: return [], []
    header = [h.strip() for h in rows[0]]
    data_rows = rows[1:]
    return header, data_rows, delim

def rows_to_dicts(header, data_rows):
    out = []
    for r in data_rows:
        rec = {}
        for i, h in enumerate(header):
            rec[h] = (r[i].strip() if i < len(r) else "")
        # ヘッダー複写行だけスキップ（完全一致のみ）
        if [rec.get(h,"") for h in header] == header:
            continue
        out.append(rec)
    return out

def ensure_asset_url(s: str) -> str:
    s = (s or "").strip()
    if not s: return ""
    if s.startswith(("http://","https://","./assets/")): return s
    return "./assets/" + s

def list_assets():
    try:
        return [f for f in os.listdir(assets_dir) if os.path.isfile(os.path.join(assets_dir, f))]
    except Exception:
        return []

ASSET_FILES = list_assets()

def resolve_asset_candidate(value: str) -> str:
    val = (value or "").strip()
    if not val: return ""
    base = val[len("./assets/"):] if val.startswith("./assets/") else val
    special = {"hero":"hero_main","logo":"logo_hcd_2025"}
    base_try = [special.get(base, base), base]
    if base in ASSET_FILES:
        return "./assets/" + base
    for b in base_try:
        for f in ASSET_FILES:
            if f.startswith(b):
                return "./assets/" + f
    for ext in (".jpg",".png",".jpeg",".webp"):
        cand = base + ext
        if cand in ASSET_FILES:
            return "./assets/" + cand
    return "./assets/" + base

def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})

# ---------- assets ----------
txt = strip_first_label_line(load_text(assets_src))
hdr, data_rows, _ = parse_table_text(txt)
rows = rows_to_dicts(hdr, data_rows)

norm_assets = []
for r in rows:
    file_key = (r.get("file_key") or r.get("key_for_assets") or r.get("key") or r.get("name") or r.get("category") or "").strip()
    raw_url  = (r.get("url") or r.get("path") or r.get("src") or r.get("file_name") or "").strip()
    if file_key in ("file_key","key_for_assets","category") and raw_url in ("url","file_name","key_for_assets"):
        continue
    url = ensure_asset_url(raw_url)
    if url.startswith("./assets/") and not re.search(r"\.(png|jpe?g|webp|gif|svg|gif)$", url, re.I):
        url = resolve_asset_candidate(url)
    if file_key and url:
        norm_assets.append({"file_key": file_key, "url": url})

# ---------- schedule ----------
txt = strip_first_label_line(load_text(sched_src))
hdr, data_rows, delim = parse_table_text(txt)
rows = rows_to_dicts(hdr, data_rows)

norm_sched = []
for r in rows:
    start = (r.get("timetable1") or r.get("start") or "").strip()
    end   = (r.get("timetable2") or r.get("end") or "").strip()
    title = (r.get("session_title_filled") or r.get("session_title") or r.get("title") or "").strip()
    desc  = (r.get("tags") or r.get("note") or r.get("desc") or "").strip()
    loc   = (r.get("track") or r.get("location") or "").strip()
    if any([start, end, title, desc, loc]):
        norm_sched.append({"start": start, "end": end, "title": title, "desc": desc, "location": loc})

# ---------- speakers ----------
txt = strip_first_label_line(load_text(spk_src))
hdr, data_rows, delim = parse_table_text(txt)
rows = rows_to_dicts(hdr, data_rows)

norm_spk = []
for r in rows:
    id_   = (r.get("order") or r.get("id") or "").strip()
    name  = (r.get("name_jp") or r.get("name") or r.get("speaker") or "").strip()
    title = (r.get("title1") or r.get("title") or r.get("affiliation") or "").strip()
    org   = (r.get("affiliation") or r.get("org") or "").strip()
    bio   = (r.get("bio_ja") or r.get("bio") or "").strip()
    photo = (r.get("photo_url") or r.get("photo_file") or r.get("image") or "").strip()
    if photo and not photo.startswith(("http://","https://","./assets/")):
        photo = "./assets/" + photo
    if photo.startswith("./assets/") and not re.search(r"\.(png|jpe?g|webp|gif|svg)$", photo, re.I):
        photo = resolve_asset_candidate(photo)
    if any([id_, name, title, org, bio, photo]):
        norm_spk.append({"id": id_, "name": name, "title": title, "org": org, "bio": bio, "photo_url": photo})

# ---------- write ----------
write_csv(assets_out, ["file_key","url"], norm_assets)
write_csv(sched_out,  ["start","end","title","desc","location"], norm_sched)
write_csv(spk_out,    ["id","name","title","org","bio","photo_url"], norm_spk)

print("OK: normalized(v5b)")
print(" assets:", len(norm_assets), "rows")
print(" schedule:", len(norm_sched), "rows")
print(" speakers:", len(norm_spk), "rows")
