import { formatRelativeUpdated, formatUpdatedTimestamp } from "../lib/format.js";

export default function LastUpdated({ fetchedAt }) {
  if (!fetchedAt) return null;

  return (
    <div className="rounded-lg bg-epl-purple/5 border border-epl-purple/10 px-4 py-2 text-sm text-epl-purple/80 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Last updated {formatRelativeUpdated(fetchedAt)}
      </span>
      <span className="text-xs text-epl-purple/50">{formatUpdatedTimestamp(fetchedAt)}</span>
    </div>
  );
}
