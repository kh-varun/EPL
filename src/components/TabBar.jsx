export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-epl-purple/10 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={
            "rounded-md py-2 text-xs font-bold uppercase tracking-wide transition-colors " +
            (activeTab === tab.id
              ? "bg-white text-epl-purple shadow-sm"
              : "text-epl-purple/60")
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
