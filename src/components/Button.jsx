const variants = {
  primary: 'bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:bg-teal-300/60',
  secondary: 'bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-700/70',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/10 border border-white/20 disabled:border-white/10',
  danger: 'bg-rose-500 text-white hover:bg-rose-400 disabled:bg-rose-400/70',
}

export default function Button({
  type = 'button',
  variant = 'primary',
  className = '',
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
