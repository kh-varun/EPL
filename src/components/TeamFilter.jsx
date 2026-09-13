// Native <select> for narrowing the Fixtures/Results tabs down to one
// team's matches - a plain select (rather than a custom dropdown) keeps it
// cheap and gives mobile browsers their native picker UI for free. `teams`
// is expected to already be the current competition's team list (its own
// standings), since the two competitions don't share teams 1:1 - callers
// re-render this with a different `teams` array when the competition
// sub-tab changes, and should reset `value` to null at the same time so a
// stale team id from the other competition doesn't silently filter to
// nothing.
export default function TeamFilter({ teams, value, onChange }) {
  const sorted = [...teams].sort((a, b) => a.shortName.localeCompare(b.shortName));
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full rounded-xl bg-epl-surface2 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-epl-cyan"
    >
      <option value="">All Teams</option>
      {sorted.map((team) => (
        <option key={team.id} value={team.id}>
          {team.shortName}
        </option>
      ))}
    </select>
  );
}
