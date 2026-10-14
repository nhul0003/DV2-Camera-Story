# Downloads camera records from the Museums Victoria Collections API
# and saves them as a small CSV: museums_victoria_cameras.csv
#
# How to run (no installation needed):
#   1. Go to https://colab.research.google.com and click "New notebook".
#   2. Paste this whole file into the first cell and press the Play button.
#   3. When it finishes, click the folder icon on the left, then download
#      museums_victoria_cameras.csv and put it in your project's data/ folder.
#
# The API needs no key. Data licence: CC0 for data fields, CC BY 4.0 for text.
# Source: https://collections.museumsvictoria.com.au/developers

import csv
import re
import time
import requests

API = "https://collections.museumsvictoria.com.au/api/search"
PER_PAGE = 100


def first_year(text):
    """Pull the first 4-digit year out of text like 'circa 1962-1967'."""
    match = re.search(r"(1[89]\d\d|20\d\d)", text or "")
    return int(match.group(1)) if match else None


def is_camera(item):
    """Keep objects that are cameras (not photos OF cameras, or adverts)."""
    name = (item.get("objectName") or "").lower()
    return "camera" in name


rows = []
page = 1
while True:
    params = {"query": "camera", "recordtype": "item", "perpage": PER_PAGE, "page": page}
    response = requests.get(API, params=params, timeout=60)
    response.raise_for_status()
    items = response.json()
    if not items:
        break

    for item in items:
        if not is_camera(item):
            continue

        # Who made it, where and when, is stored in "associations"
        maker = place = country = date_text = ""
        for assoc in item.get("associations") or []:
            if "manufactur" in (assoc.get("type") or "").lower() or "maker" in (assoc.get("type") or "").lower():
                maker = assoc.get("name") or ""
                place = ", ".join(p for p in [assoc.get("locality"), assoc.get("region"), assoc.get("state")] if p)
                country = assoc.get("country") or ""
                date_text = assoc.get("date") or ""
                break

        collections = "; ".join(item.get("collectionNames") or [])
        rows.append({
            "id": item.get("id"),
            "title": item.get("displayTitle"),
            "object_name": item.get("objectName"),
            "maker": maker,
            "place_made": place,
            "country_made": country,
            "date_made": date_text,
            "year_made": first_year(date_text),
            "kodak_heritage_collection": "Yes" if "Kodak" in collections else "No",
            "collections": collections,
            "url": "https://collections.museumsvictoria.com.au/" + str(item.get("id")),
        })

    print(f"Page {page}: {len(rows)} cameras so far")
    page += 1
    time.sleep(0.5)  # be polite to the museum's server

with open("museums_victoria_cameras.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Done: saved {len(rows)} cameras to museums_victoria_cameras.csv")
