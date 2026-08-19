const POSITION_ROWS = [
  { position: "Offence", max: 3 },
  { position: "Midfield", max: 3 },
  { position: "Defence", max: 4 },
  { position: "Goalkeeper", max: 1 },
];

// API-Football position codes, back line last so rows render goal-upward.
const CONFIRMED_ROW_ORDER = ["F", "M", "D", "G"];

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function pickIllustrative(squad) {
  return POSITION_ROWS.map(({ position, max }) => ({
    key: position,
    players: squad.filter((p) => p.position === position).slice(0, max),
  })).filter((row) => row.players.length > 0);
}

function groupConfirmed(startXI) {
  return CONFIRMED_ROW_ORDER.map((code) => ({
    key: code,
    players: startXI.filter((p) => p.position === code),
  })).filter((row) => row.players.length > 0);
}

function PlayerChip({ player, onSelectPlayer }) {
  return (
    <button
      type="button"
      onClick={() => onSelectPlayer?.(player)}
      className="flex flex-col items-center gap-1 w-16"
    >
      <div className="relative h-10 w-10 rounded-full bg-white text-epl-purple font-extrabold text-sm flex items-center justify-center shadow-md ring-2 ring-white/60">
        {initials(player.name)}
        {player.number != null && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-epl-magenta text-white text-[9px] font-bold flex items-center justify-center">
            {player.number}
          </span>
        )}
      </div>
      <span className="text-[10px] font-semibold text-white text-center leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] line-clamp-2">
        {player.name}
      </span>
    </button>
  );
}

export default function Pitch({ squad, confirmed, onSelectPlayer }) {
  const isConfirmed = Boolean(confirmed?.startXI?.length);
  const rows = isConfirmed ? groupConfirmed(confirmed.startXI) : pickIllustrative(squad);
  const totalPlayers = rows.reduce((sum, row) => sum + row.players.length, 0);

  if (totalPlayers === 0) {
    return <p className="text-sm text-white/50">Not enough squad data for a formation view.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (isConfirmed ? "bg-emerald-500 text-white" : "bg-white/10 text-white/60")
          }
        >
          {isConfirmed ? "Confirmed XI" : "Illustrative"}
        </span>
        {isConfirmed && confirmed.formation && (
          <span className="text-xs font-bold text-white/70">{confirmed.formation}</span>
        )}
      </div>

      <div
        className="relative rounded-2xl overflow-hidden ring-1 ring-black/20 p-4 flex flex-col justify-between gap-4"
        style={{
          minHeight: 420,
          backgroundImage:
            "repeating-linear-gradient(0deg, #0a6b3a 0, #0a6b3a 40px, #095e33 40px, #095e33 80px)",
        }}
      >
        <div className="absolute inset-3 border-2 border-white/30 rounded-lg pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full border-2 border-white/30 pointer-events-none" />
        <div className="absolute left-1/2 top-3 -translate-x-1/2 h-14 w-32 border-2 border-t-0 border-white/30 pointer-events-none" />
        <div className="absolute left-1/2 bottom-3 -translate-x-1/2 h-14 w-32 border-2 border-b-0 border-white/30 pointer-events-none" />

        {rows.map((row) => (
          <div key={row.key} className="relative z-10 flex justify-evenly">
            {row.players.map((player) => (
              <PlayerChip key={player.id} player={player} onSelectPlayer={onSelectPlayer} />
            ))}
          </div>
        ))}
      </div>

      {isConfirmed && confirmed.substitutes?.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-white/50 mb-1.5">
            Substitutes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {confirmed.substitutes.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelectPlayer?.(player)}
                className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 hover:bg-white/20 transition-colors"
              >
                {player.number != null && (
                  <span className="text-white/40 mr-1">{player.number}</span>
                )}
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-white/40 text-center">
        {isConfirmed ? (
          <>
            Official team sheet for the next match, via API-Football. Tap a player for details.
          </>
        ) : (
          <>
            Illustrative lineup from the squad list, in a 4-3-3 shape — not the confirmed
            match-day XI. Official team sheets are only published ~40 minutes before kickoff, and
            this switches to the real XI automatically once one is out. Tap a player for details.
          </>
        )}
      </p>
    </div>
  );
}
