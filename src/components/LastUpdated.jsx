import { formatRelativeUpdated, formatUpdatedTimestamp } from "../lib/format.js";

export default function LastUpdated({ fetchedAt }) {
  if (!fetchedAt) return null;

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-white/70">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
        Updated {formatRelativeUpdated(fetchedAt)}
      </span>
      <span>{formatUpdatedTimestamp(fetchedAt)}</span>
    </div>
  );
}
