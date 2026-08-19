import { useEffect, useState } from "react";

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const diffMs = Date.now() - dob.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

async function fetchWikipediaSummary(name) {
  const attempts = [name, `${name} (footballer)`];

  for (const title of attempts) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type === "disambiguation") continue;
      if (data.extract) return data;
    } catch {
      // try next title / fall through to null below
    }
  }
  return null;
}

// Matches the name-normalisation used when history.json is built, so a
// player keyed as "marc guehi" still resolves from "Marc Guéhi".
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function SeasonStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function PlayerDialog({ player, team, history, onClose }) {
  const [bio, setBio] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    setBio({ status: "loading", data: null });

    fetchWikipediaSummary(player.name).then((data) => {
      if (cancelled) return;
      setBio(data ? { status: "found", data } : { status: "not-found", data: null });
    });

    return () => {
      cancelled = true;
    };
  }, [player.name]);

  const age = calculateAge(player.dateOfBirth);
  const lastSeason = history?.playersAvailable
    ? history.players?.[normalizeName(player.name)]
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-epl-surface rounded-t-2xl sm:rounded-2xl ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-epl-surface flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {bio.data?.thumbnail?.source ? (
              <img
                src={bio.data.thumbnail.source}
                alt=""
                className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-white/10"
              />
            ) : (
              <img src={team.crest} alt="" className="h-10 w-10 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-white truncate">{player.name}</h3>
              <p className="text-xs text-white/50">{team.shortName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 flex items-center justify-center text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/40">Position</p>
              <p className="text-sm font-semibold text-white">
                {player.positionLabel ?? player.position}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/40">Age</p>
              <p className="text-sm font-semibold text-white">{age ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/40">Nationality</p>
              <p className="text-sm font-semibold text-white">{player.nationality}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/40">Born</p>
              <p className="text-sm font-semibold text-white">{player.dateOfBirth ?? "—"}</p>
            </div>
          </div>

          {lastSeason && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-white/50 mb-1.5">
                Last season ({history.seasonLabel})
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <SeasonStat label="Apps" value={lastSeason.appearances} />
                <SeasonStat label="Goals" value={lastSeason.goals} />
                <SeasonStat label="Assists" value={lastSeason.assists} />
                <SeasonStat label="Rating" value={lastSeason.rating ?? "—"} />
              </div>
            </div>
          )}

          {!lastSeason && history && !history.playersAvailable && (
            <p className="text-xs text-white/30 italic">
              Last season&apos;s player stats aren&apos;t available right now (API-Football&apos;s
              free plan restricts historical player data).
            </p>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-white/50 mb-1.5">
              About
            </h4>
            {bio.status === "loading" && (
              <p className="text-sm text-white/40 italic">Loading bio from Wikipedia…</p>
            )}
            {bio.status === "found" && (
              <p className="text-sm text-white/80 leading-relaxed">{bio.data.extract}</p>
            )}
            {bio.status === "not-found" && (
              <p className="text-sm text-white/40 italic">
                No Wikipedia summary found for this player.
              </p>
            )}
          </div>

          <p className="text-xs text-white/30 border-t border-white/10 pt-3">
            Live, in-progress stats for the current season aren&apos;t available from this
            dashboard&apos;s free data source. The bio above is pulled live from Wikipedia and may
            occasionally match the wrong person for common names.
          </p>
        </div>
      </div>
    </div>
  );
}
