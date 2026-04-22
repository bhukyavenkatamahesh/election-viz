import pandas as pd
import numpy as np
import re
import os
import json

print("Starting data cleaning pipeline...")

# Create output directory
out_dir = "public/data"
os.makedirs(out_dir, exist_ok=True)

# -----------------------------------------------------
# 1. Load and Standardize Historical Results (2004, 2009)
# -----------------------------------------------------
print("Loading 1951-2009 data...")
df_hist = pd.read_csv("india-election-data-master/parliament-elections/parliament.csv")
df_hist = df_hist[df_hist['YEAR'].isin([2004, 2009])].copy()
df_hist['YEAR'] = df_hist['YEAR'].astype(int)
df_hist.rename(columns={
    'STATE': 'State', 
    'PC': 'Constituency', 
    'NAME': 'Candidate', 
    'PARTY': 'Party', 
    'VOTES': 'Votes'
}, inplace=True)
df_hist = df_hist[['YEAR', 'State', 'Constituency', 'Candidate', 'Party', 'Votes']]

# -----------------------------------------------------
# 2. Load and Standardize 2014 Results
# -----------------------------------------------------
print("Loading 2014 data...")
df_2014 = pd.read_csv("results/results_2014_candidate_wise.csv")
df_2014['YEAR'] = 2014
df_2014 = df_2014[['YEAR', 'State', 'Constituency', 'Candidate', 'Party', 'Votes']]

# -----------------------------------------------------
# 3. Load and Standardize 2019 Results
# -----------------------------------------------------
print("Loading 2019 data...")
df_2019 = pd.read_csv("results/results_2019.csv")
df_2019['YEAR'] = 2019
df_2019.rename(columns={
    'province_name': 'State', 
    'constituency_name': 'Constituency', 
    'candidate_name': 'Candidate', 
    'party_name': 'Party', 
    'total_votes': 'Votes'
}, inplace=True)
df_2019 = df_2019[['YEAR', 'State', 'Constituency', 'Candidate', 'Party', 'Votes']]

# -----------------------------------------------------
# 4. Load and Standardize 2024 Results
# -----------------------------------------------------
print("Loading 2024 data...")
# The 2024 file is separated by semicolons
try:
    df_2024 = pd.read_csv("india-election-data-master/india-votes-data-main/2024 Parliamentary Elections India.csv", sep=",")
except:
    pass

# User's 2024 download is in results directory or india-election-data-master
file_2024 = "results/results_2024.csv"
if not os.path.exists(file_2024):
    file_2024 = "india-election-data-master/india-votes-data-main/2024 Parliamentary Elections India.csv"

# Autodetect sep based on reading first line
with open(file_2024, "r", encoding="utf-8") as f:
    first_line = f.readline()
    sep = ";" if ";" in first_line else ","

df_2024 = pd.read_csv(file_2024, sep=sep)
df_2024['YEAR'] = 2024
df_2024 = df_2024[['YEAR', 'State', 'Constituency', 'Candidate', 'Party', 'Votes']]
df_2024['Votes'] = pd.to_numeric(df_2024['Votes'].astype(str).str.replace('"', '').str.replace(',', ''), errors='coerce')


# -----------------------------------------------------
# 5. Combine All Results
# -----------------------------------------------------
print("Combining all results...")
df_all = pd.concat([df_hist, df_2014, df_2019, df_2024], ignore_index=True)

# Standardize Strings
for col in ['State', 'Constituency', 'Candidate', 'Party']:
    df_all[col] = df_all[col].astype(str).str.strip().str.upper()

# Fix common Party Names
party_mapping = {
    'BHARATIYA JANATA PARTY': 'BJP',
    'INDIAN NATIONAL CONGRESS': 'INC',
    'COMMUNIST PARTY OF INDIA (MARXIST)': 'CPI(M)',
    'COMMUNIST PARTY OF INDIA': 'CPI',
    'BAHUJAN SAMAJ PARTY': 'BSP',
    'SAMAJWADI PARTY': 'SP',
    'ALL INDIA TRINAMOOL CONGRESS': 'AITC',
    'TRINAMOOL CONGRESS': 'AITC',
    'JANATA DAL (UNITED)': 'JD(U)',
    'AAM AADMI PARTY': 'AAP',
    'SHIVSENA': 'SHS',
    'SHIV SENA': 'SHS',
    'NATIONALIST CONGRESS PARTY': 'NCP',
    'TELUGU DESAM': 'TDP',
    'TELUGU DESAM PARTY': 'TDP',
    'YSRCP': 'YSRCP',
    'YUVAJANA SRAMIKA RYTHU CONGRESS PARTY': 'YSRCP',
    'INDEPENDENT': 'IND',
    'NOTA': 'NOTA',
    'NONE OF THE ABOVE': 'NOTA'
}
df_all['Party'] = df_all['Party'].replace(party_mapping)

df_nota = df_all[df_all['Party'] == 'NOTA']
df_all = df_all[df_all['Party'] != 'NOTA']

# -----------------------------------------------------
# 6. Calculate Win/Loss and Margins
# -----------------------------------------------------
print("Calculating winners and margins...")
df_all = df_all.sort_values(by=['YEAR', 'State', 'Constituency', 'Votes'], ascending=[True, True, True, False])

# Calculate group-level aggregates explicitly instead of apply 
# to avoid pandas 3.0 index dropping changes
df_all['Rank'] = df_all.groupby(['YEAR', 'State', 'Constituency'])['Votes'].rank(method='first', ascending=False)
df_all['Total_Votes_Const'] = df_all.groupby(['YEAR', 'State', 'Constituency'])['Votes'].transform('sum')
df_all['Vote_Share_Percent'] = (df_all['Votes'] / df_all['Total_Votes_Const']) * 100
df_all['Is_Winner'] = (df_all['Rank'] == 1).astype(int)

# Margin Calculation (1st place votes - 2nd place votes)
# Find 2nd place votes
second_place_votes = df_all[df_all['Rank'] == 2].set_index(['YEAR', 'State', 'Constituency'])['Votes']
df_all['Margin'] = 0

# Join 2nd place votes back to 1st place to calculate margin
df_winners_only = df_all[df_all['Rank'] == 1].set_index(['YEAR', 'State', 'Constituency'])
df_winners_only['Runner_Up_Votes'] = second_place_votes
df_winners_only['Runner_Up_Votes'] = df_winners_only['Runner_Up_Votes'].fillna(0) # In case only 1 candidate ran
df_winners_only['Margin'] = df_winners_only['Votes'] - df_winners_only['Runner_Up_Votes']

# Update margin in original DataFrame
df_all = df_all.set_index(['YEAR', 'State', 'Constituency'])
df_all.loc[df_all['Rank'] == 1, 'Margin'] = df_winners_only['Margin']
df_all = df_all.reset_index()


# -----------------------------------------------------
# 7. Merge Candidate Affidavits (Wealth, Criminal)
# -----------------------------------------------------
print("Merging candidate affidavits...")

# We have 2004, 2009, 2014, 2019 affidavits.
aff_2004 = pd.read_csv("india-election-data-master/affidavits/myneta.2004.csv")
aff_2004['YEAR'] = 2004
aff_2009 = pd.read_csv("india-election-data-master/affidavits/myneta.2009.csv")
aff_2009['YEAR'] = 2009
aff_2014 = pd.read_csv("india-election-data-master/affidavits/myneta.2014.csv")
aff_2014['YEAR'] = 2014

# Read 2019 affidavits with specific encoding and error handling if necessary
aff_2019 = pd.read_csv("candidates/candidates_2019.csv")
aff_2019['YEAR'] = 2019

# Normalize 2019 columns to match older ones
for col in aff_2019.columns:
    if 'CRIMINAL' in col:
        aff_2019.rename(columns={col: 'Criminal_Cases'}, inplace=True)
    if 'ASSETS' in col:
        aff_2019.rename(columns={col: 'Total_Assets'}, inplace=True)
aff_2019.rename(columns={'NAME': 'Candidate', 'CONSTITUENCY': 'Constituency'}, inplace=True)

# Combine affidavits
def clean_assets(val):
    if pd.isna(val) or val == 'Nil' or val == 'NIL':
        return 0
    val = str(val).lower()
    # Extract numbers from strings like "Rs 13,22,33,012 ~ 13 Crore+"
    match = re.search(r'rs\s*([\d,]+)', val)
    if match:
        try:
            return float(match.group(1).replace(',', ''))
        except:
            return 0
    return 0

aff_combined = pd.DataFrame()

for df_aff in [aff_2004, aff_2009, aff_2014, aff_2019]:
    df_aff['Constituency'] = df_aff['Constituency'].astype(str).str.strip().str.upper()
    df_aff['Candidate'] = df_aff['Candidate'].astype(str).str.strip().str.upper()
    
    asset_col = 'Total Assets' if 'Total Assets' in df_aff.columns else 'Total_Assets'
    crim_col = 'Criminal Cases' if 'Criminal Cases' in df_aff.columns else 'Criminal_Cases'
    
    if asset_col in df_aff.columns and crim_col in df_aff.columns:
        df_aff['Total_Assets'] = df_aff[asset_col].apply(clean_assets)
        df_aff['Criminal_Cases'] = pd.to_numeric(df_aff[crim_col], errors='coerce').fillna(0)
        aff_combined = pd.concat([aff_combined, df_aff[['YEAR', 'Constituency', 'Candidate', 'Total_Assets', 'Criminal_Cases']]])

# Merge with results using Year, Constituency, and Candidate
df_final = pd.merge(df_all, aff_combined, on=['YEAR', 'Constituency', 'Candidate'], how='left')
df_final['Total_Assets'] = df_final['Total_Assets'].fillna(0)
df_final['Criminal_Cases'] = df_final['Criminal_Cases'].fillna(0)

# -----------------------------------------------------
# 8. Export for Web Visualizations
# -----------------------------------------------------
print("Exporting data for constraints...")

# 8.1 Export Full Candidate Master
df_final.to_csv(f"{out_dir}/elections_master.csv", index=False)

# 8.2 Generate Winner Map Data
df_winners = df_final[df_final['Is_Winner'] == 1].copy()
df_winners.to_csv(f"{out_dir}/winners_map.csv", index=False)

# 8.3 Generate Party Ranks (Bump Chart)
party_seats = df_winners.groupby(['YEAR', 'Party']).size().reset_index(name='Seats')
top_parties = party_seats.groupby('Party')['Seats'].sum().nlargest(10).index.tolist()
party_seats['Party_Standard'] = party_seats['Party'].apply(lambda x: x if x in top_parties else 'OTHERS')
party_ranks_agg = party_seats.groupby(['YEAR', 'Party_Standard'])['Seats'].sum().reset_index()
party_ranks_agg['Rank'] = party_ranks_agg.groupby('YEAR')['Seats'].rank(method='min', ascending=False)
party_ranks_agg.to_csv(f"{out_dir}/party_ranks.csv", index=False)

# 8.4 Generate State Flows (Sankey)
state_party_seats = df_winners.groupby(['YEAR', 'State', 'Party']).size().reset_index(name='Seats')
state_party_seats['Party_Standard'] = state_party_seats['Party'].apply(lambda x: x if x in top_parties else 'OTHERS')
state_party_flows = state_party_seats.groupby(['YEAR', 'State', 'Party_Standard'])['Seats'].sum().reset_index()
state_party_flows.to_csv(f"{out_dir}/state_flows.csv", index=False)

print("Data cleaning complete! Outputs saved to public/data/")
