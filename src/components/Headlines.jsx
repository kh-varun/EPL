import { useMemo, useState } from "react";
import { NewspaperIcon } from "./icons.jsx";
import { formatHeadlineAge } from "../lib/format.js";

const SOURCE_STYLES = {
  "BBC Sport": "bg-[#bb1919] text-white",
  "The Guardian": "bg-[#052962] text-white",
};

export default function Headlines({ headlines, standings }) {
  const [filterTeamId, setFilterTeamId] = useState(null);

  const teamsWithNews = useMemo(() => {
    if (!headlines?.length || !standings?.length) return [];
    const mentioned = new Set(headlines.flatMap((h) => h.teams ?? []));
    return standings.map((row) => row.team).filter((team) => mentioned.has(team.id));
  }, [headlines, standings]);

  const visibleHeadlines = useMemo(() => {
    if (!headlines) return [];
    if (filterTeamId === null) return headlines;
    return headlines.filter((h) => h.teams?.includes(filterTeamId));
  }, [headlines, filterTeamId]);

  if (!headlines?.length) {
    return <p className="text-sm text-white/50">No headlines available.</p>;
  }

  return (
    <div>
      {teamsWithNews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3 mb-1">
          <button
            type="button"
            onClick={() => setFilterTeamId(null)}
            className={
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors " +
              (filterTeamId === null
                ? "bg-epl-magenta text-white"
                : "bg-white/10 text-white/70")
            }
          >
            All
          </button>
          {teamsWithNews.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setFilterTeamId(team.id)}
              className={
                "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors " +
                (filterTeamId === team.id
                  ? "bg-epl-magenta text-white"
                  : "bg-white/10 text-white/70")
              }
            >
              <img src={team.crest} alt="" className="h-4 w-4" loading="lazy" />
              {team.shortName}
            </button>
          ))}
        </div>
      )}

      {visibleHeadlines.length === 0 ? (
        <p className="text-sm text-white/50">No headlines mention this team right now.</p>
      ) : (
        <ul className="space-y-3">
          {visibleHeadlines.map((item) => (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 rounded-xl bg-epl-surface2 ring-1 ring-white/10 p-2.5 hover:ring-epl-magenta/40 transition-shadow"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover bg-white/5"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-white/20">
                    <NewspaperIcon className="h-8 w-8" />
                  </div>
                )}

                <div className="min-w-0 flex flex-col justify-center">
                  <span
                    className={
                      "self-start mb-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (SOURCE_STYLES[item.source] ?? "bg-white/10 text-white/80")
                    }
                  >
                    {item.source}
                  </span>
                  <span className="text-sm font-semibold leading-snug line-clamp-3 text-white">
                    {item.title}
                  </span>
                  {item.pubDate && (
                    <span className="mt-1 text-xs text-white/40">
                      {formatHeadlineAge(item.pubDate)}
                    </span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
