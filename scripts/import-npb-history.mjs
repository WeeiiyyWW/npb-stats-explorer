import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const START_YEAR = 2000;
const END_YEAR = 2025;

const TEAM_MAP = new Map([
  ["読売ジャイアンツ", { id: "giants", code: "G" }],
  ["阪神タイガース", { id: "tigers", code: "T" }],
  ["横浜DeNAベイスターズ", { id: "baystars", code: "DB" }],
  ["横浜ベイスターズ", { id: "baystars", code: "DB" }],
  ["広島東洋カープ", { id: "carp", code: "C" }],
  ["東京ヤクルトスワローズ", { id: "swallows", code: "S" }],
  ["ヤクルトスワローズ", { id: "swallows", code: "S" }],
  ["中日ドラゴンズ", { id: "dragons", code: "D" }],
  ["福岡ソフトバンクホークス", { id: "hawks", code: "H" }],
  ["福岡ダイエーホークス", { id: "hawks", code: "H" }],
  ["北海道日本ハムファイターズ", { id: "fighters", code: "F" }],
  ["日本ハムファイターズ", { id: "fighters", code: "F" }],
  ["千葉ロッテマリーンズ", { id: "marines", code: "M" }],
  ["東北楽天ゴールデンイーグルス", { id: "eagles", code: "E" }],
  ["オリックス・バファローズ", { id: "buffaloes", code: "B" }],
  ["オリックス・ブルーウェーブ", { id: "buffaloes", code: "B" }],
  ["大阪近鉄バファローズ", { id: "buffaloes", code: "B" }],
  ["埼玉西武ライオンズ", { id: "lions", code: "L" }],
  ["西武ライオンズ", { id: "lions", code: "L" }],
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function textFromHtml(value) {
  return clean(String(value ?? "").replace(/<[^>]*>/g, ""));
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

function normalizeTeam(teamName) {
  const team = TEAM_MAP.get(clean(teamName));
  return {
    teamId: team?.id || clean(teamName),
    teamCode: team?.code || clean(teamName),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((cells) => cells.some((cell) => clean(cell)))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

async function fetchCsv(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "npb-stats-explorer/0.2 (+https://github.com/WeeiiyyWW/npb-stats-explorer)",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function normalizeBatter(row) {
  const mapped = normalizeTeam(row["球団"]);
  return {
    personId: clean(row.PlayerID) || `${textFromHtml(row["名前"])}-${clean(row["シーズン"])}`,
    player: textFromHtml(row["名前"]),
    teamId: mapped.teamId,
    team: clean(row["球団"]),
    teamCode: mapped.teamCode,
    year: clean(row["シーズン"]),
    imageUrl: "",
    g: numberText(row["試合"]),
    pa: numberText(row["打席"]),
    ab: numberText(row["打数"]),
    h: numberText(row["安打"]),
    doubles: numberText(row["二塁打"]),
    triples: numberText(row["三塁打"]),
    hr: numberText(row["本塁打"]),
    rbi: numberText(row["打点"]),
    avg: rate(row["打率"]),
    obp: rate(row["出塁率"]),
    slg: rate(row["長打率"]),
    ops: rate(row.OPS),
    so: numberText(row["三振"]),
    bb: numberText(row["四球"]),
    sb: numberText(row["盗塁"]),
    cs: numberText(row["盗塁刺"]),
    r: numberText(row["得点"]),
  };
}

function normalizePitcher(row) {
  const mapped = normalizeTeam(row["球団"]);
  return {
    personId: clean(row.PlayerID) || `${textFromHtml(row["名前"])}-${clean(row["シーズン"])}`,
    player: textFromHtml(row["名前"]),
    teamId: mapped.teamId,
    team: clean(row["球団"]),
    teamCode: mapped.teamCode,
    year: clean(row["シーズン"]),
    imageUrl: "",
    g: numberText(row["登板"]),
    gs: numberText(row.GS),
    ip: numberText(row["投球回"]),
    w: numberText(row["勝利"]),
    l: numberText(row["敗北"]),
    era: numberText(row["防御率"]),
    whip: numberText(row.WHIP),
    hld: numberText(row["ホールド"]),
    sv: numberText(row["セーブ"]),
    so: numberText(row["三振"]),
    bb: numberText(row["四球"]),
    k9: numberText(row["K/9"]),
    bb9: numberText(row["BB/9"]),
    kbb: numberText(row["K/BB"]),
    hr9: numberText(row["HR/9"]),
  };
}

function uniqueRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.personId}-${row.year}-${row.teamCode}`;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

async function importKind(kind) {
  const rows = [];
  const folder = kind === "batting" ? "PlayerSLBattingJP" : "PlayerSLPitchingJP";
  const filename = kind === "batting" ? "player_batting_stats_jp" : "player_pitching_stats_jp";
  const normalize = kind === "batting" ? normalizeBatter : normalizePitcher;

  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const url = `https://proeyekyuu.com/wp-content/CsvExports/${folder}/${filename}_${year}.csv`;
    const csvRows = parseCsv(await fetchCsv(url));
    const officialRows = csvRows
      .filter((row) => clean(row["ゲームタイプ"]) === "公式戦")
      .map(normalize)
      .filter((row) => row.player && row.year && row.team);
    rows.push(...officialRows);
    console.log(`${kind} ${year}: ${officialRows.length} rows`);
  }

  const output = kind === "batting" ? "npb-batting-history.json" : "npb-pitching-history.json";
  const payload = {
    source: `https://proeyekyuu.com/ja/csvs-jp/ ${START_YEAR}-${END_YEAR}`,
    updatedAt: new Date().toISOString(),
    rows: uniqueRows(rows),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, output), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${payload.rows.length} ${kind} rows to ${output}`);
}

await importKind("batting");
await importKind("pitching");
