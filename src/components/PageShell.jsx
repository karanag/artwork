import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/create', label: 'Create New' },
  { to: '/artworks', label: 'Read Old' },
]

function navClassName({ isActive }) {
  const active = isActive
    ? 'bg-teal-400/15 text-teal-200 border border-teal-300/40'
    : 'text-slate-300 hover:text-white border border-white/10 hover:border-white/20'

  return `rounded-xl px-3 py-2 text-sm transition ${active}`
}

export default function PageShell({ title, subtitle, actions, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-teal-200/80">Rug Artwork Workflow</p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-300 sm:text-base">{subtitle}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClassName}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {actions}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
