#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv, os, re

root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
data = os.path.join(root, "data")
assets_dir = os.path.join(root, "assets")

assets_src = os.path.join(data, "HCD2025_assets_full.csv")
sched_src  = os.path.join(data, "HCD2025_schedule_master.csv")
spk_src    = os.path.join(data, "HCD2025_speakers_master.csv")

assets_out = os.path.join(data, "assets_full.csv")
sched_out  = os.path.join(data, "schedule.csv")
spk_out    = os.path.join(data, "speakers_master.csv")

# ---------- utils ----------
def load_lines(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        txt = f.read().replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in txt.split("\n") if ln.strip() != ""]
    if lines and lines[0].strip().startswith("HCD2025_"):
        lines = lines[1:]
    return lines

def detect_header_idx(lines, must_keys):
    best_idx, best_hits, best_delim = None, -1, ","
    # ヘッダーは上位20行くらいまでにある想定
    for i, ln in enumerate(lines[:20]):
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
        # 別表のヘッダーが途中に混じったらスキップ
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

def list_assets():
    try:
        return [f for f in os.listdir(assets_dir) if os.path.isfile(os.path.join(assets_dir, f))]
    except Exception:
        return []

ASSET_FILES = list_assets()

def resolve_asset_candidate(value: str) -> str:
    """
    URL が './assets/hero' のように拡張子なしのときに、assets/配下から最適候補を推定。
    1) 完全一致
    2) 始まり一致（'hero' → 'hero_main_v1.jpg' など）
    3) 特別ルール: 'hero'→hero_main_v1.*, 'logo'→logo_hcd_2025.*
    """
    val = (value or "").strip()
    if not val:
        return ""
    # 既に ./assets/ で始まるなら取り出し
    if val.startswith("./assets/"):
        base = val[len("./assets/"):]
    else:
        base = val

    # 特別ルール
    special = {
        "hero": "hero_main",
        "logo": "logo_hcd_2025",
    }
    base_try = [base]
    for k, v in special.items():
        if base == k:
            base_try.insert(0, v)

    # 完全一致
    if base in ASSET_FILES:
        return "./assets/" + base

    # 始まり一致（優先候補）
    for b in base_try:
        for f in ASSET_FILES:
            if f.startswith(b):
                return "./assets/" + f

    # 拡張子推定（jpg/png/jpeg）
    for ext in (".jpg", ".png", ".jpeg", ".webp"):
        cand = base + ext
        if cand in ASSET_FILES:
            return "./assets/" + cand

    # 見つからない場合はそのまま返す
    return "./assets/" + base

# ---------- 1) assets_full ----------
lines = load_lines(assets_src)
idx, delim = detect_header_idx(lines, must_keys=["file_key","url","key_for_assets","file_name"])
_, rows = parse_table(lines, idx, delim)

norm_assets = []
for r in rows:
    file_key = (r.get("file_key") or r.get("key_for_assets") or r.get("key") or r.get("name") or r.get("category") or "").strip()
    raw_url  = (r.get("url") or r.get("path") or r.get("src") or r.get("file_name") or "").strip()
    # ヘッダー混入排除
    if file_key in ("file_key","key_for_assets","category") and raw_url in ("url","file_name","key_for_assets"):
        continue
    url = ensure_asset_url(raw_url)
    # 拡張子が無ければ推定補完
    if url.startswith("./assets/") and not re.search(r"\.(png|jpe?g|webp|gif|svg)$", url, re.I):
        url = resolve_asset_candidate(url)
    if file_key and url:
        norm_assets.append({"file_key": file_key, "url": url})

# ---------- 2) schedule ----------
lines = load_lines(sched_src)
idx, delim = detect_header_idx(lines, must_keys=["timetable1","timetable2","session_title","session_title_filled","track","tags","note"])
_, rows = parse_table(lines, idx, delim)

norm_sched = []
for r in rows:
    start = (r.get("timetable1") or r.get("start") or "").strip()
    end   = (r.get("timetable2") or r.get("end") or "").strip()
    title = (r.get("session_title_filled") or r.get("session_title") or r.get("title") or "").strip()
    desc  = (r.get("tags") or r.get("note") or r.get("desc") or "").strip()
    loc   = (r.get("track") or r.get("location") or "").strip()
    if start == "timetable1" and end == "timetable2": 
        continue
    if title in ("session_title","session_title_filled"): 
        continue
    if any([start,end,title,desc,loc]):
        norm_sched.append({"start": start, "end": end, "title": title, "desc": desc, "location": loc})

# ---------- 3) speakers_master ----------
lines = load_lines(spk_src)
idx, delim = detect_header_idx(lines, must_keys=["order","name_jp","affiliation","title1","bio_ja","photo_file"])
_, rows = parse_table(lines, idx, delim)

norm_spk = []
for r in rows:
    id_   = (r.get("order") or r.get("id") or "").strip()
    name  = (r.get("name_jp") or r.get("name") or r.get("speaker") or "").strip()
    title = (r.get("title1") or r.get("title") or r.get("affiliation") or "").strip()
    org   = (r.get("affiliation") or r.get("org") or "").strip()
    bio   = (r.get("bio_ja") or r.get("bio") or "").strip()
    photo = (r.get("photo_url") or r.get("photo_file") or r.get("image") or "").strip()
    if name in ("name_jp","name","speaker") and photo in ("photo_file","photo_url","image"):
        continue
    if photo and not photo.startswith(("http://","https://","./assets/")):
        photo = "./assets/" + photo
    if photo.startswith("./assets/") and not re.search(r"\.(png|jpe?g|webp|gif|svg)$", photo, re.I):
        photo = resolve_asset_candidate(photo)
    if any([id_, name, title, org, bio, photo]):
        norm_spk.append({"id": id_, "name": name, "title": title, "org": org, "bio": bio, "photo_url": photo})

# ---------- write ----------
def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in header})

write_csv(assets_out, ["file_key","url"], norm_assets)
write_csv(sched_out,  ["start","end","title","desc","location"], norm_sched)
write_csv(spk_out,    ["id","name","title","org","bio","photo_url"], norm_spk)

print("OK: normalized(v5)")
print(" assets:", len(norm_assets), "rows")
print(" schedule:", len(norm_sched), "rows")
print(" speakers:", len(norm_spk), "rows")
