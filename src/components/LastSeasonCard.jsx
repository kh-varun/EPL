function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function positionTone(position, totalTeams) {
  if (position <= 4) return "text-emerald-400";
  if (position === 5) return "text-sky-400";
  if (totalTeams && position > totalTeams - 3) return "text-rose-400";
  return "text-white";
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function LastSeasonCard({ record, seasonLabel, totalTeams }) {
  if (!record) return null;

  return (
    <section className="bg-epl-surface rounded-2xl shadow-lg ring-1 ring-white/10 p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-white mb-3">
        Last season {seasonLabel ? `· ${seasonLabel}` : ""}
      </h2>

      <div className="flex items-center gap-4 mb-3">
        <div className="text-center shrink-0">
          <p
            className={
              "text-3xl font-extrabold leading-none " +
              positionTone(record.position, totalTeams)
            }
          >
            {ordinal(record.position)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-white/40 mt-1">Finished</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-2xl font-extrabold text-white tabular-nums leading-none">
            {record.points}
            <span className="text-sm font-semibold text-white/40 ml-1">pts</span>
          </p>
          <p className="text-xs text-white/50 mt-1 tabular-nums">
            {record.won}W · {record.draw}D · {record.lost}L in {record.playedGames}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Scored" value={record.goalsFor} />
        <Stat label="Conceded" value={record.goalsAgainst} />
        <Stat
          label="Goal diff"
          value={record.goalDifference > 0 ? `+${record.goalDifference}` : record.goalDifference}
        />
      </div>
    </section>
  );
}
