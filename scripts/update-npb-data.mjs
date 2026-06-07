import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");

const SOURCES = {
  batting: {
    url: "https://proeyekyuu.com/player-batting-stats/",
    output: "npb-batting.json",
  },
  pitching: {
    url: "https://proeyekyuu.com/player-pitching-stats/",
    output: "npb-pitching.json",
  },
};

const TEAM_MAP = new Map([
  ["Giants", { id: "giants", code: "G" }],
  ["Tigers", { id: "tigers", code: "T" }],
  ["Baystars", { id: "baystars", code: "DB" }],
  ["Carp", { id: "carp", code: "C" }],
  ["Swallows", { id: "swallows", code: "S" }],
  ["Dragons", { id: "dragons", code: "D" }],
  ["Hawks", { id: "hawks", code: "H" }],
  ["Fighters", { id: "fighters", code: "F" }],
  ["Marines", { id: "marines", code: "M" }],
  ["Eagles", { id: "eagles", code: "E" }],
  ["Buffaloes", { id: "buffaloes", code: "B" }],
  ["Lions", { id: "lions", code: "L" }],
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rate(value) {
  const text = clean(value);
  if (!text || text === "-") return "-";
  if (text.startsWith(".")) return text;
  const numeric = Number(text);
  if (Number.isNaN(numeric)) return text;
  return numeric < 1 ? numeric.toFixed(3).replace(/^0/, "") : numeric.toFixed(3);
}

function numberText(value) {
  const text = clean(value);
  return text || "-";
}

function getCell(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function normalizeHeader(header) {
  return clean(header)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "npb-stats-explorer/0.1 (+https://github.com/WeeiiyyWW/npb-stats-explorer)",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function parseTables(html) {
  const $ = cheerio.load(html);
  const tables = [];
  $("table").each((_, table) => {
    const headers = [];
    $(table).find("thead tr").first().find("th,td").each((__, cell) => {
      headers.push(normalizeHeader($(cell).text()));
    });
    if (!headers.length) {
      $(table).find("tr").first().find("th,td").each((__, cell) => {
        headers.push(normalizeHeader($(cell).text()));
      });
    }
    const rows = [];
    $(table).find("tbody tr").each((__, tr) => {
      const cells = [];
      $(tr).find("td").each((___, td) => {
        cells.push(clean($(td).text()));
      });
      if (cells.length) {
        rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
      }
    });
    if (headers.length && rows.length) tables.push({ headers, rows });
  });
  return tables;
}

function pickStatsTable(tables) {
  return tables.find(({ headers }) => (
    headers.includes("Season") &&
    headers.includes("Name") &&
    headers.includes("Team") &&
    headers.includes("PlayerID")
  ));
}

function normalizeTeam(rawTeam) {
  const team = TEAM_MAP.get(clean(rawTeam));
  return {
    teamId: team?.id || clean(rawTeam).toLowerCase(),
    teamCode: team?.code || clean(rawTeam),
  };
}

function normalizeBatter(row) {
  const team = clean(getCell(row, ["Team"]));
  const mapped = normalizeTeam(team);
  return {
    personId: clean(getCell(row, ["PlayerID"])) || `${clean(row.Name)}-${clean(row.Season)}`,
    player: clean(getCell(row, ["Name"])),
    teamId: mapped.teamId,
    team,
    teamCode: mapped.teamCode,
    year: clean(getCell(row, ["Season"])),
    g: numberText(getCell(row, ["G"])),
    pa: numberText(getCell(row, ["PA"])),
    ab: numberText(getCell(row, ["AB"])),
    h: numberText(getCell(row, ["H"])),
    doubles: numberText(getCell(row, ["2B"])),
    triples: numberText(getCell(row, ["3B"])),
    hr: numberText(getCell(row, ["HR"])),
    rbi: numberText(getCell(row, ["RBI"])),
    avg: rate(getCell(row, ["BA", "AVG"])),
    obp: rate(getCell(row, ["OBP"])),
    slg: rate(getCell(row, ["SLG"])),
    ops: rate(getCell(row, ["OPS"])),
    so: numberText(getCell(row, ["K", "SO"])),
    bb: numberText(getCell(row, ["BB"])),
    sb: numberText(getCell(row, ["SB"])),
    cs: numberText(getCell(row, ["CS"])),
    r: numberText(getCell(row, ["R"])),
  };
}

function normalizePitcher(row) {
  const team = clean(getCell(row, ["Team"]));
  const mapped = normalizeTeam(team);
  return {
    personId: clean(getCell(row, ["PlayerID"])) || `${clean(row.Name)}-${clean(row.Season)}`,
    player: clean(getCell(row, ["Name"])),
    teamId: mapped.teamId,
    team,
    teamCode: mapped.teamCode,
    year: clean(getCell(row, ["Season"])),
    g: numberText(getCell(row, ["G"])),
    gs: numberText(getCell(row, ["GS"])),
    ip: numberText(getCell(row, ["IP"])),
    w: numberText(getCell(row, ["W"])),
    l: numberText(getCell(row, ["L"])),
    era: numberText(getCell(row, ["ERA"])),
    whip: numberText(getCell(row, ["WHIP"])),
    hld: numberText(getCell(row, ["HLD"])),
    sv: numberText(getCell(row, ["S", "SV"])),
    so: numberText(getCell(row, ["K", "SO"])),
    bb: numberText(getCell(row, ["BB"])),
    k9: numberText(getCell(row, ["K/9"])),
    bb9: numberText(getCell(row, ["BB/9"])),
    kbb: numberText(getCell(row, ["K/BB"])),
    hr9: numberText(getCell(row, ["HR/9"])),
  };
}

async function updateOne(kind) {
  const source = SOURCES[kind];
  const html = await fetchHtml(source.url);
  const table = pickStatsTable(parseTables(html));
  if (!table) throw new Error(`No stats table found for ${kind}`);
  const rows = table.rows
    .map(kind === "pitching" ? normalizePitcher : normalizeBatter)
    .filter((row) => row.player && row.year && row.team);

  const payload = {
    source: source.url,
    updatedAt: new Date().toISOString(),
    rows,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, source.output), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${rows.length} ${kind} rows to ${source.output}`);
}

await updateOne("batting");
await updateOne("pitching");
