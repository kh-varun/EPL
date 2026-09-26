const HIGHLIGHT_TLA = "MCI";

function zoneColor(position) {
  if (position <= 4) return "bg-emerald-500"; // Champions League
  if (position === 5) return "bg-sky-400"; // Europa/Conference
  if (position >= 18) return "bg-rose-500"; // Relegation
  return "bg-transparent";
}

// showZones defaults on for the Premier League table (Champions League/
// Europa/relegation zones), but a reused competition's own qualification
// structure is different (the Champions League table's teams are, by
// definition, already in the Champions League) - the Champions League tab
// passes showZones={false} so it doesn't paint a misleading legend.
export default function StandingsTable({ standings, onSelectTeam, showZones = true }) {
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
              // Sticky cells need an opaque background to occlude the row's
              // scrolling cells sliding beneath them; group-hover lightens
              // the whole row together (the highlighted row keeps its cyan
              // tint instead).
              const rowBg = isHighlighted
                ? "bg-epl-cyan/10"
                : "bg-epl-surface group-hover:bg-epl-surface2";
              return (
                <tr
                  key={row.team.id}
                  className="group border-t border-white/5 transition-colors"
                >
                  <td className={"sticky left-0 " + rowBg}>
                    <div
                      className={
                        "mx-auto h-5 w-1 rounded-full " +
                        (showZones ? zoneColor(row.position) : "")
                      }
                    />
                  </td>
                  <td className={"py-2.5 pr-2 text-white/45 tabular-nums sticky left-1.5 " + rowBg}>
                    {row.position}
                  </td>
                  <td className={"py-2.5 pr-3 sticky left-[26px] " + rowBg}>
                    <button
                      type="button"
                      onClick={() => onSelectTeam?.(row.team)}
                      className="flex items-center gap-2 text-left"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
                        <img
                          src={row.team.crest}
                          alt=""
                          className="h-5 w-5"
                          loading="lazy"
                        />
                      </span>
                      <span
                        className={
                          "whitespace-nowrap text-white transition-colors group-hover:text-epl-cyan " +
                          (isHighlighted ? "font-bold text-epl-cyan" : "font-medium")
                        }
                      >
                        {row.team.shortName}
                      </span>
                    </button>
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-white/80">
                    {row.playedGames}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-emerald-300/90">
                    {row.won}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-white/60">
                    {row.draw}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-rose-300/80">
                    {row.lost}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-white/80">
                    {row.goalsFor}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-white/80">
                    {row.goalsAgainst}
                  </td>
                  <td className="py-2.5 px-1.5 text-center tabular-nums text-white/70">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="py-2.5 pl-1.5 text-center font-black tabular-nums text-white">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showZones && (
        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Champions League
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Europa/Conference
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Relegation
          </span>
        </div>
      )}
    </div>
  );
}
