// Small segmented control for switching which competition's data a tab
// shows - shared by the Standings/Fixtures/Results tabs in App.jsx so none
// of them carries its own copy of the same toggle markup. `grid-cols-N` is
// computed inline rather than as a fixed Tailwind class (same fix TabBar
// already needed) - a hardcoded class silently breaks instead of erroring
// when a third competition option was added.
export default function CompetitionToggle({ options, value, onChange }) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-epl-surface2 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={
              "rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-all " +
              (isActive ? "bg-epl-cyan text-epl-purple shadow-md" : "text-white/60 hover:text-white")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
