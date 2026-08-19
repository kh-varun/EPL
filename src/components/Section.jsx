export default function Section({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-epl-purple/10 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-epl-purple mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}
