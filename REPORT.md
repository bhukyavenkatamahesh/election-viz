# Visualizing Indian Electoral Patterns (2004–2024)

**Team:** Pritam Maji (2025JTM2085), Venkata Mahesh (2025JTM2088), Suvajyoti Biswas (2025JTM2518)

## 1. Problem

Indian general elections are the world's largest democratic exercise, yet the
public record across five Lok Sabha cycles (2004, 2009, 2014, 2019, 2024) is
scattered across ECI bulletins, candidate affidavits, and delimitation
reports. We set out to answer three linked questions in one dashboard:

1. **Where** do constituencies swing between parties, and do the swings cluster
   geographically?
2. **When** do national party dynamics shift — which parties rise, fall, or
   consolidate across five elections?
3. **Who wins** — how do candidate attributes (declared assets, criminal
   cases) correlate with electoral success?

## 2. Data

| Source | Coverage | Use |
|---|---|---|
| ECI constituency & candidate-wise results | 2004–2024 | Vote totals, margins, winners |
| Kaggle *Indian Elections* dataset | 2004–2024 | Pre-cleaned cross-year joins |
| Delimitation Commission GeoJSON | 2008 boundaries | Choropleth geometry |
| ADR / MyNeta affidavits | 2019 | Assets, criminal cases |

Cleaning (`Data/clean_data.py`) standardises party aliases (e.g. *INC* vs
*Indian National Congress*), computes per-constituency margin and vote share,
and joins candidate affidavits to the results table on
`(YEAR, State, Constituency, Candidate)`. Outputs are three CSVs plus one
GeoJSON in `public/data/`, loaded by the front end with `d3.csv` /
`d3.json`.

The 2024 MyNeta affidavits were not scrapable at release time; the scatter
plot therefore covers 2019 with partial coverage of earlier years and the
UI states this explicitly.

## 3. Design Rationale

The dashboard follows Shneiderman's *overview → filter → details-on-demand*
mantra. Four linked views share one global state (year, selected state,
selected party) dispatched from `js/main.js`.

### 3.1 Choropleth map — *overview of geography*
D3 Mercator projection over GeoJSON PC polygons, auto-fit to the panel via
`projection.fitSize()` so Kashmir and Kanyakumari sit cleanly on one canvas.
Winning party encoded in hue; **margin-of-victory encoded in saturation** —
narrow wins are blended toward neutral gray, safe seats keep full party
color. This follows the Hullman et al. (2019) guidance that uncertainty
should be *perceptually encoded* rather than hidden: a 0.1% margin and a
30% margin should not look identical. Pan-and-zoom via `d3.zoom`; click
toggles a state filter that cascades to every other view; double-click
resets zoom.

### 3.2 Bump chart — *national party trajectories*
Parties ranked 1–10 by seats won per election. Monotone-X interpolation
keeps curves smooth without overshoot. Hovering shows seats; clicking a
node toggles a party filter. When a state filter is active the chart
re-computes from `winners_map.csv` on the fly so the ranking reflects that
state only.

### 3.3 Sankey — *seat flow between elections*
For every constituency present in consecutive elections, we draw a link
between the winning party in year *t* and year *t+1*. The 2004→2009
transition spans the 2008 delimitation, so only constituencies whose names
survived unchanged contribute to that first ribbon — a deliberate
data-honest choice rather than a synthetic re-alignment. Link thickness =
seat count; hover reveals exact retention counts.

### 3.4 Candidate scatter — *who wins*
X = declared total assets (symlog scale — asset distribution spans ₹0 to
~₹1,400Cr), Y = votes received, radius = number of criminal cases, color =
winner vs. loser. The symlog choice handles candidates with zero declared
assets without dropping them. Winners are raised to the front so the
"shape" of the winning cohort is visible at a glance.

### 3.5 Interactions
- **Year slider** updates map and scatter.
- **Click a state** on the map → map, bump chart, sankey, and scatter all
  filter to that state. Click again or press × to clear.
- **Click a party node** on the bump chart → all views highlight that party.
- **Linked brushing** follows Battle & Heer (2021): a single global state
  object, views subscribe through `updateViews()`.
- Tooltips are a single global element (`#global-tooltip`) moved on
  `mousemove`, cheaper than per-view tooltip DOM, and auto-flipped to the
  left/above the cursor when they would overflow the viewport.

## 4. Findings (representative)

Observations visible directly in the dashboard:

- **2014 and 2019** show the BJP ribbon dominating the sankey's middle
  years, with INC retaining very few seats into 2019.
- **Regional party persistence** — TDP, YSRCP in Andhra; DMK / AIADMK in
  Tamil Nadu retain clusters regardless of national swing, visible as
  self-loops in the sankey and stable clusters on the map.
- **Margin certainty** — when the margin encoding is on, large swaths of
  Uttar Pradesh and West Bengal appear washed out, confirming that many
  high-profile seats are decided by <5% margins.
- **Asset-vote relationship** is weak — the scatter shows winners spread
  across the full asset range. Criminal cases (radius) cluster among both
  winners and losers, consistent with the Rao et al. (2023) finding that
  affidavit signals do not cleanly predict outcomes.

## 5. Limitations

1. **Delimitation (2008)** — PC-name joins miss constituencies that were
   renamed or split; the 2004→2009 sankey ribbon is thinner than the true
   party persistence.
2. **Affidavit gap (2024)** — MyNeta rate-limited scraping; the scatter
   has robust coverage only for 2019.
3. **Party normalisation** is alias-based. Breakaways (e.g. Shiv Sena
   factions post-2022) are not historically reconciled and appear as
   separate entities.
4. **Uncertainty** is encoded only for margin-of-victory on the map;
   turnout and vote-share confidence intervals are not visualised.

## 6. Tech Stack (deviations from proposal)

The proposal named React + Vega-Lite. Final build uses **vanilla HTML +
D3.js v7 + d3-sankey**, no build step. Rationale: four interlinked D3
views share one state object cleanly without the JSX overhead, and
Vega-Lite's declarative grammar was ill-suited to the bespoke
margin-encoded choropleth and constituency-level sankey we wanted.
Python + pandas (`Data/clean_data.py`) remained as proposed for the
cleaning pipeline.

## 7. References

1. Lupi, G. & Posavec, S. *Dear Data*. Princeton Arch. Press, 2020.
2. Hullman, J. et al. "Why Authors Don't Visualize Uncertainty." *IEEE
   VIS*, 2019.
3. Battle, L. & Heer, J. "Scalable Linked Views for Exploratory Data
   Analysis." *Computer Graphics Forum*, 2021.
4. Bostock, M., Ogievetsky, V. & Heer, J. "D³: Data-Driven Documents."
   *IEEE TVCG*, 2018.
5. Rao, A. et al. "Visual Analysis of Indian Electoral Affidavit Data."
   *CHI*, 2023.
