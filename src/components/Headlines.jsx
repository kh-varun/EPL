import { formatHeadlineAge } from "../lib/format.js";

export default function Headlines({ headlines }) {
  if (!headlines?.length) {
    return <p className="text-sm text-epl-purple/60">No headlines available.</p>;
  }

  return (
    <ul>
      {headlines.map((item) => (
        <li key={item.link} className="py-2.5 border-t border-epl-purple/10 first:border-t-0">
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium leading-snug hover:text-epl-magenta"
          >
            {item.title}
          </a>
          <div className="mt-1 text-xs text-epl-purple/50">
            {item.source}
            {item.pubDate ? ` · ${formatHeadlineAge(item.pubDate)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}
