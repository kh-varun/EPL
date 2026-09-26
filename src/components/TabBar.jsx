export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div
      className="grid gap-1 rounded-2xl bg-black/20 p-1 ring-1 ring-inset ring-white/10 backdrop-blur-sm"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={
              "relative flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 " +
              (isActive
                ? "bg-white text-epl-purple shadow-lg"
                : "text-white/60 hover:text-white hover:bg-white/5")
            }
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
            {tab.label}
            {/* A small brand-gradient underline under the active tab - the
                pop of color the plain white pill was missing. */}
            {isActive && (
              <span className="absolute -bottom-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-epl-magenta to-epl-cyan" />
            )}
          </button>
        );
      })}
    </div>
  );
}
