const HIGHLIGHT_TLA = "MCI";

function zoneColor(position) {
  if (position <= 4) return "bg-emerald-500"; // Champions League
  if (position === 5) return "bg-sky-400"; // Europa/Conference
  if (position >= 18) return "bg-rose-500"; // Relegation
  return "bg-transparent";
}

export default function StandingsTable({ standings, onSelectTeam }) {
  if (!standings?.length) {
    return <p className="text-sm text-white/50">Standings not available yet.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[580px] text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
              <th className="py-2 w-1.5 sticky left-0 bg-epl-surface" />
              <th className="py-2 pr-2 w-6 sticky left-1.5 bg-epl-surface">#</th>
              <th className="py-2 pr-3 sticky left-[26px] bg-epl-surface">Team</th>
              <th className="py-2 px-1.5 text-center">P</th>
              <th className="py-2 px-1.5 text-center">W</th>
              <th className="py-2 px-1.5 text-center">D</th>
              <th className="py-2 px-1.5 text-center">L</th>
              <th className="py-2 px-1.5 text-center">GF</th>
              <th className="py-2 px-1.5 text-center">GA</th>
              <th className="py-2 px-1.5 text-center">GD</th>
              <th className="py-2 pl-1.5 text-center font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => {
              const isHighlighted = row.team.tla === HIGHLIGHT_TLA;
              const rowBg = isHighlighted ? "bg-epl-cyan/10" : "bg-epl-surface";
              return (
                <tr key={row.team.id} className={"border-t border-white/10 " + rowBg}>
                  <td className={"sticky left-0 " + rowBg}>
                    <div className={"h-full w-1.5 " + zoneColor(row.position)} />
                  </td>
                  <td className={"py-2 pr-2 text-white/50 tabular-nums sticky left-1.5 " + rowBg}>
                    {row.position}
                  </td>
                  <td className={"py-2 pr-3 sticky left-[26px] " + rowBg}>
                    <button
                      type="button"
                      onClick={() => onSelectTeam(row.team)}
                      className="flex items-center gap-2 text-left"
                    >
                      <img
                        src={row.team.crest}
                        alt=""
                        className="h-6 w-6 shrink-0"
                        loading="lazy"
                      />
                      <span
                        className={
                          "underline decoration-white/20 whitespace-nowrap text-white " +
                          (isHighlighted ? "font-bold text-epl-cyan" : "")
                        }
                      >
                        {row.team.shortName}
                      </span>
                    </button>
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.playedGames}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.won}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.draw}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.lost}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.goalsFor}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.goalsAgainst}
                  </td>
                  <td className="py-2 px-1.5 text-center tabular-nums text-white/80">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="py-2 pl-1.5 text-center font-extrabold tabular-nums text-white">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Champions League
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-400" /> Europa/Conference
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-rose-500" /> Relegation
        </span>
      </div>
    </div>
  );
}
