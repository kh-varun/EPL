export default function Section({ title, action, children }) {
  return (
    <section className="bg-epl-surface rounded-2xl shadow-lg ring-1 ring-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
