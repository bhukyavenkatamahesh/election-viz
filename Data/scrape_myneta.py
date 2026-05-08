"""
MyNeta.info Candidate Affidavit Scraper
========================================
Scrapes candidate details (wealth, criminal cases, education)
from MyNeta.info for Lok Sabha elections.

Usage:
    python scrape_myneta.py --year 2019
    python scrape_myneta.py --year 2024

Output:
    candidates/candidates_YYYY.csv
"""

import argparse
import csv
import time
import re
import os
import html
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# MyNeta Lok Sabha election URLs
MYNETA_URLS = {
    2019: "https://myneta.info/LokSabha2019/",
    2024: "https://myneta.info/LokSabha2024/",
}

FALLBACK_CONSTITUENCY_ID_RANGES = {
    2024: range(1, 650),
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def parse_money(text):
    """Parse MyNeta money strings like 'Rs 36,14,41,689 ~ 36 Crore+' into integer."""
    if not text or text.strip() in ("", "Nil", "-", "0"):
        return 0
    # Take only the part before ~ or newline
    text = text.split("~")[0].split("\n")[0].strip()
    # Remove Rs, commas, spaces
    text = text.replace("Rs", "").replace(",", "").replace(" ", "").strip()
    # Try to parse as integer
    try:
        return int(text)
    except ValueError:
        return 0


def fetch_html(url):
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_tags(fragment):
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(text).strip()


def get_constituency_links(base_url):
    """Get all constituency page links from the main election page."""
    print(f"Fetching constituency list from {base_url}...")
    links = []
    page = fetch_html(base_url)
    for match in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', page, re.IGNORECASE | re.DOTALL):
        href = match.group(1)
        if "action=show_candidates" in href and "constituency_id" in href:
            full_url = urljoin(base_url, href)
            constituency_name = strip_tags(match.group(2))
            links.append((constituency_name, full_url))
    
    print(f"  Found {len(links)} constituencies")
    return links


def get_fallback_constituency_links(year, base_url):
    return [
        (
            f"constituency_id={constituency_id}",
            urljoin(base_url, f"index.php?action=show_candidates&constituency_id={constituency_id}")
        )
        for constituency_id in FALLBACK_CONSTITUENCY_ID_RANGES.get(year, [])
    ]


def scrape_constituency_candidates(url, constituency_name):
    """Scrape candidate details from a constituency page."""
    try:
        page = fetch_html(url)
    except (URLError, HTTPError, TimeoutError) as e:
        print(f"    WARNING: Failed to fetch {constituency_name}: {e}")
        return []

    heading_match = re.search(r"List of Candidates\s*-\s*(.*?)(?:\(|</)", page, re.IGNORECASE | re.DOTALL)
    if heading_match:
        heading = strip_tags(heading_match.group(1))
        if ":" in heading:
            constituency_name = heading.split(":", 1)[0].strip()
        elif heading:
            constituency_name = heading.strip()

    candidates = []

    tables = re.findall(r"<table\b.*?</table>", page, flags=re.IGNORECASE | re.DOTALL)
    candidate_tables = [
        table for table in tables
        if "Criminal Cases" in table and "Total Assets" in table and "Liabilities" in table
    ]
    table = candidate_tables[0] if candidate_tables else max(tables, key=len, default="")
    if not table:
        print(f"    WARNING: No table found for {constituency_name}")
        return []

    rows = re.findall(r"<tr\b.*?</tr>", table, flags=re.IGNORECASE | re.DOTALL)
    for row in rows[1:]:  # skip header row
        cols = [strip_tags(col) for col in re.findall(r"<td\b.*?>(.*?)</td>", row, flags=re.IGNORECASE | re.DOTALL)]
        if len(cols) < 7:
            continue
        
        # Columns: SNo, Candidate, Party, Criminal Cases, Education, Age, Total Assets, Liabilities
        candidate_text = cols[1] if len(cols) > 1 else ""
        # Remove "Winner" suffix if present
        candidate_text = candidate_text.replace("(Winner)", "").replace("Winner", "").strip()
        
        criminal_text = cols[3] if len(cols) > 3 else "0"
        try:
            criminal_cases = int(criminal_text)
        except ValueError:
            criminal_cases = 0
        
        age_text = cols[5] if len(cols) > 5 else ""
        try:
            age = int(age_text)
        except ValueError:
            age = 0
        
        assets_text = cols[6] if len(cols) > 6 else "0"
        liabilities_text = cols[7] if len(cols) > 7 else "0"
        
        candidate = {
            "Candidate": candidate_text,
            "Constituency": constituency_name,
            "Party": cols[2] if len(cols) > 2 else "",
            "Criminal_Cases": criminal_cases,
            "Education": cols[4] if len(cols) > 4 else "",
            "Age": age,
            "Total_Assets": parse_money(assets_text),
            "Total_Liabilities": parse_money(liabilities_text),
        }
        candidates.append(candidate)
    
    return candidates


def scrape_election(year):
    """Scrape all candidates for a given election year."""
    if year not in MYNETA_URLS:
        print(f"ERROR: Year {year} not supported. Supported years: {list(MYNETA_URLS.keys())}")
        return
    
    base_url = MYNETA_URLS[year]
    constituencies = get_constituency_links(base_url)

    if len(constituencies) < 100:
        print("  Direct constituency links look incomplete; scanning numeric constituency IDs...")
        constituencies = get_fallback_constituency_links(year, base_url)
    
    if not constituencies:
        print("ERROR: No constituencies found. The page structure may have changed.")
        return
    
    all_candidates = []
    for i, (name, url) in enumerate(constituencies):
        print(f"  [{i+1}/{len(constituencies)}] Scraping {name}...", end="")
        candidates = scrape_constituency_candidates(url, name)
        for c in candidates:
            c["Year"] = year
        all_candidates.extend(candidates)
        print(f" {len(candidates)} candidates")
        time.sleep(0.1)  # Be polite while keeping full-election scrapes practical.
    
    # Write CSV
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "candidates")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, f"candidates_{year}.csv")
    
    if all_candidates:
        fieldnames = ["Candidate", "Constituency", "Party", "Criminal_Cases",
                       "Education", "Age", "Total_Assets", "Total_Liabilities", "Year"]
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_candidates)
        
        print(f"\nSaved {len(all_candidates)} candidates to {output_file}")
    else:
        print("\nNo candidates scraped. Check the URLs and page structure.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape MyNeta candidate affidavit data")
    parser.add_argument("--year", type=int, required=True, choices=[2019, 2024],
                        help="Election year to scrape")
    args = parser.parse_args()
    scrape_election(args.year)
