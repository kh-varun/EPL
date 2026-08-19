import { formatMatchDateTime } from "../lib/format.js";

function TeamColumn({ team, onSelectTeam }) {
  return (
    <button
      type="button"
      onClick={() => onSelectTeam(team)}
      className="flex flex-1 min-w-0 flex-col items-center gap-1.5 text-center"
    >
      <img src={team.crest} alt="" className="h-10 w-10 shrink-0" loading="lazy" />
      <span className="truncate max-w-full text-xs font-semibold text-white underline decoration-white/20">
        {team.shortName}
      </span>
    </button>
  );
}

export default function MatchRow({ match, showScore, onSelectTeam }) {
  const hasScore = showScore && match.score.home !== null && match.score.away !== null;
  const homeWon = hasScore && match.score.home > match.score.away;
  const awayWon = hasScore && match.score.away > match.score.home;

  return (
    <li className="rounded-xl bg-epl-surface2 ring-1 ring-white/10 p-3">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
        <span>Matchday {match.matchday}</span>
        {!hasScore && <span>{formatMatchDateTime(match.utcDate)}</span>}
      </div>

      <div className="flex items-center gap-2">
        <TeamColumn team={match.homeTeam} onSelectTeam={onSelectTeam} />

        <div className="shrink-0 flex flex-col items-center justify-center px-1">
          {hasScore ? (
            <div className="flex items-center gap-1.5 rounded-full bg-epl-magenta text-white px-3 py-1 text-sm font-extrabold tabular-nums">
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
    </li>
  );
}
