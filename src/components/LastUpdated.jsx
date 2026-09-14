import { formatRelativeUpdated, formatUpdatedTimestamp } from "../lib/format.js";
import { RefreshIcon } from "./icons.jsx";

export default function LastUpdated({ fetchedAt, onRefresh, isRefreshing }) {
  if (!fetchedAt) return null;

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-white/70">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
        Updated {formatRelativeUpdated(fetchedAt)}
      </span>
      <span className="inline-flex items-center gap-2">
        {formatUpdatedTimestamp(fetchedAt)}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshIcon className={"h-3.5 w-3.5 " + (isRefreshing ? "animate-spin" : "")} />
          </button>
        )}
      </span>
    </div>
  );
}
