const POSITION_LABELS = {
  Goalkeeper: "Goalkeepers",
  Defence: "Defenders",
  Midfield: "Midfielders",
  Offence: "Forwards",
};

const POSITION_ORDER = ["Goalkeeper", "Defence", "Midfield", "Offence"];

function groupByPosition(squad) {
  const groups = new Map(POSITION_ORDER.map((pos) => [pos, []]));
  for (const player of squad) {
    if (!groups.has(player.position)) groups.set(player.position, []);
    groups.get(player.position).push(player);
  }
  return [...groups.entries()].filter(([, players]) => players.length > 0);
}

export default function TeamDetail({ team, teamData, onClose }) {
  const squad = teamData?.squad ?? [];
  const groups = groupByPosition(squad);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      <header className="bg-epl-purple text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Back"
          >
            ← Back
          </button>
          <img src={team.crest} alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight truncate">{team.name}</h1>
            {teamData?.coach && <p className="text-xs text-white/70">Coach: {teamData.coach}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {!teamData && (
          <p className="text-sm text-epl-purple/60">Squad data not available.</p>
        )}

        {groups.map(([position, players]) => (
          <section
            key={position}
            className="bg-white rounded-xl shadow-sm border border-epl-purple/10 p-4"
          >
            <h2 className="text-sm font-bold uppercase tracking-wide text-epl-purple mb-2">
              {POSITION_LABELS[position] ?? position}
            </h2>
            <ul>
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between py-2 border-t border-epl-purple/10 first:border-t-0"
                >
                  <span className="text-sm font-medium">{player.name}</span>
                  <span className="text-xs text-epl-purple/50">{player.nationality}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs text-epl-purple/40 text-center pt-2">
          Full squad roster. Match-day starting lineups and injury status aren&apos;t available
          from the free data source this dashboard uses.
        </p>
      </main>
    </div>
  );
}
