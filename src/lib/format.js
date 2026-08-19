const TIME_ZONE = "America/Los_Angeles";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatMatchDateTime(utcDate) {
  const d = new Date(utcDate);
  return `${dateFormatter.format(d)} · ${timeFormatter.format(d)} PT`;
}

export function formatRelativeUpdated(isoDate) {
  const then = new Date(isoDate);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function formatUpdatedTimestamp(isoDate) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(isoDate))} PT`;
}

export function formatHeadlineAge(pubDate) {
  if (!pubDate) return "";
  return formatRelativeUpdated(pubDate);
}
