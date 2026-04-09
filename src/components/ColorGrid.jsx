import { useMemo, useState } from 'react'
import Button from './Button'
import Card from './Card'
import { getPomFrontImage, getPomLabel, getPomMaterial } from '../poms/media'
import { buildPomSearchIndex, searchPomIndex } from '../poms/search'

function ImageFailBox({ className }) {
  return (
    <div
      className={`flex items-center justify-center rounded border border-rose-500 bg-rose-500/10 px-1 text-[8px] font-semibold text-rose-100 ${className}`}
    >
      IMAGE LOAD FAIL
    </div>
  )
}

export default function ColorGrid({
  colors,
  poms,
  onRemoveColor,
  onSelectPom,
  onPomSearchChange,
  onMaterialChange,
}) {
  const [failedImageSrcs, setFailedImageSrcs] = useState({})

  const pomsById = useMemo(() => {
    return new Map(poms.map((pom) => [pom.id, pom]))
  }, [poms])

  const searchIndex = useMemo(() => {
    return buildPomSearchIndex(poms)
  }, [poms])

  const markImageFailed = (src) => {
    if (!src) {
      return
    }

    setFailedImageSrcs((prev) => {
      if (prev[src]) {
        return prev
      }

      return {
        ...prev,
        [src]: true,
      }
    })
  }

  const hasImageFailed = (src) => Boolean(src && failedImageSrcs[src])

  if (!colors.length) {
    return (
      <Card>
        <p className="text-sm text-slate-300">No colors extracted yet.</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {colors.map((color, index) => {
        const query = (color.pomQuery || '').trim().toLowerCase()
        const selectedPom = pomsById.get(color.pomId)
        const selectedPomLabel = selectedPom ? getPomLabel(selectedPom) : color.pomLabel || ''
        const selectedPomMaterial = color.pomMaterial || (selectedPom ? getPomMaterial(selectedPom) : '')
        const frontThumb = selectedPom ? getPomFrontImage(selectedPom) : ''
        const matches = query ? searchPomIndex(searchIndex, query, 18) : []

        return (
          <Card key={`${color.hex}-${index}`} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-lg border border-white/20"
                  style={{ backgroundColor: color.hex }}
                />
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-slate-100">{color.hex}</p>
                  <p className="text-xs text-slate-400">{color.pct.toFixed(2)}%</p>
                </div>
              </div>

              <Button
                variant="ghost"
                className="h-8 w-8 rounded-full px-0 py-0 text-base leading-none"
                onClick={() => onRemoveColor(index)}
                aria-label={`Remove ${color.hex}`}
              >
                x
              </Button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-300">Search Pom (Series-Code)</span>
              <input
                type="text"
                value={color.pomQuery || ''}
                onChange={(event) => onPomSearchChange(index, event.target.value)}
                placeholder="Type series, code, material..."
                className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-300 focus:outline-none"
              />
            </label>

            <div className="max-h-44 space-y-1 overflow-auto rounded-xl border border-white/10 bg-slate-900/55 p-1.5">
              {!query ? (
                <p className="px-2 py-3 text-xs text-slate-400">
                  Type to search the indexed POM library. Results appear instantly without loading long lists.
                </p>
              ) : null}
              {matches.map((entry) => {
                const isSelected = color.pomId === entry.pom.id
                const thumb = getPomFrontImage(entry.pom)
                const listThumbOk = Boolean(thumb) && !hasImageFailed(thumb)

                return (
                  <button
                    key={entry.pom.id}
                    type="button"
                    onClick={() => onSelectPom(index, entry.pom)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? 'bg-teal-400/25 text-teal-100 ring-1 ring-teal-300/50'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {listThumbOk ? (
                      <img
                        src={thumb}
                        alt={entry.label}
                        loading="lazy"
                        decoding="async"
                        className="h-7 w-7 rounded object-cover"
                        onError={() => markImageFailed(thumb)}
                      />
                    ) : thumb ? (
                      <ImageFailBox className="h-7 w-16" />
                    ) : (
                      <div className="h-7 w-7 rounded border border-white/10 bg-slate-800" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="truncate text-slate-400">{entry.material || 'No material'}</span>
                  </button>
                )
              })}
              {query && !matches.length ? (
                <p className="px-2 py-1 text-xs text-slate-400">No matching poms.</p>
              ) : null}
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-300">Material (Editable)</span>
              <input
                type="text"
                value={color.pomMaterial || ''}
                onChange={(event) => onMaterialChange(index, event.target.value)}
                placeholder="Material"
                className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-300 focus:outline-none"
              />
            </label>

            {selectedPom ? (
              <div className="space-y-2 rounded-lg border border-teal-300/30 bg-teal-400/10 p-2">
                <div className="grid grid-cols-1 gap-2">
                  {frontThumb && !hasImageFailed(frontThumb) ? (
                    <img
                      src={frontThumb}
                      alt={`${selectedPomLabel} front`}
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-full rounded-md object-cover"
                      onError={() => markImageFailed(frontThumb)}
                    />
                  ) : frontThumb ? (
                    <ImageFailBox className="h-20 w-full" />
                  ) : (
                    <div className="h-20 w-full rounded-md border border-white/10 bg-slate-800" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-teal-100">{selectedPomLabel}</p>
                  <p className="truncate text-xs text-slate-300">{selectedPomMaterial || 'Material not set'}</p>
                </div>
              </div>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}
