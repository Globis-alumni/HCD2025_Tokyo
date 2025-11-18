#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv, os

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
data = os.path.join(root, "data")
assets_src = os.path.join(data, "HCD2025_assets_full.csv")
sched_src  = os.path.join(data, "HCD2025_schedule_master.csv")
spk_src    = os.path.join(data, "HCD2025_speakers_master.csv")

assets_out = os.path.join(data, "assets_full.csv")
sched_out  = os.path.join(data, "schedule.csv")
spk_out    = os.path.join(data, "speakers_master.csv")

def load_lines(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        txt = f.read().replace("\r\n", "\n").replace("\r", "\n")
    # 先頭の“HCD2025_...”行は見出しなので捨てる
    lines = [ln for ln in txt.split("\n") if ln.strip() != ""]
    if lines and lines[0].strip().startswith("HCD2025_"):
        lines = lines[1:]
    return lines

def detect_header_idx(lines, must_keys):
    """
    行のうち、must_keysのうち最低1つ（または複数）が“列名として”含まれている行をヘッダー候補とみなす。
    最も条件に合う（ヒット数が多い）行をヘッダーとする。
    """
    best_idx, best_hits, best_delim = None, -1, ","
    for i, ln in enumerate(lines[:10]):  # 上位10行で十分
        for delim in ("\t", ","):
            cols = [c.strip() for c in ln.split(delim)]
            hit = sum(1 for k in must_keys if k in cols)
            if hit > best_hits:
                best_idx, best_hits, best_delim = i, hit, delim
    return best_idx, best_delim

def parse_table(lines, header_idx, delim):
    header = [c.strip() for c in lines[header_idx].split(delim)]
    rows = []
    for ln in lines[header_idx+1:]:
        parts = [c.strip() for c in ln.split(delim)]
        # 別表のヘッダーが途中に混じっていたらスキップ
        if set(parts) & set(header) == set(header):
            continue
        rec = {}
        for i, h in enumerate(header):
            rec[h] = parts[i] if i < len(parts) else ""
        rows.append(rec)
    return header, rows

def ensure_asset_url(s: str) -> str:
    s = (s or "").strip()
    if not s: return ""
    if s.startswith(("http://","https://","./assets/")): return s
    return "./assets/" + s

def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})

# 1) assets_full → [file_key,url]
lines = load_lines(assets_src)
idx, delim = detect_header_idx(lines, must_keys=["file_key","url","key_for_assets","file_name"])
hdr, rows = parse_table(lines, idx, delim)
norm_assets = []
for r in rows:
    file_key = r.get("file_key") or r.get("key_for_assets") or r.get("key") or r.get("name") or r.get("category") or ""
    url      = r.get("url") or r.get("path") or r.get("src") or r.get("file_name") or ""
    if file_key in ("file_key","key_for_assets","category") and url in ("url","file_name","key_for_assets"):
        continue  # 明らかなヘッダー混入
    url = ensure_asset_url(url)
    if file_key and url:
        norm_assets.append({"file_key": file_key, "url": url})
write_csv(assets_out, ["file_key","url"], norm_assets)

# 2) schedule → [start,end,title,desc,location]
lines = load_lines(sched_src)
idx, delim = detect_header_idx(lines, must_keys=["timetable1","timetable2","session_title","session_title_filled","track","tags"])
hdr, rows = parse_table(lines, idx, delim)
norm_sched = []
for r in rows:
    start = r.get("timetable1") or r.get("start") or ""
    end   = r.get("timetable2") or r.get("end") or ""
    title = r.get("session_title_filled") or r.get("session_title") or r.get("title") or ""
    desc  = r.get("tags") or r.get("note") or r.get("desc") or ""
    loc   = r.get("track") or r.get("location") or ""
    if start == "timetable1" and end == "timetable2": continue
    if title in ("session_title","session_title_filled"): continue
    if any([start,end,title,desc,loc]):
        norm_sched.append({"start": start, "end": end, "title": title, "desc": desc, "location": loc})
write_csv(sched_out, ["start","end","title","desc","location"], norm_sched)

# 3) speakers_master → [id,name,title,org,bio,photo_url]
lines = load_lines(spk_src)
idx, delim = detect_header_idx(lines, must_keys=["order","name_jp","affiliation","title1","bio_ja","photo_file"])
hdr, rows = parse_table(lines, idx, delim)
norm_spk = []
for r in rows:
    id_   = r.get("order") or r.get("id") or ""
    name  = r.get("name_jp") or r.get("name") or r.get("speaker") or ""
    title = r.get("title1") or r.get("title") or r.get("affiliation") or ""
    org   = r.get("affiliation") or r.get("org") or ""
    bio   = r.get("bio_ja") or r.get("bio") or ""
    photo = r.get("photo_url") or r.get("photo_file") or r.get("image") or ""
    photo = ensure_asset_url(photo)
    # 明らかなヘッダー混入をスキップ
    if name in ("name_jp","name","speaker") and photo in ("photo_file","photo_url","image"):
        continue
    if any([id_, name, title, org, bio, photo]):
        norm_spk.append({"id": id_, "name": name, "title": title, "org": org, "bio": bio, "photo_url": photo})
write_csv(spk_out, ["id","name","title","org","bio","photo_url"], norm_spk)

print("OK: normalized(v3) ->",
      "\n -", assets_out, len(norm_assets), "rows",
      "\n -", sched_out,  len(norm_sched),  "rows",
      "\n -", spk_out,    len(norm_spk),    "rows")
