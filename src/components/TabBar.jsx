export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={
              "flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold uppercase tracking-wide transition-all " +
              (isActive
                ? "bg-white text-epl-purple shadow-md"
                : "text-white/70 hover:text-white")
            }
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 2} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
