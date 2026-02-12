import Card from './Card'

function textureThumb(texture) {
  return texture.thumbUrl || texture.imageUrl || ''
}

export default function TexturePicker({ textures, selectedTextureIds, onToggle, max = 3 }) {
  if (!textures.length) {
    return (
      <Card>
        <p className="text-sm text-slate-300">No textures found in Firestore.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-300">
        Textures ({selectedTextureIds.length}/{max})
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {textures.map((texture) => {
          const selected = selectedTextureIds.includes(texture.id)
          const disabled = !selected && selectedTextureIds.length >= max
          const image = textureThumb(texture)

          return (
            <button
              key={texture.id}
              type="button"
              onClick={() => onToggle(texture.id)}
              disabled={disabled}
              className={`overflow-hidden rounded-2xl border text-left transition ${
                selected
                  ? 'border-teal-300 bg-teal-400/10 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                  : 'border-white/10 bg-slate-950/50 hover:border-white/25 hover:bg-slate-900/70'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {image ? (
                <img src={image} alt={texture.name || 'Texture'} loading="lazy" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 w-full bg-slate-900" />
              )}

              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-semibold text-slate-100">{texture.name || 'Unnamed texture'}</p>
                <p className="truncate text-xs text-slate-400">{texture.quality || 'Quality n/a'}</p>
                <p className="truncate text-xs text-slate-500">{[texture.material, texture.finish].filter(Boolean).join(' | ')}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
