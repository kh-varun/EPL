import { formatMatchDateTime } from "../lib/format.js";

function TeamLabel({ team, align, onSelectTeam }) {
  return (
    <button
      type="button"
      onClick={() => onSelectTeam(team)}
      className={`flex items-center gap-1.5 min-w-0 text-left ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <img src={team.crest} alt="" className="h-5 w-5 shrink-0" loading="lazy" />
      <span className="truncate text-sm font-medium underline decoration-epl-purple/20">
        {team.shortName}
      </span>
    </button>
  );
}

export default function MatchRow({ match, showScore, onSelectTeam }) {
  const hasScore = showScore && match.score.home !== null && match.score.away !== null;

  return (
    <li className="py-2.5 border-t border-epl-purple/10 first:border-t-0">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <TeamLabel team={match.homeTeam} onSelectTeam={onSelectTeam} />
        </div>

        {hasScore && (
          <span className="shrink-0 text-sm font-bold tabular-nums px-1">
            {match.score.home}–{match.score.away}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <TeamLabel team={match.awayTeam} align="right" onSelectTeam={onSelectTeam} />
        </div>
      </div>

      {!hasScore && (
        <div className="mt-1 text-center text-xs text-epl-purple/50">
          {formatMatchDateTime(match.utcDate)}
        </div>
      )}
    </li>
  );
}
