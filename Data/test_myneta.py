"""Quick test: fetch a larger constituency to check full candidate table."""
import requests
from bs4 import BeautifulSoup

# Test with constituency_id=438 (AMALAPURAM) which should have more candidates
url = "https://www.myneta.info/LokSabha2019/index.php?action=show_candidates&constituency_id=438"
print(f"Fetching: {url}")
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
soup = BeautifulSoup(resp.text, "html.parser")

# Find the candidate table by looking for the one with correct headers
for i, table in enumerate(soup.find_all("table")):
    rows = table.find_all("tr")
    if len(rows) > 1:
        first_row = rows[0]
        header_text = first_row.get_text(strip=True)
        if "Criminal" in header_text or "Candidate" in header_text:
            print(f"\nFound candidate table (Table {i}): {len(rows)} rows")
            # Print header
            cells = first_row.find_all(["th", "td"])
            print(f"Header: {[c.get_text(strip=True) for c in cells]}")
            # Print first 3 data rows
            for j, row in enumerate(rows[1:4]):
                cells = row.find_all("td")
                print(f"Row {j+1}: {[c.get_text(strip=True)[:40] for c in cells]}")
            print(f"Total data rows: {len(rows) - 1}")
