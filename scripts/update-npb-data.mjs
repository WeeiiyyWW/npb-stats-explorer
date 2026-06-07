import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const CURRENT_YEAR = new Date().getFullYear();

const TABLES = {
  batting: {
    pageUrl: "https://proeyekyuu.com/ja/player-batting-stats-jp/",
    tableId: 11,
    output: "npb-batting-current.json",
    legacyOutput: "npb-batting.json",
    columnCount: 41,
    defaultOrderColumn: 14,
    nonQualifiedColumn: 7,
    normalize: normalizeBatter,
  },
  pitching: {
    pageUrl: "https://proeyekyuu.com/ja/player-pitching-stats-jp/",
    tableId: 17,
    output: "npb-pitching-current.json",
    legacyOutput: "npb-pitching.json",
    columnCount: 52,
    defaultOrderColumn: 15,
    nonQualifiedColumn: 6,
    normalize: normalizePitcher,
  },
};

const TEAM_MAP = new Map([
  ["巨人", { id: "giants", code: "G" }],
  ["読売ジャイアンツ", { id: "giants", code: "G" }],
  ["タイガース", { id: "tigers", code: "T" }],
  ["阪神タイガース", { id: "tigers", code: "T" }],
  ["ベイスターズ", { id: "baystars", code: "DB" }],
  ["横浜ベイスターズ", { id: "baystars", code: "DB" }],
  ["横浜DeNAベイスターズ", { id: "baystars", code: "DB" }],
  ["カープ", { id: "carp", code: "C" }],
  ["広島東洋カープ", { id: "carp", code: "C" }],
  ["スワローズ", { id: "swallows", code: "S" }],
  ["ヤクルトスワローズ", { id: "swallows", code: "S" }],
  ["東京ヤクルトスワローズ", { id: "swallows", code: "S" }],
  ["ドラゴンズ", { id: "dragons", code: "D" }],
  ["中日ドラゴンズ", { id: "dragons", code: "D" }],
  ["ホークス", { id: "hawks", code: "H" }],
  ["福岡ダイエーホークス", { id: "hawks", code: "H" }],
  ["福岡ソフトバンクホークス", { id: "hawks", code: "H" }],
  ["ファイターズ", { id: "fighters", code: "F" }],
  ["日本ハムファイターズ", { id: "fighters", code: "F" }],
  ["北海道日本ハムファイターズ", { id: "fighters", code: "F" }],
  ["マリーンズ", { id: "marines", code: "M" }],
  ["千葉ロッテマリーンズ", { id: "marines", code: "M" }],
  ["イーグルス", { id: "eagles", code: "E" }],
  ["東北楽天ゴールデンイーグルス", { id: "eagles", code: "E" }],
  ["バファローズ", { id: "buffaloes", code: "B" }],
  ["大阪近鉄バファローズ", { id: "buffaloes", code: "B" }],
  ["オリックス・ブルーウェーブ", { id: "buffaloes", code: "B" }],
  ["オリックス・バファローズ", { id: "buffaloes", code: "B" }],
  ["ライオンズ", { id: "lions", code: "L" }],
  ["西武ライオンズ", { id: "lions", code: "L" }],
  ["埼玉西武ライオンズ", { id: "lions", code: "L" }],
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function textFromHtml(value) {
  return clean(String(value ?? "").replace(/<[^>]*>/g, ""));
}

function imageSrc(value) {
  return clean(String(value ?? "").match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1]);
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

function normalizeTeam(shortTeam, longTeam = "") {
  const team = TEAM_MAP.get(clean(shortTeam)) || TEAM_MAP.get(clean(longTeam));
  return {
    teamId: team?.id || clean(shortTeam),
    teamCode: team?.code || clean(shortTeam),
  };
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "npb-stats-explorer/0.2 (+https://github.com/WeeiiyyWW/npb-stats-explorer)",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function decodeAttributeJson(raw) {
  return raw
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getTableMeta(html, config) {
  const noncePattern = new RegExp(`id="wdtNonceFrontendServerSide_${config.tableId}"[^>]*value="([^"]+)`);
  const nonce = html.match(noncePattern)?.[1];
  const descRaw = html.match(/<input type="hidden" id="table_1_desc"[^>]*value='([^']+)'/)?.[1];

  if (!nonce) throw new Error(`No wpDataTables nonce found for table ${config.tableId}`);
  if (!descRaw) throw new Error(`No wpDataTables description found for table ${config.tableId}`);

  const desc = JSON.parse(decodeAttributeJson(descRaw));
  return { nonce, desc };
}

function buildRequestBody(config, nonce, { includeNonQualified }) {
  const params = new URLSearchParams();
  params.set("draw", "1");
  params.set("start", "0");
  params.set("length", "10000");
  params.set("search[value]", "");
  params.set("search[regex]", "false");
  params.set("wdtNonce", nonce);
  params.set("order[0][column]", String(config.defaultOrderColumn));
  params.set("order[0][dir]", "desc");

  for (let index = 0; index < config.columnCount; index += 1) {
    params.set(`columns[${index}][data]`, String(index));
    params.set(`columns[${index}][name]`, "");
    params.set(`columns[${index}][searchable]`, "true");
    params.set(`columns[${index}][orderable]`, "true");
    params.set(`columns[${index}][search][value]`, "");
    params.set(`columns[${index}][search][regex]`, "false");
  }

  params.set("columns[0][search][value]", String(CURRENT_YEAR));

  // ProEyeKyuu's current-season tables default to qualified players.
  // Any value on this column flips the server-side filter to non-qualified players.
  if (includeNonQualified) {
    params.set(`columns[${config.nonQualifiedColumn}][search][value]`, "規定未満");
  }

  return params;
}

async function fetchTableChunk(config, nonce, options) {
  const response = await fetch(`https://proeyekyuu.com/wp-admin/admin-ajax.php?action=get_wdtable&table_id=${config.tableId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": config.pageUrl,
      "User-Agent": "npb-stats-explorer/0.2 (+https://github.com/WeeiiyyWW/npb-stats-explorer)",
    },
    body: buildRequestBody(config, nonce, options),
  });

  if (!response.ok) throw new Error(`Failed to fetch table ${config.tableId}: ${response.status}`);
  const text = await response.text();
  if (!text) throw new Error(`Empty response from table ${config.tableId}`);
  return JSON.parse(text).data || [];
}

function uniqueRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.personId}-${row.year}-${row.teamCode}`;
    byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function normalizeBatter(row) {
  const team = clean(row[4]);
  const mapped = normalizeTeam(row[4], row[34]);
  return {
    personId: clean(row[40]) || `${textFromHtml(row[2])}-${clean(row[0])}`,
    player: textFromHtml(row[2]),
    teamId: mapped.teamId,
    team,
    teamCode: mapped.teamCode,
    year: clean(row[0]),
    imageUrl: imageSrc(row[3]),
    g: numberText(row[8]),
    pa: numberText(row[9]),
    ab: numberText(row[10]),
    h: numberText(row[17]),
    doubles: numberText(row[19]),
    triples: numberText(row[20]),
    hr: numberText(row[21]),
    rbi: numberText(row[16]),
    avg: rate(row[11]),
    obp: rate(row[12]),
    slg: rate(row[13]),
    ops: rate(row[14]),
    so: numberText(row[27]),
    bb: numberText(row[25]),
    sb: numberText(row[23]),
    cs: numberText(row[24]),
    r: numberText(row[15]),
  };
}

function normalizePitcher(row) {
  const team = clean(row[4]);
  const mapped = normalizeTeam(row[4], row[42]);
  return {
    personId: clean(row[51]) || `${textFromHtml(row[2])}-${clean(row[0])}`,
    player: textFromHtml(row[2]),
    teamId: mapped.teamId,
    team,
    teamCode: mapped.teamCode,
    year: clean(row[0]),
    imageUrl: imageSrc(row[3]),
    g: numberText(row[12]),
    gs: numberText(row[38]),
    ip: numberText(row[13]),
    w: numberText(row[7]),
    l: numberText(row[8]),
    era: numberText(row[15]),
    whip: numberText(row[16]),
    hld: numberText(row[10]),
    sv: numberText(row[9]),
    so: numberText(row[29]),
    bb: numberText(row[30]),
    k9: numberText(row[21]),
    bb9: numberText(row[22]),
    kbb: numberText(row[23]),
    hr9: numberText(row[20]),
  };
}

async function updateOne(kind) {
  const config = TABLES[kind];
  const html = await fetchPage(config.pageUrl);
  const { nonce } = getTableMeta(html, config);
  const qualified = await fetchTableChunk(config, nonce, { includeNonQualified: false });
  const nonQualified = await fetchTableChunk(config, nonce, { includeNonQualified: true });
  const rows = uniqueRows([...qualified, ...nonQualified]
    .map(config.normalize)
    .filter((row) => row.player && row.year && row.team));

  await mkdir(DATA_DIR, { recursive: true });
  const payload = `${JSON.stringify({
    source: config.pageUrl,
    updatedAt: new Date().toISOString(),
    rows,
  }, null, 2)}\n`;
  await writeFile(path.join(DATA_DIR, config.output), payload);
  if (config.legacyOutput) {
    await writeFile(path.join(DATA_DIR, config.legacyOutput), payload);
  }

  console.log(`Wrote ${rows.length} ${kind} rows to ${config.output}`);
}

await updateOne("batting");
await updateOne("pitching");
