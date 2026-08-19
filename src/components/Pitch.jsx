const POSITION_ROWS = [
  { position: "Offence", max: 3 },
  { position: "Midfield", max: 3 },
  { position: "Defence", max: 4 },
  { position: "Goalkeeper", max: 1 },
];

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function pickFormation(squad) {
  return POSITION_ROWS.map(({ position, max }) => ({
    position,
    players: squad.filter((p) => p.position === position).slice(0, max),
  })).filter((row) => row.players.length > 0);
}

function PlayerChip({ player }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className="h-10 w-10 rounded-full bg-white text-epl-purple font-extrabold text-sm flex items-center justify-center shadow-md ring-2 ring-white/60">
        {initials(player.name)}
      </div>
      <span className="text-[10px] font-semibold text-white text-center leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] line-clamp-2">
        {player.name}
      </span>
    </div>
  );
}

export default function Pitch({ squad }) {
  const rows = pickFormation(squad);
  const totalPlayers = rows.reduce((sum, row) => sum + row.players.length, 0);

  if (totalPlayers === 0) {
    return <p className="text-sm text-epl-purple/60">Not enough squad data for a formation view.</p>;
  }

  return (
    <div>
      <div
        className="relative rounded-2xl overflow-hidden ring-1 ring-black/10 p-4 flex flex-col justify-between gap-4"
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
          <div key={row.position} className="relative z-10 flex justify-evenly">
            {row.players.map((player) => (
              <PlayerChip key={player.id} player={player} />
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-epl-purple/50 text-center">
        Illustrative lineup from the squad list, in a 4-3-3 shape — not the confirmed match-day XI
        (not available from this dashboard&apos;s free data source).
      </p>
    </div>
  );
}
