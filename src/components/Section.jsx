export default function Section({ title, action, children }) {
  return (
    <section className="bg-epl-card rounded-2xl shadow-card ring-1 ring-white/10 p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide text-white">
          {/* A short brand-gradient bar anchors each section title and gives
              the header a splash of color instead of plain gray text. */}
          <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-epl-magenta to-epl-cyan" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
