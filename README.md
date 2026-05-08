# Visualizing Indian Electoral Patterns (2004–2024)

An interactive D3.js dashboard exploring trends, swing constituencies, and
party dynamics across five Lok Sabha elections.

**Team:** Pritam Maji (2025JTM2085) · Venkata Mahesh (2025JTM2088) ·
Suvajyoti Biswas (2025JTM2518) — IIT Delhi, JTM program.

## Running locally

Install-free local use still works. Serve the repo root over HTTP and open in
a browser:

```bash
cd election-viz
npm start
# then open http://localhost:8000
```

Tested on Chrome / Safari latest. Requires an internet connection on first
load to pull D3 v7 and d3-sankey from CDN.

Useful maintenance commands:

```bash
npm test             # validate required files, data columns, and GeoJSON shape
npm run verify:data  # print source-data coverage checks
npm run build:data   # regenerate public/data/*.csv from Data/
npm run build:site   # copy only deployable static assets to dist/
```

## Views

| Panel | File | What it shows |
|---|---|---|
| **Electoral Map** | [js/map.js](js/map.js) | Choropleth of 543 constituencies. Hue = winning party; saturation = margin of victory (narrow wins fade toward gray). Pan/zoom, click to filter by state, double-click to reset. |
| **Party Power Dynamics** | [js/bumpchart.js](js/bumpchart.js) | Bump chart of the top 10 parties ranked by seats won, 2004 → 2024. Click a node to filter by party. |
| **Voter Flow Analysis** | [js/sankey.js](js/sankey.js) | Sankey of constituency-level seat transitions between consecutive elections. The 2004 → 2009 ribbon spans the 2008 delimitation — only PCs whose names survived contribute. |
| **Candidate Landscape** | [js/scatterplot.js](js/scatterplot.js) | Scatter of declared assets (x, symlog) vs. votes received (y), radius = criminal cases, color = winner/loser. |
| **Participation & Representation** | [js/participation.js](js/participation.js) | Turnout coverage by state plus candidate gender mix where source data includes gender. |

All five views share one global state object in [js/main.js](js/main.js).
Selecting a state on the map or a party on the bump chart brushes every
other view.

## Data

### Processed CSVs served to the browser
In [public/data/](public/data/):

| File | Purpose |
|---|---|
| `elections_master.csv` | All candidates, 2004–2024. Columns: year, state, constituency, candidate, party, votes, rank, vote share, is_winner, margin, total_assets, criminal_cases. |
| `winners_map.csv` | One row per winning candidate — used by map, bump, sankey. |
| `party_ranks.csv` | Pre-computed party seat totals + national rank per year. |
| `state_flows.csv` | State-level aggregated flows (reserved for future use). |
| `participation_summary.csv` | Constituency-level turnout coverage where electors and voters are available. |
| `candidate_gender_summary.csv` | Candidate and winner counts by year, state, and gender where source data includes gender. |
| `india_pc_2019_simplified.geojson` | 543 post-delimitation PC polygons. |

### Raw sources

| Source | Path / URL | Use |
|---|---|---|
| Election Commission of India | [Data/results/](Data/results/) | Constituency- and candidate-wise results (2014, 2019, 2024) |
| *india-election-data* | [Data/india-election-data-master/](Data/india-election-data-master/) | Pre-cleaned multi-year results (2004, 2009) and affidavit CSVs |
| ADR / MyNeta | [Data/candidates/](Data/candidates/) | Candidate affidavits and gender coverage where scraped |
| Delimitation Commission | [Data/boundaries/](Data/boundaries/) | PC boundary GeoJSON |

### Cleaning pipeline

`Data/clean_data.py` merges the raw sources into the processed CSVs under
`public/data/`. `Data/scrape_myneta.py` scrapes MyNeta affidavits using only
Python standard-library modules.

## Tech stack

- **D3.js v7** — scales, shapes, transitions, zoom, geoPath
- **d3-sankey** (0.12) — Sankey layout
- **Vanilla HTML + CSS** — no React, no build step
- **Python 3 + pandas** — data cleaning (`Data/clean_data.py`)

Proposal originally named React + Vega-Lite; we dropped both because four
tightly-linked D3 views share one state object cleanly without JSX, and
Vega-Lite didn't fit the bespoke margin-encoded choropleth we wanted.

## Known limitations

1. **2024 affidavit coverage depends on the scrape.** Run
   `npm run build:data` after `python3 Data/scrape_myneta.py --year 2024` to
   include fresh 2024 assets/criminal-case fields when MyNeta pages are
   reachable.
2. **Turnout coverage is source-dependent.** 2009 and 2014 use constituency
   elector/voter aggregates; 2019 is approximate because it divides candidate
   votes by constituency electors and may exclude NOTA.
3. **2008 delimitation** — the 2004 → 2009 Sankey ribbon misses constituencies
   that were renamed or split (we join on PC name). Treat that transition as
   a lower bound.
4. **Gender coverage is uneven.** Candidate gender is available for 2004,
   2009, and MyNeta-scraped years, but not every source year exposes it.
5. **Party normalisation** is alias-based. Breakaway factions (e.g. Shiv
   Sena 2022 split) appear as separate entities rather than reconciled.
6. **Repository size.** Only raw sources used by the cleaning pipeline remain
   checked in. Unused map archives, assembly data, member rosters, village
   mappings, and the proposal PDF were removed from the project tree; GitHub
   Pages deploys only the static dashboard bundle generated in `dist/`.

## Repo layout

```
.
├── index.html                   # Dashboard shell
├── css/style.css                # Dark theme
├── js/
│   ├── main.js                  # Global state + dispatch
│   ├── map.js                   # Choropleth
│   ├── bumpchart.js             # Party rank bump
│   ├── sankey.js                # Seat-flow sankey
│   ├── scatterplot.js           # Candidate scatter
│   └── participation.js         # Turnout + candidate gender panel
├── public/data/                 # Cleaned CSVs + GeoJSON (browser-loaded)
├── Data/                        # Raw sources + cleaning scripts
├── scripts/                     # Validation and static deploy build
├── .github/workflows/           # CI and GitHub Pages deployment
├── REPORT.md                    # Final report
└── README.md                    # You are here
```

## Report

See [REPORT.md](REPORT.md) for the full write-up: problem, design rationale
per view, findings, limitations, and references to the five papers in the
literature survey.

## References

1. Lupi, G. & Posavec, S. *Dear Data*. Princeton Arch. Press, 2020.
2. Hullman, J. et al. "Why Authors Don't Visualize Uncertainty." *IEEE VIS*, 2019.
3. Battle, L. & Heer, J. "Scalable Linked Views for Exploratory Data Analysis." *Computer Graphics Forum*, 2021.
4. Bostock, M., Ogievetsky, V. & Heer, J. "D³: Data-Driven Documents." *IEEE TVCG*, 2018.
5. Rao, A. et al. "Visual Analysis of Indian Electoral Affidavit Data." *CHI*, 2023.
