import { NewspaperIcon } from "./icons.jsx";
import { formatHeadlineAge } from "../lib/format.js";

const SOURCE_STYLES = {
  "BBC Sport": "bg-[#bb1919] text-white",
  "The Guardian": "bg-[#052962] text-white",
};

export default function Headlines({ headlines }) {
  if (!headlines?.length) {
    return <p className="text-sm text-epl-purple/60">No headlines available.</p>;
  }

  return (
    <ul className="space-y-3">
      {headlines.map((item) => (
        <li key={item.link}>
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="flex gap-3 rounded-xl bg-slate-50 ring-1 ring-black/5 p-2.5 hover:ring-epl-magenta/30 transition-shadow"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className="h-20 w-20 shrink-0 rounded-lg object-cover bg-epl-purple/10"
              />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-lg bg-epl-purple/10 flex items-center justify-center text-epl-purple/30">
                <NewspaperIcon className="h-8 w-8" />
              </div>
            )}

            <div className="min-w-0 flex flex-col justify-center">
              <span
                className={
                  "self-start mb-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                  (SOURCE_STYLES[item.source] ?? "bg-epl-purple/10 text-epl-purple")
                }
              >
                {item.source}
              </span>
              <span className="text-sm font-semibold leading-snug line-clamp-3">
                {item.title}
              </span>
              {item.pubDate && (
                <span className="mt-1 text-xs text-epl-purple/50">
                  {formatHeadlineAge(item.pubDate)}
                </span>
              )}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
