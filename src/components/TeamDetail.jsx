import { useState } from "react";
import { ChevronLeftIcon, ShirtIcon, PitchIcon } from "./icons.jsx";
import Pitch from "./Pitch.jsx";

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
  const [view, setView] = useState("squad");
  const squad = teamData?.squad ?? [];
  const groups = groupByPosition(squad);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      <header className="bg-epl-gradient text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
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

        {squad.length > 0 && (
          <div className="max-w-2xl mx-auto mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setView("squad")}
              className={
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide transition-all " +
                (view === "squad" ? "bg-white text-epl-purple shadow-md" : "text-white/70")
              }
            >
              <ShirtIcon className="h-4 w-4" /> Squad
            </button>
            <button
              type="button"
              onClick={() => setView("formation")}
              className={
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide transition-all " +
                (view === "formation" ? "bg-white text-epl-purple shadow-md" : "text-white/70")
              }
            >
              <PitchIcon className="h-4 w-4" /> Formation
            </button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {!teamData && <p className="text-sm text-epl-purple/60">Squad data not available.</p>}

        {teamData && view === "formation" && <Pitch squad={squad} />}

        {teamData &&
          view === "squad" &&
          groups.map(([position, players]) => (
            <section
              key={position}
              className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4"
            >
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-epl-purple mb-2">
                {POSITION_LABELS[position] ?? position}
              </h2>
              <ul className="space-y-1">
                {players.map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 py-1.5 border-t border-epl-purple/10 first:border-t-0"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-epl-purple/10 text-epl-purple text-xs font-extrabold flex items-center justify-center">
                      {initials(player.name)}
                    </div>
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">
                      {player.name}
                    </span>
                    <span className="text-xs text-epl-purple/50 shrink-0">
                      {player.nationality}
                    </span>
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
