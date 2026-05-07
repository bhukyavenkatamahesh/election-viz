const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "index.html",
  "css/style.css",
  "js/main.js",
  "js/map.js",
  "js/bumpchart.js",
  "js/sankey.js",
  "js/scatterplot.js",
  "js/participation.js",
  "public/data/elections_master.csv",
  "public/data/winners_map.csv",
  "public/data/party_ranks.csv",
  "public/data/state_flows.csv",
  "public/data/participation_summary.csv",
  "public/data/candidate_gender_summary.csv",
  "public/data/india_pc_2019_simplified.geojson"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readCsv(file) {
  const body = fs.readFileSync(path.join(root, file), "utf8").trim();
  const [header, ...rows] = body.split(/\r?\n/);
  return { columns: header.split(","), rows };
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`Missing required file: ${file}`);
  }
}

const datasets = {
  "public/data/elections_master.csv": ["YEAR", "State", "Constituency", "Candidate", "Party", "Votes"],
  "public/data/winners_map.csv": ["YEAR", "State", "Constituency", "Party", "Is_Winner"],
  "public/data/participation_summary.csv": ["YEAR", "State", "Constituency", "Total_Turnout"],
  "public/data/candidate_gender_summary.csv": ["YEAR", "State", "Gender", "Candidates"]
};

for (const [file, columns] of Object.entries(datasets)) {
  const csv = readCsv(file);
  for (const column of columns) {
    if (!csv.columns.includes(column)) fail(`${file} is missing column ${column}`);
  }
  if (csv.rows.length === 0) fail(`${file} has no data rows`);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const script of ["js/main.js", "js/map.js", "js/bumpchart.js", "js/sankey.js", "js/scatterplot.js", "js/participation.js"]) {
  if (!html.includes(script)) fail(`index.html does not load ${script}`);
}

const geo = JSON.parse(fs.readFileSync(path.join(root, "public/data/india_pc_2019_simplified.geojson"), "utf8"));
if (!Array.isArray(geo.features) || geo.features.length !== 543) {
  fail("GeoJSON should contain 543 parliamentary constituency features");
}

if (!process.exitCode) {
  console.log("Project validation passed.");
}
