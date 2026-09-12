// Small segmented control for switching which competition's matches a tab
// shows - shared by the Fixtures and Results tabs in App.jsx so the two
// don't carry separate copies of the same two-pill toggle markup.
export default function CompetitionToggle({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-epl-surface2 p-1">
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
