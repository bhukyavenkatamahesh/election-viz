import csv
import json
import os
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))

def check_csv(path, label, delimiter=","):
    if not os.path.exists(path):
        print(f"  [MISSING] {label}: FILE NOT FOUND")
        return
    size = os.path.getsize(path)
    if size < 100:
        print(f"  [ERROR] {label}: File too small ({size} bytes)")
        return
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter=delimiter)
        header = next(reader)
        rows = sum(1 for _ in reader)
    print(f"  [OK] {label}: {rows} rows, {len(header)} cols, {size//1024}KB")
    print(f"       Columns: {', '.join(header[:8])}")

def check_geojson(path, label):
    if not os.path.exists(path):
        print(f"  [MISSING] {label}: FILE NOT FOUND")
        return
    size = os.path.getsize(path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    features = len(data.get("features", []))
    props = list(data["features"][0]["properties"].keys()) if features > 0 else []
    print(f"  [OK] {label}: {features} features, {size//1024}KB")
    print(f"       Properties: {', '.join(props)}")

print("=" * 60)
print("ELECTION DATA VERIFICATION")
print("=" * 60)

print("\nELECTION RESULTS (existing):")
check_csv(os.path.join(BASE, "india-election-data-master", "parliament-elections", "parliament.csv"), "parliament.csv (1951-2009)")

print("\nELECTION RESULTS (new downloads):")
check_csv(os.path.join(BASE, "results", "results_2014_candidate_wise.csv"), "2014 candidate-wise")
check_csv(os.path.join(BASE, "results", "results_2014_constituency_wise.csv"), "2014 constituency-wise")
check_csv(os.path.join(BASE, "results", "results_2019.csv"), "2019 results")
check_csv(os.path.join(BASE, "results", "results_2024.csv"), "2024 results", delimiter=";")

print("\nGEOGRAPHIC BOUNDARIES:")
check_geojson(os.path.join(BASE, "boundaries", "india_pc_2019_simplified.geojson"), "GeoJSON (543 PCs)")

print("\nCANDIDATE AFFIDAVITS (existing):")
check_csv(os.path.join(BASE, "india-election-data-master", "affidavits", "myneta.2004.csv"), "MyNeta 2004")
check_csv(os.path.join(BASE, "india-election-data-master", "affidavits", "myneta.2009.csv"), "MyNeta 2009")
check_csv(os.path.join(BASE, "india-election-data-master", "affidavits", "myneta.2014.csv"), "MyNeta 2014")

print("\nCANDIDATE AFFIDAVITS (needs scraping):")
for year in [2019, 2024]:
    p = os.path.join(BASE, "candidates", f"candidates_{year}.csv")
    if os.path.exists(p):
        check_csv(p, f"Candidates {year}")
    else:
        print(f"  [PENDING] {year}: Run -> python scrape_myneta.py --year {year}")

print("\n" + "=" * 60)
