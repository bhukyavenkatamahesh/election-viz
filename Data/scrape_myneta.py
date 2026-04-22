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
import requests
from bs4 import BeautifulSoup

# MyNeta Lok Sabha election URLs (use www subdomain)
MYNETA_URLS = {
    2019: "https://www.myneta.info/LokSabha2019/",
    2024: "https://www.myneta.info/LokSabha2024/",
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


def get_constituency_links(base_url):
    """Get all constituency page links from the main election page."""
    print(f"Fetching constituency list from {base_url}...")
    resp = requests.get(base_url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "action=show_candidates" in href and "constituency_id" in href:
            # Make sure URL uses www subdomain
            if href.startswith("http"):
                full_url = href
            else:
                full_url = base_url.rstrip("/") + "/" + href.lstrip("/")
            # Ensure www
            full_url = full_url.replace("://myneta.info", "://www.myneta.info")
            constituency_name = a.get_text(strip=True)
            links.append((constituency_name, full_url))
    
    print(f"  Found {len(links)} constituencies")
    return links


def scrape_constituency_candidates(url, constituency_name):
    """Scrape candidate details from a constituency page."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"    WARNING: Failed to fetch {constituency_name}: {e}")
        return []
    
    soup = BeautifulSoup(resp.text, "html.parser")
    candidates = []
    
    # MyNeta uses div.w3-responsive > table
    responsive_div = soup.find("div", {"class": "w3-responsive"})
    if responsive_div:
        table = responsive_div.find("table")
    else:
        # Fallback: find any table
        table = soup.find("table")
    
    if not table:
        print(f"    WARNING: No table found for {constituency_name}")
        return []
    
    rows = table.find_all("tr")
    for row in rows[1:]:  # skip header row
        cols = row.find_all("td")
        if len(cols) < 7:
            continue
        
        # Columns: SNo, Candidate, Party, Criminal Cases, Education, Age, Total Assets, Liabilities
        candidate_text = cols[1].get_text(strip=True) if len(cols) > 1 else ""
        # Remove "Winner" suffix if present
        candidate_text = candidate_text.replace("(Winner)", "").replace("Winner", "").strip()
        
        criminal_text = cols[3].get_text(strip=True) if len(cols) > 3 else "0"
        try:
            criminal_cases = int(criminal_text)
        except ValueError:
            criminal_cases = 0
        
        age_text = cols[5].get_text(strip=True) if len(cols) > 5 else ""
        try:
            age = int(age_text)
        except ValueError:
            age = 0
        
        assets_text = cols[6].get_text(strip=True) if len(cols) > 6 else "0"
        liabilities_text = cols[7].get_text(strip=True) if len(cols) > 7 else "0"
        
        candidate = {
            "Candidate": candidate_text,
            "Constituency": constituency_name,
            "Party": cols[2].get_text(strip=True) if len(cols) > 2 else "",
            "Criminal_Cases": criminal_cases,
            "Education": cols[4].get_text(strip=True) if len(cols) > 4 else "",
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
        time.sleep(0.5)  # Be polite — 0.5 second between requests
    
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
