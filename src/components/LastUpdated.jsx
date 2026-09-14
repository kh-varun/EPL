import { formatRelativeUpdated, formatUpdatedTimestamp } from "../lib/format.js";
import { CheckIcon, RefreshIcon } from "./icons.jsx";

export default function LastUpdated({ fetchedAt, onRefresh, isRefreshing, justRefreshed }) {
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
            aria-label={justRefreshed ? "Dashboard refreshed" : "Refresh dashboard data"}
            // p-2.5 -m-2.5 grows the actual tappable area well past the
            // visible icon (which stays h-3.5 w-3.5) without disturbing the
            // surrounding flex layout - a 22x22 hit target was too small to
            // reliably tap on a phone, confirmed as the real complaint
            // behind "the button isn't working" once the fetch itself was
            // verified firing correctly on every click.
            className="rounded-full p-2.5 -m-2.5 text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-50"
          >
            {justRefreshed ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <RefreshIcon className={"h-3.5 w-3.5 " + (isRefreshing ? "animate-spin" : "")} />
            )}
          </button>
        )}
      </span>
    </div>
  );
}
