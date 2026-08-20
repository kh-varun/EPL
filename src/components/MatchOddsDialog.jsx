import { formatMatchDateTime } from "../lib/format.js";

function OddsBar({ label, crest, probability, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {crest && <img src={crest} alt="" className="h-4 w-4" />}
          {label}
        </span>
        <span className="text-sm font-extrabold text-white tabular-nums">{probability}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${probability}%` }} />
      </div>
    </div>
  );
}

export default function MatchOddsDialog({ match, odds, onClose }) {
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
            <span className="text-white/40 text-xs font-bold shrink-0">VS</span>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <img src={match.awayTeam.crest} alt="" className="h-10 w-10" />
              <span className="text-sm font-bold text-white text-center truncate max-w-full">
                {match.awayTeam.shortName}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {odds ? (
            <>
              <div className="space-y-3">
                {odds.home && (
                  <OddsBar
                    label={odds.home.label}
                    crest={match.homeTeam.crest}
                    probability={odds.home.probability}
                    tone="bg-epl-magenta"
                  />
                )}
                {odds.draw && (
                  <OddsBar label="Draw" probability={odds.draw.probability} tone="bg-white/50" />
                )}
                {odds.away && (
                  <OddsBar
                    label={odds.away.label}
                    crest={match.awayTeam.crest}
                    probability={odds.away.probability}
                    tone="bg-epl-cyan"
                  />
                )}
              </div>

              {odds.kalshiUrl && (
                <a
                  href={odds.kalshiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs font-bold text-epl-cyan hover:underline"
                >
                  View live market on Kalshi ↗
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-white/50">
              No Kalshi market found for this match yet. Markets for later fixtures sometimes
              aren&apos;t listed until closer to matchday.
            </p>
          )}

          <p className="text-xs text-white/30 border-t border-white/10 pt-3">
            Prices are live implied probabilities from{" "}
            <a
              href="https://kalshi.com/category/sports/soccer/epl"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Kalshi
            </a>
            , a CFTC-regulated prediction market where these are real-money contracts. This is
            informational only, not betting advice, and reflects what traders currently think —
            not a guaranteed outcome.
          </p>
        </div>
      </div>
    </div>
  );
}
