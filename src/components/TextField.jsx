export default function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  multiline = false,
  rows = 4,
}) {
  const sharedClassName =
    'w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-teal-300 focus:outline-none'

  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wide text-slate-300">{label}</span>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          required={required}
          className={`${sharedClassName} resize-y`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={sharedClassName}
        />
      )}
    </label>
  )
}
