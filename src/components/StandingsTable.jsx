const HIGHLIGHT_TLA = "MCI";

export default function StandingsTable({ standings, onSelectTeam }) {
  if (!standings?.length) {
    return <p className="text-sm text-epl-purple/60">Standings not available yet.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[420px] text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-epl-purple/50">
            <th className="py-2 pr-2 w-6">#</th>
            <th className="py-2 pr-2">Team</th>
            <th className="py-2 px-1.5 text-center">P</th>
            <th className="py-2 px-1.5 text-center">GD</th>
            <th className="py-2 pl-1.5 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const isHighlighted = row.team.tla === HIGHLIGHT_TLA;
            return (
              <tr
                key={row.team.id}
                className={
                  "border-t border-epl-purple/10 " +
                  (isHighlighted ? "bg-epl-cyan/20" : "")
                }
              >
                <td className="py-2 pr-2 text-epl-purple/60 tabular-nums">{row.position}</td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => onSelectTeam(row.team)}
                    className="flex items-center gap-2 text-left"
                  >
                    <img
                      src={row.team.crest}
                      alt=""
                      className="h-5 w-5 shrink-0"
                      loading="lazy"
                    />
                    <span
                      className={
                        "underline decoration-epl-purple/20 " + (isHighlighted ? "font-semibold" : "")
                      }
                    >
                      {row.team.shortName}
                    </span>
                  </button>
                </td>
                <td className="py-2 px-1.5 text-center tabular-nums">{row.playedGames}</td>
                <td className="py-2 px-1.5 text-center tabular-nums">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="py-2 pl-1.5 text-center font-semibold tabular-nums">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
