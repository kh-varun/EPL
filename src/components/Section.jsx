export default function Section({ title, action, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-epl-purple">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
