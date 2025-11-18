#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv, os, sys

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
data = os.path.join(root, "data")
assets_src = os.path.join(data, "HCD2025_assets_full.csv")
sched_src  = os.path.join(data, "HCD2025_schedule_master.csv")
spk_src    = os.path.join(data, "HCD2025_speakers_master.csv")

assets_out = os.path.join(data, "assets_full.csv")
sched_out  = os.path.join(data, "schedule.csv")
spk_out    = os.path.join(data, "speakers_master.csv")

def read_any_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        txt = f.read().replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in txt.split("\n") if ln.strip() != ""]
    # 1行目が HCD2025_... の“見出し”ならスキップ
    if lines and lines[0].strip().startswith("HCD2025_"):
        lines = lines[1:]
    if not lines:
        return [], []
    # 区切り自動判定
    delim = "\t" if ("\t" in lines[0]) else ","
    rdr = csv.DictReader(lines, delimiter=delim)
    rows = list(rdr)
    return rows, [h.strip() for h in rdr.fieldnames or []]

def ensure_asset_url(s: str) -> str:
    s = (s or "").strip()
    if not s: return ""
    if s.startswith("http://") or s.startswith("https://"): return s
    if s.startswith("./assets/"): return s
    # 素のファイル名なら相対に
    return "./assets/" + s

def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})

# 1) assets_full.csv = [file_key, url]
assets_rows, assets_hdr = read_any_csv(assets_src)
norm_assets = []
for r in assets_rows:
    # 元ヘッダー候補: category,key_for_assets,file_name,alt,file_key,url,type,note
    file_key = r.get("file_key") or r.get("key_for_assets") or r.get("key") or r.get("name") or ""
    url      = r.get("url") or r.get("path") or r.get("src") or r.get("file_name") or ""
    if not url and r.get("file_name"):
        url = r["file_name"]
    url = ensure_asset_url(url)
    if file_key and url:
        norm_assets.append({"file_key": file_key, "url": url})
write_csv(assets_out, ["file_key","url"], norm_assets)

# 2) schedule.csv = [start, end, title, desc, location]
sched_rows, sched_hdr = read_any_csv(sched_src)
norm_sched = []
for r in sched_rows:
    # 元ヘッダー候補:
    # session_id, track, time_block, timetable1, timetable2,
    # session_title, speaker_name_keys1, speaker_name_keys2, tags, note, session_title_filled
    start = r.get("timetable1") or r.get("start") or ""
    end   = r.get("timetable2") or r.get("end") or ""
    title = r.get("session_title_filled") or r.get("session_title") or r.get("title") or ""
    desc  = r.get("tags") or r.get("note") or r.get("desc") or ""
    loc   = r.get("track") or r.get("location") or ""
    if any([start, end, title, desc, loc]):
        norm_sched.append({"start": start, "end": end, "title": title, "desc": desc, "location": loc})
write_csv(sched_out, ["start","end","title","desc","location"], norm_sched)

# 3) speakers_master.csv = [id, name, title, org, bio, photo_url]
spk_rows, spk_hdr = read_any_csv(spk_src)
norm_spk = []
for r in spk_rows:
    # 元ヘッダー候補:
    # order,is_keynote,session_id,name_jp,name_en,affiliation,title1..title5,bio_ja,session_title,track,timetable1,timetable2,photo_file,note
    id_   = r.get("order") or r.get("id") or ""
    name  = r.get("name_jp") or r.get("name") or r.get("speaker") or ""
    # 役職・肩書は title1 が最も“肩書”に相当することが多い。fallbackを用意
    title = r.get("title1") or r.get("title") or r.get("affiliation") or ""
    org   = r.get("affiliation") or r.get("org") or ""
    bio   = r.get("bio_ja") or r.get("bio") or ""
    photo = r.get("photo_url") or r.get("photo_file") or r.get("image") or ""
    photo = ensure_asset_url(photo)
    if any([id_, name, title, org, bio, photo]):
        norm_spk.append({
            "id": id_, "name": name, "title": title, "org": org, "bio": bio, "photo_url": photo
        })
write_csv(spk_out, ["id","name","title","org","bio","photo_url"], norm_spk)

print("OK: normalized ->")
print(" -", assets_out)
print(" -", sched_out)
print(" -", spk_out)
