import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import Button from '../components/Button'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import PdfDownloadButton from '../components/PdfDownloadButton'
import { db, firebaseError } from '../firebase/client'
import usePoms from '../hooks/usePoms'
import useTextures from '../hooks/useTextures'

function formatCreatedAt(timestamp) {
  if (!timestamp) {
    return 'Unknown'
  }

  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString()
  }

  if (typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000).toLocaleString()
  }

  return 'Unknown'
}

function createdAtMillis(timestamp) {
  if (!timestamp) {
    return 0
  }

  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime()
  }

  if (typeof timestamp.seconds === 'number') {
    return timestamp.seconds * 1000
  }

  return 0
}

function resolveVersionLabel(artwork) {
  if (artwork?.artworkVersion) {
    return artwork.artworkVersion
  }

  const no = Number(artwork?.artworkNo)
  const version = Number(artwork?.version)

  if (Number.isFinite(no) && Number.isFinite(version)) {
    return `${no}.${version}`
  }

  return `legacy-${artwork.id}`
}

function resolveArtworkNo(artwork) {
  const direct = Number(artwork?.artworkNo)
  if (Number.isFinite(direct) && direct > 0) {
    return direct
  }

  const label = resolveVersionLabel(artwork)
  const [base] = label.split('.')
  const parsed = Number(base)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeMeta(meta = {}) {
  return {
    buyer: meta.buyer || '',
    date: meta.date || '',
    design: meta.design || meta.title || '',
    size: meta.size || '',
    sizeUnit: meta.sizeUnit || '',
    quality: meta.quality || '',
    projectRef: meta.projectRef || meta.project || '',
    notes: meta.notes || '',
  }
}

function swatchKey(color, index) {
  return `${color.hex || 'none'}-${index}`
}

function buildSearchText(artwork) {
  const meta = normalizeMeta(artwork.meta)

  return [
    artwork.id,
    resolveVersionLabel(artwork),
    meta.buyer,
    meta.date,
    meta.design,
    meta.size,
    meta.sizeUnit,
    meta.quality,
    meta.projectRef,
    meta.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function resolveTexturesForPdf(artwork, texturesById) {
  const refs = Array.isArray(artwork?.textures) ? artwork.textures : []

  return refs
    .map((entry) => {
      if (!entry) {
        return null
      }

      if (typeof entry === 'string') {
        return texturesById.get(entry) || entry
      }

      if (typeof entry === 'object' && entry.id && texturesById.has(entry.id)) {
        return texturesById.get(entry.id)
      }

      return entry
    })
    .filter(Boolean)
}

export default function Artworks() {
  const navigate = useNavigate()
  const [artworks, setArtworks] = useState([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfReferenceModes, setPdfReferenceModes] = useState({})
  const { poms, loading: pomsLoading, error: pomsError } = usePoms()
  const { textures, error: texturesError } = useTextures()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!db) {
        if (!cancelled) {
          setError(firebaseError || '')
          setLoading(false)
        }
        return
      }

      try {
        const snap = await getDocs(collection(db, 'artworks'))
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt))

        if (!cancelled) {
          setArtworks(next)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to fetch artworks.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  const texturesById = useMemo(() => {
    return new Map(textures.map((texture) => [texture.id, texture]))
  }, [textures])

  const helperLoadError = useMemo(() => {
    const entries = [pomsError, texturesError].filter(Boolean).filter((msg) => msg !== firebaseError)

    if (!entries.length) {
      return ''
    }

    return entries[0]
  }, [pomsError, texturesError])

  const groupedArtworks = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const filtered = q
      ? artworks.filter((artwork) => buildSearchText(artwork).includes(q))
      : artworks

    const map = new Map()

    filtered.forEach((artwork) => {
      const artworkNo = resolveArtworkNo(artwork)
      const groupKey = artworkNo ? `no-${artworkNo}` : `legacy-${artwork.id}`

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          artworkNo,
          versions: [],
        })
      }

      map.get(groupKey).versions.push(artwork)
    })

    const groups = Array.from(map.values())

    groups.forEach((group) => {
      group.versions.sort((a, b) => {
        const aVersion = Number(a.version) || 0
        const bVersion = Number(b.version) || 0

        if (aVersion !== bVersion) {
          return bVersion - aVersion
        }

        return createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt)
      })

      group.latest = group.versions[0]
    })

    groups.sort((a, b) => createdAtMillis(b.latest?.createdAt) - createdAtMillis(a.latest?.createdAt))

    return groups
  }, [artworks, searchText])

  const updatePdfReferenceMode = (groupKey, value) => {
    setPdfReferenceModes((prev) => ({
      ...prev,
      [groupKey]: value,
    }))
  }

  return (
    <PageShell
      title="Read Old Artwork"
      subtitle="Search, review history, and edit any artwork as a new version."
    >
      <Card className="mb-4 space-y-2">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-slate-300">Search Artworks</span>
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search buyer, design, size, quality, project ref, artwork no..."
            className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-300 focus:outline-none"
          />
        </label>
        <p className="text-xs text-slate-400">Results: {groupedArtworks.length} artwork groups</p>
      </Card>

      {error ? (
        <Card className="mb-4 border-rose-300/30 bg-rose-400/10">
          <p className="text-sm text-rose-100">{error}</p>
        </Card>
      ) : null}

      {!error && helperLoadError ? (
        <Card className="mb-4 border-amber-300/30 bg-amber-400/10">
          <p className="text-sm text-amber-100">
            Some helper data failed to load. PDFs will still export, but pom/texture media may be limited.
          </p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-slate-300">Loading artworks...</p>
        </Card>
      ) : null}

      {!loading && !error && groupedArtworks.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-300">No artworks found for this search.</p>
        </Card>
      ) : null}

      {!loading && !error && groupedArtworks.length > 0 ? (
        <div className="space-y-4">
          {groupedArtworks.map((group) => {
            const latest = group.latest
            const meta = normalizeMeta(latest?.meta)
            const versionLabel = resolveVersionLabel(latest)
            const previews = [latest?.cadUrl, latest?.visualisationUrl, latest?.inspirationUrl].filter(Boolean)
            const referenceMode = pdfReferenceModes[group.groupKey] || 'auto'
            const latestTextures = resolveTexturesForPdf(latest, texturesById)

            return (
              <Card key={group.groupKey} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">Artwork {versionLabel}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {group.artworkNo ? `Base No: ${group.artworkNo}` : 'Legacy artwork'}
                    </p>
                    <p className="text-xs text-slate-400">Latest saved: {formatCreatedAt(latest?.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="block uppercase tracking-wide text-slate-300">PDF Reference</span>
                      <select
                        value={referenceMode}
                        onChange={(event) => updatePdfReferenceMode(group.groupKey, event.target.value)}
                        className="rounded-lg border border-white/15 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
                      >
                        <option value="auto">Auto</option>
                        <option value="inspiration" disabled={!latest?.inspirationUrl}>
                          Inspiration
                        </option>
                        <option value="visualisation" disabled={!latest?.visualisationUrl}>
                          Visualisation
                        </option>
                        <option value="none">None</option>
                      </select>
                    </label>
                    <PdfDownloadButton
                      artwork={latest}
                      colors={latest?.colors || []}
                      textures={latestTextures}
                      poms={poms}
                      referenceMode={referenceMode}
                      label="PDF (Latest)"
                      disabled={pomsLoading}
                    />
                    <Button
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={() => navigate(`/create?edit=${latest.id}`)}
                    >
                      Edit as New Version
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4 lg:grid-cols-6">
                  <div>
                    <p className="text-slate-400">Buyer</p>
                    <p>{meta.buyer || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Design</p>
                    <p>{meta.design || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Size</p>
                    <p>
                      {meta.size || 'N/A'} {meta.sizeUnit || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Quality</p>
                    <p>{meta.quality || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Date</p>
                    <p>{meta.date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Project Ref</p>
                    <p>{meta.projectRef || 'N/A'}</p>
                  </div>
                </div>

                {previews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {previews.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="Artwork preview"
                        loading="lazy"
                        className="h-24 w-full rounded-xl border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                ) : null}

                {Array.isArray(latest?.colors) && latest.colors.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-300">Top Colors</p>
                    <div className="flex flex-wrap gap-2">
                      {latest.colors.slice(0, 12).map((color, index) => (
                        <div
                          key={swatchKey(color, index)}
                          className="h-8 w-8 rounded-md border border-white/15"
                          style={{ backgroundColor: color.hex || '#000000' }}
                          title={`${color.hex || 'unknown'} (${color.pct || 0}%)`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {meta.notes ? (
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
                    {meta.notes}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">Version History</p>
                  <div className="space-y-1 rounded-xl border border-white/10 bg-slate-900/55 p-2">
                    {group.versions.map((versionDoc) => (
                      <div
                        key={versionDoc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-200">{resolveVersionLabel(versionDoc)}</p>
                          <p className="text-slate-400">{formatCreatedAt(versionDoc.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PdfDownloadButton
                            artwork={versionDoc}
                            colors={versionDoc?.colors || []}
                            textures={resolveTexturesForPdf(versionDoc, texturesById)}
                            poms={poms}
                            referenceMode={referenceMode}
                            label="PDF"
                          />
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => navigate(`/create?edit=${versionDoc.id}`)}
                          >
                            Edit From This
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}
    </PageShell>
  )
}
