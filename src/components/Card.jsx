export default function Card({ className = '', children }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.85)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  )
}
