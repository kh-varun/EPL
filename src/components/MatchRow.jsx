import { formatMatchDate, formatMatchDateTime } from "../lib/format.js";

function TeamColumn({ team, position, onSelectTeam }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelectTeam?.(team);
      }}
      className="flex flex-1 min-w-0 flex-col items-center gap-1.5 text-center"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105">
        <img src={team.crest} alt="" className="h-9 w-9" loading="lazy" />
      </span>
      <span className="flex items-center gap-1 min-w-0 max-w-full">
        {position != null && (
          <span className="shrink-0 text-[10px] font-bold text-white/40 tabular-nums">
            {position}
          </span>
        )}
        <span className="truncate text-xs font-semibold text-white/90">
          {team.shortName}
        </span>
      </span>
    </button>
  );
}

function OddsPreview({ odds }) {
  if (!odds?.home || !odds?.draw || !odds?.away) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="h-2 rounded-full overflow-hidden flex ring-1 ring-inset ring-white/10">
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

export default function MatchRow({ match, showScore, positions, onSelectTeam, onSelectMatch, odds }) {
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
        "group rounded-2xl bg-epl-card ring-1 p-3.5 transition-all duration-200" +
        (isLive
          ? " ring-red-500/50 shadow-glow-red"
          : hasBroadcast
            ? " ring-orange-500/40"
            : " ring-white/10") +
        (clickable
          ? " cursor-pointer hover:-translate-y-0.5 hover:ring-white/25 hover:shadow-card"
          : "")
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
          <span>
            {hasScore ? formatMatchDate(match.utcDate) : formatMatchDateTime(match.utcDate)}
          </span>
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
        <TeamColumn
          team={match.homeTeam}
          position={positions?.[match.homeTeam.id]}
          onSelectTeam={onSelectTeam}
        />

        <div className="shrink-0 flex flex-col items-center justify-center px-1">
          {hasScore ? (
            <div
              className={
                "flex items-center gap-1.5 rounded-full text-white px-3.5 py-1.5 text-base font-black tabular-nums" +
                (isLive ? " bg-red-600 shadow-glow-red" : " bg-epl-magenta shadow-glow-magenta")
              }
            >
              <span className={awayWon ? "opacity-50" : ""}>{match.score.home}</span>
              <span className="opacity-40">–</span>
              <span className={homeWon ? "opacity-50" : ""}>{match.score.away}</span>
            </div>
          ) : (
            <div className="rounded-full bg-white/5 ring-1 ring-white/15 text-white/70 px-3 py-1.5 text-[11px] font-bold tracking-widest">
              VS
            </div>
          )}
        </div>

        <TeamColumn
          team={match.awayTeam}
          position={positions?.[match.awayTeam.id]}
          onSelectTeam={onSelectTeam}
        />
      </div>

      {clickable && !hasScore && <OddsPreview odds={odds} />}
    </li>
  );
}
