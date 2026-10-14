# Section 1, chart 1: camera types by decade (Science Museum Group)
#
# Input : data/science_museum_cameras.csv   (7,204 objects whose type contains "camera")
# Output: data/s1_camera_types.csv          (one row per camera: type + year made)
#
# What this script does, so it can be described in the "What" part of the report:
#   1. Takes the first object type listed for each object (e.g. "box camera; rollfilm camera" -> "box camera").
#   2. Groups synonyms into 14 plain-English camera types (e.g. "8mm cine camera" -> "Movie (cine)").
#   3. Drops objects that are not photographic cameras (TV cameras, camera tubes, camera lucida,
#      X-ray cameras, parts) and objects listed only as "camera" with no type.
#   4. Keeps objects with a year made between 1840 and 2019.
# No values are changed; rows are only filtered and labelled.
#
# Run from the repo folder:  python tools/clean_s1_camera_types.py

import pandas as pd

GROUPS = {
    "Plate & field": ["plate camera", "field camera", "detective camera"],
    "Stereo": ["stereo camera"],
    "Folding": ["folding camera", "folding bellows camera"],
    "Box": ["box camera"],
    "Roll film": ["rollfilm camera"],
    "Movie (cine)": ["cine camera", "cinecamera", "8mm cine camera", "9.5mm cine camera",
                     "16mm cine camera", "35mm cine camera", "35 mm ciné camera"],
    "Reflex": ["reflex camera"],
    "Miniature": ["miniature camera", "sub miniature camera", "subminiature camera"],
    "35mm": ["35mm camera", "35 mm camera"],
    "Instant": ["instant film camera", "instant camera"],
    "Pocket & cartridge": ["pocket camera", "cartridge camera", "instamatic camera"],
    "Compact": ["compact camera"],
    "Disposable": ["disposable camera"],
    "Digital": ["digital camera"],
}
LOOKUP = {raw: group for group, raws in GROUPS.items() for raw in raws}

df = pd.read_csv("data/science_museum_cameras.csv")
first_type = df["object_name"].str.split(";").str[0].str.strip().str.lower()
df["camera_type"] = first_type.map(LOOKUP)

out = df[df["camera_type"].notna() & df["year_made"].between(1840, 2019)]
out = out[["uid", "camera_type", "year_made"]].copy()
out["year_made"] = out["year_made"].astype(int)
out.to_csv("data/s1_camera_types.csv", index=False)

print(f"Kept {len(out):,} of {len(df):,} objects")
print(out.groupby("camera_type")["year_made"].agg(["count", "median"]).sort_values("median"))
