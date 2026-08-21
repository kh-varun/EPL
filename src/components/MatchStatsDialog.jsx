import { formatMatchDateTime } from "../lib/format.js";

const STAT_ROWS = [
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on target" },
  { key: "possession", label: "Possession", suffix: "%" },
  { key: "passes", label: "Passes" },
  { key: "passAccuracy", label: "Pass accuracy", suffix: "%" },
  { key: "fouls", label: "Fouls" },
  { key: "corners", label: "Corners" },
  { key: "offsides", label: "Offsides" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
];

function StatRow({ label, home, away, suffix = "" }) {
  if (home == null && away == null) return null;
  const homeWins = home != null && (away == null || home > away);
  const awayWins = away != null && (home == null || away > home);

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span
        className={
          "w-12 text-right text-sm font-extrabold tabular-nums " +
          (homeWins ? "text-epl-magenta" : "text-white/70")
        }
      >
        {home != null ? `${home}${suffix}` : "–"}
      </span>
      <span className="flex-1 text-center text-xs text-white/50">{label}</span>
      <span
        className={
          "w-12 text-left text-sm font-extrabold tabular-nums " +
          (awayWins ? "text-epl-cyan" : "text-white/70")
        }
      >
        {away != null ? `${away}${suffix}` : "–"}
      </span>
    </div>
  );
}

export default function MatchStatsDialog({ match, stats, onClose }) {
  const homeStats = stats?.[match.homeTeam.id];
  const awayStats = stats?.[match.awayTeam.id];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-epl-surface rounded-t-2xl sm:rounded-2xl ring-1 ring-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-epl-gradient p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wide text-white/70">
              Matchday {match.matchday} · {formatMatchDateTime(match.utcDate)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center text-base"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <img src={match.homeTeam.crest} alt="" className="h-10 w-10" />
              <span className="text-sm font-bold text-white text-center truncate max-w-full">
                {match.homeTeam.shortName}
              </span>
            </div>
            <span className="text-white text-lg font-extrabold tabular-nums shrink-0">
              {match.score.home} – {match.score.away}
            </span>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <img src={match.awayTeam.crest} alt="" className="h-10 w-10" />
              <span className="text-sm font-bold text-white text-center truncate max-w-full">
                {match.awayTeam.shortName}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {homeStats && awayStats ? (
            <div className="divide-y divide-white/5">
              {STAT_ROWS.map(({ key, label, suffix }) => (
                <StatRow
                  key={key}
                  label={label}
                  home={homeStats[key]}
                  away={awayStats[key]}
                  suffix={suffix}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">
              No detailed stats available for this match yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
