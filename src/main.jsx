import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import "./styles.css";

const START_YEAR = 2000;
const CURRENT_YEAR = new Date().getFullYear();
const SEASONS = Array.from(
  { length: Math.max(CURRENT_YEAR - START_YEAR + 1, 1) },
  (_, i) => CURRENT_YEAR - i
);

const LEAGUE_OPTIONS = [
  { value: "Central", label: "Central" },
  { value: "Pacific", label: "Pacific" },
];

const TEAM_OPTIONS = [
  { id: "giants", league: "Central", name: "Giants", fullName: "Yomiuri Giants", abbr: "G" },
  { id: "tigers", league: "Central", name: "Tigers", fullName: "Hanshin Tigers", abbr: "T" },
  { id: "baystars", league: "Central", name: "Baystars", fullName: "Yokohama DeNA Baystars", abbr: "DB" },
  { id: "carp", league: "Central", name: "Carp", fullName: "Hiroshima Toyo Carp", abbr: "C" },
  { id: "swallows", league: "Central", name: "Swallows", fullName: "Tokyo Yakult Swallows", abbr: "S" },
  { id: "dragons", league: "Central", name: "Dragons", fullName: "Chunichi Dragons", abbr: "D" },
  { id: "hawks", league: "Pacific", name: "Hawks", fullName: "Fukuoka Softbank Hawks", abbr: "H" },
  { id: "fighters", league: "Pacific", name: "Fighters", fullName: "Hokkaido Nippon-Ham Fighters", abbr: "F" },
  { id: "marines", league: "Pacific", name: "Marines", fullName: "Chiba Lotte Marines", abbr: "M" },
  { id: "eagles", league: "Pacific", name: "Eagles", fullName: "Tohoku Rakuten Golden Eagles", abbr: "E" },
  { id: "buffaloes", league: "Pacific", name: "Buffaloes", fullName: "Orix Buffaloes", abbr: "B" },
  { id: "lions", league: "Pacific", name: "Lions", fullName: "Saitama Seibu Lions", abbr: "L" },
];

const TEAM_ALIASES = new Map(
  [
    ...TEAM_OPTIONS.flatMap((team) => [
    [team.id.toLowerCase(), team],
    [team.name.toLowerCase(), team],
    [team.fullName.toLowerCase(), team],
    [team.abbr.toLowerCase(), team],
  ]),
    ["巨人", TEAM_OPTIONS[0]],
    ["読売ジャイアンツ", TEAM_OPTIONS[0]],
    ["タイガース", TEAM_OPTIONS[1]],
    ["阪神タイガース", TEAM_OPTIONS[1]],
    ["ベイスターズ", TEAM_OPTIONS[2]],
    ["横浜denaベイスターズ", TEAM_OPTIONS[2]],
    ["横浜dena baystars", TEAM_OPTIONS[2]],
    ["カープ", TEAM_OPTIONS[3]],
    ["広島東洋カープ", TEAM_OPTIONS[3]],
    ["スワローズ", TEAM_OPTIONS[4]],
    ["東京ヤクルトスワローズ", TEAM_OPTIONS[4]],
    ["ドラゴンズ", TEAM_OPTIONS[5]],
    ["中日ドラゴンズ", TEAM_OPTIONS[5]],
    ["ホークス", TEAM_OPTIONS[6]],
    ["福岡ソフトバンクホークス", TEAM_OPTIONS[6]],
    ["ファイターズ", TEAM_OPTIONS[7]],
    ["北海道日本ハムファイターズ", TEAM_OPTIONS[7]],
    ["マリーンズ", TEAM_OPTIONS[8]],
    ["千葉ロッテマリーンズ", TEAM_OPTIONS[8]],
    ["イーグルス", TEAM_OPTIONS[9]],
    ["東北楽天ゴールデンイーグルス", TEAM_OPTIONS[9]],
    ["バファローズ", TEAM_OPTIONS[10]],
    ["オリックス・バファローズ", TEAM_OPTIONS[10]],
    ["ライオンズ", TEAM_OPTIONS[11]],
    ["埼玉西武ライオンズ", TEAM_OPTIONS[11]],
  ]
);

const TEAM_OPTIONS_BY_LEAGUE = LEAGUE_OPTIONS.reduce((acc, { value }) => {
  acc[value] = TEAM_OPTIONS
    .filter((team) => team.league === value)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((team) => ({ value: team.id, label: team.fullName }));
  return acc;
}, {});

const TYPE_OPTIONS = [
  { value: "batters", label: "Batters" },
  { value: "pitchers", label: "Pitchers" },
];

const HITTER_TABLE = {
  columns: [
    ["player", "Player"], ["teamCode", "Team"], ["year", "Year"], ["g", "G"], ["pa", "PA"], ["ab", "AB"], ["h", "H"], ["doubles", "2B"], ["triples", "3B"], ["hr", "HR"], ["rbi", "RBI"], ["avg", "AVG"], ["obp", "OBP"], ["slg", "SLG"], ["ops", "OPS"], ["so", "SO"], ["bb", "BB"], ["sb", "SB"], ["cs", "CS"],
  ],
  careerCards: [["ab", "AB"], ["r", "R"], ["h", "H"], ["hr", "HR"], ["rbi", "RBI"], ["sb", "SB"], ["avg", "AVG"], ["obp", "OBP"], ["ops", "OPS"]],
};

const PITCHER_TABLE = {
  columns: [
    ["player", "Player"], ["teamCode", "Team"], ["year", "Year"], ["g", "G"], ["gs", "GS"], ["ip", "IP"], ["w", "W"], ["l", "L"], ["era", "ERA"], ["whip", "WHIP"], ["hld", "HLD"], ["sv", "SV"], ["so", "SO"], ["bb", "BB"], ["k9", "K/9"], ["bb9", "BB/9"], ["kbb", "K/BB"], ["hr9", "HR/9"],
  ],
  careerCards: [["w", "W"], ["l", "L"], ["era", "ERA"], ["g", "G"], ["gs", "GS"], ["sv", "SV"], ["ip", "IP"], ["so", "SO"], ["whip", "WHIP"]],
};

const dataCache = new Map();

async function fetchData(type) {
  if (dataCache.has(type)) return dataCache.get(type);
  const file = type === "pitchers" ? "npb-pitching.json" : "npb-batting.json";
  const request = fetch(`/data/${file}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Unable to load ${file}`);
      return res.json();
    })
    .then((payload) => payload.rows || []);
  dataCache.set(type, request);
  return request;
}

function findTeam(value) {
  return TEAM_ALIASES.get(String(value || "").toLowerCase()) || null;
}

function getTeam(teamId) {
  return TEAM_OPTIONS.find((team) => team.id === teamId) || null;
}

function getNextDirection(prev, key) {
  if (prev.key !== key) return "desc";
  return prev.direction === "desc" ? "asc" : "desc";
}

function toComparable(value) {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  const numeric = Number(String(value).replace("%", ""));
  return Number.isNaN(numeric) ? String(value).toLowerCase() : numeric;
}

function sortRows(rows, sortConfig) {
  return [...rows].sort((a, b) => {
    const av = toComparable(a[sortConfig.key]);
    const bv = toComparable(b[sortConfig.key]);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const result = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortConfig.direction === "asc" ? result : -result;
  });
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="selectWrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="chevron" />
      </div>
    </div>
  );
}

function ActionButton({ children, variant = "primary", onClick, disabled = false }) {
  return (
    <button type="button" className={`action ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function DataTable({ config, rows, emptyText, onSort, sortConfig, onPlayerClick }) {
  return (
    <div className="tableCard">
      <div className="tableScroll">
        <table>
          <thead>
            <tr>
              {config.columns.map(([key, label], index) => (
                <th key={key} className={index === 0 ? "stickyCell" : ""}>
                  <button type="button" onClick={() => onSort?.(key)}>
                    {label}
                    {sortConfig?.key === key ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={config.columns.length} className="empty">{emptyText}</td></tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={`${row.personId || row.player}-${row.year}-${row.teamCode}-${rowIndex}`}>
                {config.columns.map(([key], colIndex) => (
                  <td key={key} className={colIndex === 0 ? "stickyCell playerCell" : ""}>
                    {colIndex === 0 && onPlayerClick ? (
                      <button type="button" className="playerLink" onClick={() => onPlayerClick(row)}>
                        {row[key] ?? "-"}
                      </button>
                    ) : row[key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CareerGrid({ cards, career }) {
  return (
    <div className="careerGrid">
      {cards.map(([key, label]) => (
        <div key={key} className="careerCard">
          <div className="careerLabel">{label}</div>
          <div className="careerValue">{career?.[key] ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

function buildCareer(rows, type) {
  if (!rows.length) return null;
  const sum = (key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  if (type === "pitchers") {
    return {
      player: rows[0].player,
      w: sum("w"),
      l: sum("l"),
      g: sum("g"),
      gs: sum("gs"),
      sv: sum("sv"),
      so: sum("so"),
      ip: rows.reduce((total, row) => total + Number(String(row.ip || 0).replace(".1", ".333").replace(".2", ".667")), 0).toFixed(1),
      era: "-",
      whip: "-",
    };
  }
  const ab = sum("ab");
  const h = sum("h");
  return {
    player: rows[0].player,
    ab,
    r: sum("r"),
    h,
    hr: sum("hr"),
    rbi: sum("rbi"),
    sb: sum("sb"),
    avg: ab ? (h / ab).toFixed(3).replace(/^0/, "") : "-",
    obp: "-",
    ops: "-",
  };
}

function App() {
  const defaultLeague = "Central";
  const defaultTeamId = "giants";
  const defaultYear = String(CURRENT_YEAR);
  const defaultType = "batters";

  const [pendingLeague, setPendingLeague] = useState(defaultLeague);
  const [pendingTeamId, setPendingTeamId] = useState(defaultTeamId);
  const [pendingYear, setPendingYear] = useState(defaultYear);
  const [pendingType, setPendingType] = useState(defaultType);
  const [activeTeamId, setActiveTeamId] = useState(defaultTeamId);
  const [activeYear, setActiveYear] = useState(defaultYear);
  const [activeType, setActiveType] = useState(defaultType);
  const [hasResults, setHasResults] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState([]);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [seasonError, setSeasonError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "pa", direction: "desc" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const filteredTeams = useMemo(() => TEAM_OPTIONS_BY_LEAGUE[pendingLeague] || [], [pendingLeague]);
  const yearOptions = useMemo(() => SEASONS.map((season) => ({ value: String(season), label: String(season) })), []);
  const activeTeam = useMemo(() => getTeam(activeTeamId), [activeTeamId]);
  const tableConfig = activeType === "pitchers" ? PITCHER_TABLE : HITTER_TABLE;
  const sortedMainRows = useMemo(() => sortRows(seasonRows, sortConfig), [seasonRows, sortConfig]);
  const detailRows = useMemo(() => {
    if (!selectedPlayer) return [];
    return allRows
      .filter((row) => row.personId === selectedPlayer.personId)
      .sort((a, b) => Number(b.year) - Number(a.year));
  }, [allRows, selectedPlayer]);
  const careerStats = useMemo(() => buildCareer(detailRows, activeType), [detailRows, activeType]);

  const handleLeagueChange = (league) => {
    setPendingLeague(league);
    const firstTeam = TEAM_OPTIONS_BY_LEAGUE[league]?.[0];
    setPendingTeamId(firstTeam?.value || "");
  };

  const defaultSortForType = (type) => (
    type === "pitchers" ? { key: "ip", direction: "desc" } : { key: "pa", direction: "desc" }
  );

  const runSearch = async (override = null) => {
    const teamId = override?.teamId || pendingTeamId;
    const year = override?.year || pendingYear;
    const type = override?.type || pendingType;
    const team = getTeam(teamId);
    setLoadingSeason(true);
    setSeasonError("");
    setDetailOpen(false);
    setSelectedPlayer(null);
    setHasResults(true);

    try {
      const rows = await fetchData(type);
      const filtered = rows.filter((row) => {
        const rowTeam = findTeam(row.teamId || row.team || row.teamCode);
        return String(row.year) === String(year) && rowTeam?.id === team?.id;
      });
      setAllRows(rows);
      setSeasonRows(filtered);
      setActiveTeamId(teamId);
      setActiveYear(year);
      setActiveType(type);
      setSortConfig(defaultSortForType(type));
    } catch (error) {
      setSeasonRows([]);
      setSeasonError("Unable to load NPB stats right now.");
    } finally {
      setLoadingSeason(false);
    }
  };

  const clearFilters = () => {
    setPendingLeague(defaultLeague);
    setPendingTeamId(defaultTeamId);
    setPendingYear(defaultYear);
    setPendingType(defaultType);
    setSeasonRows([]);
    setSeasonError("");
    setDetailOpen(false);
    setSelectedPlayer(null);
    setHasResults(false);
    setActiveTeamId("");
    setActiveYear("");
    setActiveType(defaultType);
  };

  useEffect(() => {
    void runSearch({ teamId: defaultTeamId, year: defaultYear, type: defaultType });
  }, []);

  return (
    <div className="page">
      <div className="phone">
        <div className="scroll">
          <section className="hero">
            <h1>NPB Team Stats Explorer</h1>
            <p>2000-latest</p>
          </section>

          <section>
            <h2 className="sectionTitle">Filters</h2>
            <div className="filters">
              <div className="grid2">
                <SelectField label="League" value={pendingLeague} onChange={handleLeagueChange} options={LEAGUE_OPTIONS} placeholder="Select league" />
                <SelectField label="Team" value={pendingTeamId} onChange={setPendingTeamId} options={filteredTeams} placeholder="Select team" />
              </div>
              <SelectField label="Year" value={pendingYear} onChange={setPendingYear} options={yearOptions} placeholder="Select year" />
              <SelectField label="Types" value={pendingType} onChange={setPendingType} options={TYPE_OPTIONS} placeholder="Select types" />
              <div className="grid2">
                <ActionButton onClick={() => void runSearch()} disabled={loadingSeason}>Apply</ActionButton>
                <ActionButton variant="secondary" onClick={clearFilters} disabled={loadingSeason}>Clear</ActionButton>
              </div>
            </div>
          </section>

          <section>
            <div className="sectionHead">
              <div>
                <h2 className="sectionTitle accent">Team Stats</h2>
                <p className="muted">{hasResults && activeTeam ? `${activeYear} ${activeTeam.fullName}` : "Stats Preview"}</p>
              </div>
            </div>

            {loadingSeason ? (
              <div className="message"><Loader2 className="spinner" /><span>Loading stats...</span></div>
            ) : seasonError ? (
              <div className="message">{seasonError}</div>
            ) : !hasResults ? (
              <div className="message">No data loaded.</div>
            ) : (
              <DataTable config={tableConfig} rows={sortedMainRows} emptyText="No data found." onSort={(key) => setSortConfig((prev) => ({ key, direction: getNextDirection(prev, key) }))} sortConfig={sortConfig} onPlayerClick={(row) => { setSelectedPlayer(row); setDetailOpen(true); }} />
            )}
          </section>
        </div>

        {detailOpen && selectedPlayer && (
          <div className="detail">
            <div className="detailTop">
              <button className="back" type="button" onClick={() => setDetailOpen(false)}>
                <ChevronLeft size={22} />
              </button>
              <div className="detailPlayer">
                <div className="portraitBlock">
                  <h2>{selectedPlayer.player}</h2>
                  <div className="portrait">
                    {selectedPlayer.imageUrl ? <img src={selectedPlayer.imageUrl} alt={selectedPlayer.player} /> : <div className="portraitFallback">{selectedPlayer.teamCode}</div>}
                  </div>
                </div>
                <div className="careerPanel">
                  <p>Career Stats</p>
                  <CareerGrid cards={tableConfig.careerCards} career={careerStats} />
                </div>
              </div>
            </div>
            <div className="detailBody">
              <DataTable config={tableConfig} rows={detailRows} emptyText="No historical stats found." sortConfig={null} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
