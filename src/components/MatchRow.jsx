import { formatMatchDateTime } from "../lib/format.js";

function TeamColumn({ team, onSelectTeam }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelectTeam(team);
      }}
      className="flex flex-1 min-w-0 flex-col items-center gap-1.5 text-center"
    >
      <img src={team.crest} alt="" className="h-10 w-10 shrink-0" loading="lazy" />
      <span className="truncate max-w-full text-xs font-semibold text-white underline decoration-white/20">
        {team.shortName}
      </span>
    </button>
  );
}

function OddsPreview({ odds }) {
  if (!odds?.home || !odds?.draw || !odds?.away) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-white/10">
      <div className="h-1.5 rounded-full overflow-hidden flex">
        <div className="bg-epl-magenta h-full" style={{ width: `${odds.home.probability}%` }} />
        <div className="bg-white/40 h-full" style={{ width: `${odds.draw.probability}%` }} />
        <div className="bg-epl-cyan h-full" style={{ width: `${odds.away.probability}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-white/50 tabular-nums">
        <span>{odds.home.probability}%</span>
        <span>Draw {odds.draw.probability}%</span>
        <span>{odds.away.probability}%</span>
      </div>
    </div>
  );
}

const LIVE_STATUS_LABELS = {
  IN_PLAY: "LIVE",
  PAUSED: "HT",
};

export default function MatchRow({ match, showScore, onSelectTeam, onSelectMatch, odds }) {
  const isLive = Boolean(match.liveStatus);
  const hasScore = showScore && match.score.home !== null && match.score.away !== null;
  const homeWon = !isLive && hasScore && match.score.home > match.score.away;
  const awayWon = !isLive && hasScore && match.score.away > match.score.home;
  const clickable = Boolean(onSelectMatch);
  const hasBroadcast = !isLive && !hasScore && Boolean(match.broadcast);

  return (
    <li
      onClick={clickable ? () => onSelectMatch(match) : undefined}
      className={
        "rounded-xl bg-epl-surface2 ring-1 p-3" +
        (isLive ? " ring-red-500/40" : hasBroadcast ? " ring-orange-500/50" : " ring-white/10") +
        (clickable ? " cursor-pointer hover:ring-white/20 transition-shadow" : "")
      }
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
        <span>Matchday {match.matchday}</span>
        {isLive ? (
          <span className="flex items-center gap-1 text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            {LIVE_STATUS_LABELS[match.liveStatus] ?? match.liveStatus}
          </span>
        ) : (
          !hasScore && <span>{formatMatchDateTime(match.utcDate)}</span>
        )}
      </div>

      {hasBroadcast && (
        <div className="flex justify-end mb-2 -mt-1">
          <span className="rounded-full bg-orange-500/15 text-orange-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Streaming on {match.broadcast}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <TeamColumn team={match.homeTeam} onSelectTeam={onSelectTeam} />

        <div className="shrink-0 flex flex-col items-center justify-center px-1">
          {hasScore ? (
            <div
              className={
                "flex items-center gap-1.5 rounded-full text-white px-3 py-1 text-sm font-extrabold tabular-nums" +
                (isLive ? " bg-red-600" : " bg-epl-magenta")
              }
            >
              <span className={awayWon ? "opacity-50" : ""}>{match.score.home}</span>
              <span className="opacity-50">–</span>
              <span className={homeWon ? "opacity-50" : ""}>{match.score.away}</span>
            </div>
          ) : (
            <div className="rounded-full bg-white/10 text-white px-2.5 py-1 text-xs font-bold">
              VS
            </div>
          )}
        </div>

        <TeamColumn team={match.awayTeam} onSelectTeam={onSelectTeam} />
      </div>

      {clickable && !hasScore && <OddsPreview odds={odds} />}
    </li>
  );
}
