# Downloads the Science Museum Group "Object records, all" CSV (~136 MB),
# keeps only the cameras, and saves a small file: science_museum_cameras.csv
#
# How to run (no installation, and nothing big to upload):
#   1. Go to https://colab.research.google.com and click "New notebook".
#   2. Paste this whole file into the first cell and press the Play button.
#      Colab downloads the big file itself, so it never touches your computer.
#   3. When it finishes, click the folder icon on the left, download
#      science_museum_cameras.csv and put it in your project's data/ folder.
#
# Licence: CC0 for title/made/maker fields; CC BY 4.0 for descriptions.
# Credit: (c) The Board of Trustees of the Science Museum
# Source: https://coimages.sciencemuseumgroup.org.uk/datasets/index.html

import re
import pandas as pd

URL = "https://coimages.sciencemuseumgroup.org.uk/datasets/smg_object_records_all_09_04_2025.csv"

print("Downloading (this can take a minute or two)...")
df = pd.read_csv(URL, dtype=str, low_memory=False)
df.columns = [c.strip().lower() for c in df.columns]
print(f"Loaded {len(df):,} records. Columns: {list(df.columns)}")

# Keep objects whose type is a camera, but not camera parts or accessories
name = df["object_name"].fillna("").str.lower()
is_camera = name.str.contains("camera")
not_part = ~name.str.contains(
    r"lens|case|part|shutter|tripod|flash|accessor|stand|manual|box for|cover|mount|filter|viewfinder"
)
cams = df[is_camera & not_part].copy()


def first_year(text):
    """Pull the first 4-digit year out of text like 'circa 1925-1930'."""
    match = re.search(r"(1[789]\d\d|20\d\d)", str(text))
    return int(match.group(1)) if match else None


cams["year_made"] = cams["date"].map(first_year)
cams["url"] = "https://collection.sciencemuseumgroup.org.uk/objects/" + cams["uid"].astype(str)

keep = ["uid", "title", "object_name", "category", "maker", "place", "date", "year_made", "url"]
cams = cams[[c for c in keep if c in cams.columns]]
cams = cams.rename(columns={"place": "place_made", "date": "date_made"})

cams.to_csv("science_museum_cameras.csv", index=False)

print(f"\nDone: saved {len(cams):,} cameras to science_museum_cameras.csv")
print(f"With a year: {cams['year_made'].notna().sum():,}   With a place: {cams['place_made'].notna().sum():,}")
print("\nMost common camera types:")
print(cams["object_name"].value_counts().head(15).to_string())
