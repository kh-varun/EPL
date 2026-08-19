import { useState } from "react";
import { ChevronLeftIcon } from "./icons.jsx";
import Pitch from "./Pitch.jsx";
import PlayerDialog from "./PlayerDialog.jsx";

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

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function TeamDetail({ team, teamData, onClose }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const squad = teamData?.squad ?? [];
  const groups = groupByPosition(squad);

  return (
    <div className="fixed inset-0 z-50 bg-epl-bg overflow-y-auto">
      <header className="bg-epl-gradient text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 -ml-1 text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <img src={team.crest} alt="" className="h-9 w-9 shrink-0 drop-shadow" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight truncate">{team.name}</h1>
            {teamData?.coach && <p className="text-xs text-white/70">Coach: {teamData.coach}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {!teamData && <p className="text-sm text-white/50">Squad data not available.</p>}

        {teamData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              {groups.map(([position, players]) => (
                <section
                  key={position}
                  className="bg-epl-surface rounded-2xl shadow-lg ring-1 ring-white/10 p-4"
                >
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-white mb-2">
                    {POSITION_LABELS[position] ?? position}
                  </h2>
                  <ul className="space-y-1">
                    {players.map((player) => (
                      <li key={player.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayer(player)}
                          className="w-full flex items-center gap-3 py-1.5 border-t border-white/10 first:border-t-0 text-left hover:bg-white/5 rounded-md px-1 -mx-1 transition-colors"
                        >
                          <div className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white text-xs font-extrabold flex items-center justify-center">
                            {initials(player.name)}
                          </div>
                          <span className="flex-1 min-w-0 text-sm font-medium truncate text-white">
                            {player.name}
                          </span>
                          <span className="text-xs text-white/40 shrink-0">
                            {player.nationality}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="lg:sticky lg:top-20 bg-epl-surface rounded-2xl shadow-lg ring-1 ring-white/10 p-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-white mb-2">
                Formation
              </h2>
              <Pitch squad={squad} onSelectPlayer={setSelectedPlayer} />
            </div>
          </div>
        )}

        <p className="text-xs text-white/30 text-center pt-4">
          Full squad roster. Match-day starting lineups and injury status aren&apos;t available
          from the free data source this dashboard uses.
        </p>
      </main>

      {selectedPlayer && (
        <PlayerDialog
          player={selectedPlayer}
          team={team}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
