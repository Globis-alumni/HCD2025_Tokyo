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

def load_dicts(path):
    # 先頭の "HCD2025_..." 1行は見出しなので捨てる
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        txt = f.read().replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in txt.split("\n") if ln.strip() != ""]
    if lines and lines[0].strip().startswith("HCD2025_"):
        lines = lines[1:]
    if not lines: return []
    delim = "\t" if ("\t" in lines[0]) else ","
    rdr = csv.DictReader(lines, delimiter=delim)
    return list(rdr)

def ensure_asset_url(s):
    s = (s or "").strip()
    if not s: return ""
    if s.startswith(("http://","https://","./assets/")):
        return s
    return "./assets/" + s

# 1) assets_full: file_key,url を厳密抽出
assets_rows = load_dicts(assets_src)
norm_assets = []
for r in assets_rows:
    # 想定ヘッダー: category,key_for_assets,file_name,alt,file_key,url,type,note
    raw_key = (r.get("file_key") or r.get("key_for_assets") or "").strip()
    raw_url = (r.get("url") or r.get("file_name") or "").strip()
    # ヘッダー混入の典型ケース排除
    if raw_key in ("file_key","key_for_assets","category") or raw_url in ("url","file_name","key_for_assets"):
        continue
    if not raw_url and r.get("file_name"):
        raw_url = r["file_name"].strip()
    url = ensure_asset_url(raw_url)
    if raw_key and url:
        norm_assets.append({"file_key": raw_key, "url": url})

# 2) schedule: start,end,title,desc,location を厳密抽出
sched_rows = load_dicts(sched_src)
norm_sched = []
for r in sched_rows:
    # 想定ヘッダー:
    # session_id,track,time_block,timetable1,timetable2,session_title, ... , tags, note, session_title_filled
    start = (r.get("timetable1") or r.get("start") or "").strip()
    end   = (r.get("timetable2") or r.get("end") or "").strip()
    title = (r.get("session_title_filled") or r.get("session_title") or r.get("title") or "").strip()
    desc  = (r.get("tags") or r.get("note") or r.get("desc") or "").strip()
    loc   = (r.get("track") or r.get("location") or "").strip()
    # ヘッダー混入排除
    if start == "timetable1" and end == "timetable2": 
        continue
    if title in ("session_title","session_title_filled"): 
        continue
    if any([start, end, title, desc, loc]):
        norm_sched.append({"start": start, "end": end, "title": title, "desc": desc, "location": loc})

# 3) speakers_master: id,name,title,org,bio,photo_url を厳密抽出
spk_rows = load_dicts(spk_src)
norm_spk = []
for r in spk_rows:
    # 想定ヘッダー:
    # order,is_keynote,session_id,name_jp,name_en,affiliation,title1..,bio_ja,session_title,track,timetable1,timetable2,photo_file,note
    id_   = (r.get("order") or r.get("id") or "").strip()
    name  = (r.get("name_jp") or r.get("name") or r.get("speaker") or "").strip()
    title = (r.get("title1") or r.get("title") or r.get("affiliation") or "").strip()
    org   = (r.get("affiliation") or r.get("org") or "").strip()
    bio   = (r.get("bio_ja") or r.get("bio") or "").strip()
    photo = (r.get("photo_url") or r.get("photo_file") or r.get("image") or "").strip()
    # ヘッダー混入排除
    if name in ("name_jp","name","speaker") or photo in ("photo_file","photo_url","image"):
        continue
    photo = ensure_asset_url(photo)
    if any([id_, name, title, org, bio, photo]):
        norm_spk.append({"id": id_, "name": name, "title": title, "org": org, "bio": bio, "photo_url": photo})

def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})

write_csv(assets_out, ["file_key","url"], norm_assets)
write_csv(sched_out,  ["start","end","title","desc","location"], norm_sched)
write_csv(spk_out,    ["id","name","title","org","bio","photo_url"], norm_spk)

print("OK: normalized(v4)")
print(" assets:", len(norm_assets), "rows")
print(" schedule:", len(norm_sched), "rows")
print(" speakers:", len(norm_spk), "rows")
