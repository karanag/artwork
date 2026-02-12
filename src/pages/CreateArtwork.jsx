import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import Button from '../components/Button'
import Card from '../components/Card'
import ColorGrid from '../components/ColorGrid'
import ImageUploader from '../components/ImageUploader'
import PageShell from '../components/PageShell'
import PdfDownloadButton from '../components/PdfDownloadButton'
import TextField from '../components/TextField'
import TexturePicker from '../components/TexturePicker'
import { db, firebaseError } from '../firebase/client'
import { buildArtworkStoragePath, uploadFileToStorage } from '../firebase/storageUpload'
import usePoms from '../hooks/usePoms'
import useTextures from '../hooks/useTextures'
import extractColors from '../utils/extractColors'

const START_ARTWORK_NO = 3157

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function initialMetaState() {
  return {
    buyer: '',
    date: getTodayISO(),
    design: '',
    size: '',
    sizeUnit: 'cm',
    quality: '',
    notes: '',
    projectRef: '',
  }
}

function getPomSeries(pom) {
  return pom?.series || pom?.pomSeries || pom?.collection || ''
}

function getPomCode(pom) {
  return pom?.number || pom?.code || pom?.pomCode || pom?.pomNumber || pom?.name || pom?.id || ''
}

function getPomMaterial(pom) {
  return pom?.material || pom?.fiber || pom?.yarn || ''
}

function getPomFrontImage(pom) {
  return (
    pom?.thumbFrontUrl ||
    pom?.frontThumbnailUrl ||
    pom?.frontUrl ||
    pom?.frontImageUrl ||
    pom?.imageUrl ||
    pom?.thumbSideUrl ||
    pom?.sideThumbnailUrl ||
    pom?.sideUrl ||
    pom?.sideImageUrl ||
    ''
  )
}

function getPomSideImage(pom) {
  return (
    pom?.sideUrl ||
    pom?.sideImageUrl ||
    pom?.thumbSideUrl ||
    pom?.sideThumbnailUrl ||
    pom?.frontUrl ||
    pom?.frontImageUrl ||
    pom?.thumbFrontUrl ||
    pom?.frontThumbnailUrl ||
    ''
  )
}

function getPomLabel(pom) {
  const series = getPomSeries(pom)
  const code = getPomCode(pom)
  return series ? `${series}-${code}` : code
}

function parseArtworkNoFromLabel(label) {
  if (!label || typeof label !== 'string') {
    return null
  }

  const [noPart] = label.split('.')
  const parsed = Number(noPart)
  return Number.isFinite(parsed) ? parsed : null
}

function parseVersionFromLabel(label) {
  if (!label || typeof label !== 'string') {
    return null
  }

  const [, versionPart] = label.split('.')
  const parsed = Number(versionPart)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveArtworkNo(data) {
  const direct = Number(data?.artworkNo)
  if (Number.isFinite(direct) && direct > 0) {
    return direct
  }

  return parseArtworkNoFromLabel(data?.artworkVersion)
}

function resolveArtworkVersion(data) {
  const direct = Number(data?.version)
  if (Number.isFinite(direct) && direct > 0) {
    return direct
  }

  return parseVersionFromLabel(data?.artworkVersion) || 1
}

function normalizeMeta(meta = {}) {
  return {
    buyer: meta.buyer || '',
    date: meta.date || getTodayISO(),
    design: meta.design || meta.title || '',
    size: meta.size || '',
    sizeUnit: meta.sizeUnit || 'cm',
    quality: meta.quality || '',
    notes: meta.notes || '',
    projectRef: meta.projectRef || meta.project || '',
  }
}

function createAssetFromUrl(url, fallbackName) {
  if (!url) {
    return null
  }

  return {
    file: null,
    previewUrl: url,
    name: fallbackName,
  }
}

function revokeAssetPreview(asset) {
  if (asset?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(asset.previewUrl)
  }
}

function formatArtworkLabel(no, version) {
  if (!no || !version) {
    return `${START_ARTWORK_NO}.1`
  }

  return `${no}.${version}`
}

function buildSearchableColor(color) {
  return {
    hex: color.hex,
    pct: Number(color.pct) || 0,
    pomId: color.pomId || '',
    pomSeries: color.pomSeries || '',
    pomCode: color.pomCode || '',
    pomLabel: color.pomLabel || '',
    pomQuery: color.pomQuery || color.pomLabel || color.pomCode || '',
    pomMaterial: color.pomMaterial || '',
    pomFrontUrl: color.pomFrontUrl || '',
    pomSideUrl: color.pomSideUrl || '',
  }
}

function insertAtIndex(items, item, index) {
  const next = [...items]
  const safeIndex = Math.max(0, Math.min(index, next.length))
  next.splice(safeIndex, 0, item)
  return next
}

async function loadImageFromUrl(url) {
  const imageEl = new Image()

  await new Promise((resolve, reject) => {
    imageEl.onload = resolve
    imageEl.onerror = () => reject(new Error('Unable to load CAD image for extraction.'))
    imageEl.src = url
  })

  return imageEl
}

function PreviewStrip({ label, asset }) {
  if (!asset?.previewUrl) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <img
        src={asset.previewUrl}
        alt={label}
        loading="lazy"
        className="h-24 w-full rounded-xl border border-white/10 object-cover"
      />
    </div>
  )
}

export default function CreateArtwork() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editArtworkId = searchParams.get('edit')

  const [step, setStep] = useState(1)
  const [meta, setMeta] = useState(initialMetaState)
  const [cadAsset, setCadAsset] = useState(null)
  const [visualAsset, setVisualAsset] = useState(null)
  const [inspirationAsset, setInspirationAsset] = useState(null)
  const [ignoreBottomPct, setIgnoreBottomPct] = useState(0)
  const [colors, setColors] = useState([])
  const [removedColors, setRemovedColors] = useState([])
  const [selectedTextureIds, setSelectedTextureIds] = useState([])
  const [pdfReferenceMode, setPdfReferenceMode] = useState('auto')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingSource, setLoadingSource] = useState(false)
  const [sourceArtworkId, setSourceArtworkId] = useState(null)
  const [pendingArtworkNo, setPendingArtworkNo] = useState(null)
  const [pendingVersion, setPendingVersion] = useState(null)

  const { poms, loading: pomsLoading, error: pomsError } = usePoms()
  const { textures, loading: texturesLoading, error: texturesError } = useTextures()

  const canProceedToStepTwo = Boolean(cadAsset?.previewUrl) && !extracting
  const canSave = colors.length > 0 && Boolean(cadAsset?.previewUrl) && !saving && !firebaseError
  const pomsLoadError = pomsError && pomsError !== firebaseError ? pomsError : ''
  const texturesLoadError = texturesError && texturesError !== firebaseError ? texturesError : ''

  const selectedTexturesSummary = useMemo(() => {
    return selectedTextureIds.join(', ')
  }, [selectedTextureIds])

  const texturesById = useMemo(() => {
    return new Map(textures.map((texture) => [texture.id, texture]))
  }, [textures])

  const selectedTextureDocs = useMemo(() => {
    return selectedTextureIds.map((id) => texturesById.get(id)).filter(Boolean)
  }, [selectedTextureIds, texturesById])

  const pomsById = useMemo(() => {
    return new Map(poms.map((pom) => [pom.id, pom]))
  }, [poms])

  const artworkLabel = formatArtworkLabel(pendingArtworkNo, pendingVersion)

  const previewArtworkForPdf = useMemo(() => {
    return {
      artworkNo: pendingArtworkNo,
      version: pendingVersion,
      artworkVersion: artworkLabel,
      meta,
      cadUrl: cadAsset?.previewUrl || '',
      visualisationUrl: visualAsset?.previewUrl || '',
      inspirationUrl: inspirationAsset?.previewUrl || '',
      createdAt: new Date(),
    }
  }, [artworkLabel, cadAsset?.previewUrl, inspirationAsset?.previewUrl, meta, pendingArtworkNo, pendingVersion, visualAsset?.previewUrl])

  const onMetaChange = (event) => {
    const { name, value } = event.target
    setMeta((prev) => ({ ...prev, [name]: value }))
  }

  const getNextArtworkNo = async () => {
    const artworksRef = collection(db, 'artworks')
    const latestSnap = await getDocs(query(artworksRef, orderBy('artworkNo', 'desc'), limit(50)))

    let maxNo = START_ARTWORK_NO - 1
    latestSnap.forEach((docSnap) => {
      const docNo = Number(docSnap.data()?.artworkNo)
      if (Number.isFinite(docNo) && docNo > maxNo) {
        maxNo = docNo
      }
    })

    return Math.max(START_ARTWORK_NO, maxNo + 1)
  }

  const getNextVersionForArtworkNo = async (artworkNo) => {
    const artworksRef = collection(db, 'artworks')
    const snap = await getDocs(query(artworksRef, where('artworkNo', '==', artworkNo)))

    let maxVersion = 0

    snap.forEach((docSnap) => {
      const data = docSnap.data()
      const version = resolveArtworkVersion(data)
      if (version > maxVersion) {
        maxVersion = version
      }
    })

    return maxVersion + 1
  }

  const resetToNewArtwork = async () => {
    revokeAssetPreview(cadAsset)
    revokeAssetPreview(visualAsset)
    revokeAssetPreview(inspirationAsset)

    setStep(1)
    setMeta(initialMetaState())
    setCadAsset(null)
    setVisualAsset(null)
    setInspirationAsset(null)
    setIgnoreBottomPct(0)
    setColors([])
    setRemovedColors([])
    setSelectedTextureIds([])
    setPdfReferenceMode('auto')
    setSourceArtworkId(null)
    setPendingArtworkNo(null)
    setPendingVersion(null)

    if (db) {
      try {
        const nextNo = await getNextArtworkNo()
        setPendingArtworkNo(nextNo)
        setPendingVersion(1)
      } catch {
        setPendingArtworkNo(START_ARTWORK_NO)
        setPendingVersion(1)
      }
    }
  }

  useEffect(() => {
    if (!db || editArtworkId) {
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const nextNo = await getNextArtworkNo()
        if (!cancelled) {
          setPendingArtworkNo(nextNo)
          setPendingVersion(1)
        }
      } catch {
        if (!cancelled) {
          setPendingArtworkNo(START_ARTWORK_NO)
          setPendingVersion(1)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [editArtworkId])

  useEffect(() => {
    if (!db || !editArtworkId) {
      return
    }

    let cancelled = false

    const run = async () => {
      setLoadingSource(true)

      try {
        const docSnap = await getDoc(doc(db, 'artworks', editArtworkId))

        if (!docSnap.exists()) {
          if (!cancelled) {
            alert('Artwork not found for editing.')
          }
          return
        }

        const data = docSnap.data()
        const resolvedNo = resolveArtworkNo(data) || (await getNextArtworkNo())
        const nextVersion = await getNextVersionForArtworkNo(resolvedNo)

        if (cancelled) {
          return
        }

        setSourceArtworkId(docSnap.id)
        setMeta(normalizeMeta(data.meta))
        setIgnoreBottomPct(Number(data.ignoreBottomPct) || 0)
        setCadAsset((prev) => {
          revokeAssetPreview(prev)
          return createAssetFromUrl(data.cadUrl, 'Saved CAD')
        })
        setVisualAsset((prev) => {
          revokeAssetPreview(prev)
          return createAssetFromUrl(data.visualisationUrl, 'Saved Visualisation')
        })
        setInspirationAsset((prev) => {
          revokeAssetPreview(prev)
          return createAssetFromUrl(data.inspirationUrl, 'Saved Inspiration')
        })
        setColors((Array.isArray(data.colors) ? data.colors : []).map(buildSearchableColor))
        setRemovedColors([])
        setSelectedTextureIds(Array.isArray(data.textures) ? data.textures : [])
        setPdfReferenceMode('auto')
        setPendingArtworkNo(resolvedNo)
        setPendingVersion(nextVersion)
        setStep(Array.isArray(data.colors) && data.colors.length ? 2 : 1)
      } catch (error) {
        if (!cancelled) {
          alert(`Failed to load artwork for editing: ${error?.message || 'Unknown error'}`)
        }
      } finally {
        if (!cancelled) {
          setLoadingSource(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [editArtworkId])

  useEffect(() => {
    if (!pomsById.size) {
      return
    }

    setColors((prev) => {
      let changed = false

      const next = prev.map((color) => {
        if (!color?.pomId) {
          return color
        }

        const pom = pomsById.get(color.pomId)
        if (!pom) {
          return color
        }

        const hydrated = {
          ...color,
          pomSeries: color.pomSeries || getPomSeries(pom),
          pomCode: color.pomCode || getPomCode(pom),
          pomLabel: color.pomLabel || getPomLabel(pom),
          pomMaterial: color.pomMaterial || getPomMaterial(pom),
          pomFrontUrl: color.pomFrontUrl || getPomFrontImage(pom),
          pomSideUrl: color.pomSideUrl || getPomSideImage(pom),
        }

        if (
          hydrated.pomSeries !== color.pomSeries ||
          hydrated.pomCode !== color.pomCode ||
          hydrated.pomLabel !== color.pomLabel ||
          hydrated.pomMaterial !== color.pomMaterial ||
          hydrated.pomFrontUrl !== color.pomFrontUrl ||
          hydrated.pomSideUrl !== color.pomSideUrl
        ) {
          changed = true
          return hydrated
        }

        return color
      })

      return changed ? next : prev
    })
  }, [pomsById])

  const runExtraction = async () => {
    if (!cadAsset?.previewUrl) {
      alert('CAD upload is required before extracting colors.')
      return
    }

    setExtracting(true)

    try {
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      const imageEl = await loadImageFromUrl(cadAsset.previewUrl)
      const extracted = await extractColors(imageEl, {
        ignoreBottomPct,
        maxColors: 120,
        yieldEveryPixels: 300000,
      })

      if (!extracted.length) {
        alert('No colors were detected. Try a different CAD image.')
        return
      }

      setColors(
        extracted.map((color) =>
          buildSearchableColor({
            ...color,
            pomId: '',
            pomSeries: '',
            pomCode: '',
            pomLabel: '',
            pomQuery: '',
            pomMaterial: '',
          })
        )
      )
      setRemovedColors([])
      setStep(2)
    } catch (error) {
      alert(error?.message || 'Failed to extract colors.')
    } finally {
      setExtracting(false)
    }
  }

  const removeColor = (indexToRemove) => {
    setColors((prev) => {
      const target = prev[indexToRemove]
      if (target) {
        setRemovedColors((removedPrev) => [
          {
            color: target,
            originalIndex: indexToRemove,
          },
          ...removedPrev,
        ])
      }

      return prev.filter((_, index) => index !== indexToRemove)
    })
  }

  const restoreRemovedColor = (removedIndex) => {
    const target = removedColors[removedIndex]
    if (!target) {
      return
    }

    setRemovedColors((prev) => prev.filter((_, index) => index !== removedIndex))
    setColors((prev) => insertAtIndex(prev, target.color, target.originalIndex))
  }

  const restoreAllColors = () => {
    if (!removedColors.length) {
      return
    }

    const sorted = [...removedColors].sort((a, b) => a.originalIndex - b.originalIndex)
    setColors((prev) => {
      let next = [...prev]
      sorted.forEach((item) => {
        next = insertAtIndex(next, item.color, item.originalIndex)
      })
      return next
    })
    setRemovedColors([])
  }

  const selectPom = (colorIndex, pom) => {
    const pomSeries = getPomSeries(pom)
    const pomCode = getPomCode(pom)
    const pomLabel = getPomLabel(pom)
    const pomMaterial = getPomMaterial(pom)
    const pomFrontUrl = getPomFrontImage(pom)
    const pomSideUrl = getPomSideImage(pom)

    setColors((prev) =>
      prev.map((color, index) =>
        index === colorIndex
          ? {
              ...color,
              pomId: pom.id,
              pomSeries,
              pomCode,
              pomLabel,
              pomQuery: pomLabel,
              pomMaterial,
              pomFrontUrl,
              pomSideUrl,
            }
          : color
      )
    )
  }

  const updatePomSearch = (colorIndex, queryValue) => {
    setColors((prev) =>
      prev.map((color, index) =>
        index === colorIndex
          ? {
              ...color,
              pomId: '',
              pomSeries: '',
              pomCode: '',
              pomLabel: '',
              pomQuery: queryValue,
              pomFrontUrl: '',
              pomSideUrl: '',
            }
          : color
      )
    )
  }

  const updatePomMaterial = (colorIndex, material) => {
    setColors((prev) =>
      prev.map((color, index) =>
        index === colorIndex
          ? {
              ...color,
              pomMaterial: material,
            }
          : color
      )
    )
  }

  const toggleTexture = (textureId) => {
    setSelectedTextureIds((prev) => {
      if (prev.includes(textureId)) {
        return prev.filter((id) => id !== textureId)
      }

      if (prev.length >= 3) {
        alert('You can select up to 3 textures.')
        return prev
      }

      return [...prev, textureId]
    })
  }

  const persistAsset = async (asset, artworkId, label) => {
    if (!asset) {
      return ''
    }

    if (asset.file) {
      return uploadFileToStorage(asset.file, buildArtworkStoragePath(artworkId, label, asset.file.name))
    }

    return asset.previewUrl || ''
  }

  const saveArtwork = async () => {
    if (!db) {
      alert(firebaseError || 'Firebase is not configured.')
      return
    }

    if (!cadAsset?.previewUrl) {
      alert('CAD file is required.')
      return
    }

    if (!colors.length) {
      alert('Extract colors before saving.')
      return
    }

    setSaving(true)

    try {
      let artworkNo = pendingArtworkNo
      if (!artworkNo) {
        artworkNo = await getNextArtworkNo()
      }

      let version = pendingVersion
      if (!version) {
        version = sourceArtworkId ? await getNextVersionForArtworkNo(artworkNo) : 1
      }

      const artworkVersion = `${artworkNo}.${version}`
      const artworkDocId = uuidv4()

      const cadUrl = await persistAsset(cadAsset, artworkDocId, 'cad')
      const visualisationUrl = await persistAsset(visualAsset, artworkDocId, 'visualisation')
      const inspirationUrl = await persistAsset(inspirationAsset, artworkDocId, 'inspiration')

      await setDoc(doc(db, 'artworks', artworkDocId), {
        artworkNo,
        version,
        artworkVersion,
        sourceArtworkId: sourceArtworkId || null,
        meta: {
          buyer: meta.buyer.trim(),
          date: meta.date,
          design: meta.design.trim(),
          size: meta.size.trim(),
          sizeUnit: meta.sizeUnit,
          quality: meta.quality.trim(),
          notes: meta.notes.trim(),
          projectRef: meta.projectRef.trim(),
        },
        cadUrl,
        visualisationUrl,
        inspirationUrl,
        ignoreBottomPct: Number(ignoreBottomPct),
        colors: colors.map((color) => ({
          hex: color.hex,
          pct: Number(color.pct),
          pomId: color.pomId || null,
          pomSeries: color.pomSeries || null,
          pomCode: color.pomCode || null,
          pomLabel: color.pomLabel || null,
          pomMaterial: color.pomMaterial?.trim() || null,
          pomFrontUrl: color.pomFrontUrl || null,
          pomSideUrl: color.pomSideUrl || null,
        })),
        textures: selectedTextureIds,
        createdAt: serverTimestamp(),
      })

      setSourceArtworkId(artworkDocId)
      setPendingArtworkNo(artworkNo)
      setPendingVersion(version + 1)
      setCadAsset((prev) => {
        revokeAssetPreview(prev)
        return createAssetFromUrl(cadUrl, 'Saved CAD')
      })
      setVisualAsset((prev) => {
        revokeAssetPreview(prev)
        return createAssetFromUrl(visualisationUrl, 'Saved Visualisation')
      })
      setInspirationAsset((prev) => {
        revokeAssetPreview(prev)
        return createAssetFromUrl(inspirationUrl, 'Saved Inspiration')
      })
      setRemovedColors([])

      alert(`Saved ${artworkVersion}`)
      navigate('/artworks')
    } catch (error) {
      alert(`Save failed: ${error?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      title="Create New Artwork"
      subtitle="Upload source files, extract CAD colors, map poms, and save versioned artwork records."
      actions={
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-teal-300/40 bg-teal-400/10 px-3 py-2 text-xs text-teal-100">
            Artwork {artworkLabel}
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
            Step {step} of 2
          </div>
          <Button variant="ghost" className="px-3 py-2 text-xs" onClick={resetToNewArtwork}>
            New Artwork
          </Button>
        </div>
      }
    >
      {loadingSource ? (
        <Card className="mb-4">
          <p className="text-sm text-slate-300">Loading artwork for editing...</p>
        </Card>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Step 1: Artwork Details</h2>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="Buyer"
                name="buyer"
                value={meta.buyer}
                onChange={onMetaChange}
                placeholder="Buyer name"
              />

              <TextField label="Date" type="date" name="date" value={meta.date} onChange={onMetaChange} />

              <TextField
                label="Design"
                name="design"
                value={meta.design}
                onChange={onMetaChange}
                placeholder="Design name / code"
              />

              <TextField
                label="Size"
                name="size"
                value={meta.size}
                onChange={onMetaChange}
                placeholder="e.g. 240 x 300"
              />

              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wide text-slate-300">Size Unit</span>
                <select
                  name="sizeUnit"
                  value={meta.sizeUnit}
                  onChange={onMetaChange}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-teal-300 focus:outline-none"
                >
                  <option value="cm">cm</option>
                  <option value="ft">ft</option>
                </select>
              </label>

              <TextField
                label="Quality"
                name="quality"
                value={meta.quality}
                onChange={onMetaChange}
                placeholder="Quality"
              />

              <TextField
                label="Project Ref"
                name="projectRef"
                value={meta.projectRef}
                onChange={onMetaChange}
                placeholder="Optional project reference"
              />

              <div className="md:col-span-2 lg:col-span-2">
                <TextField
                  label="Notes"
                  name="notes"
                  value={meta.notes}
                  onChange={onMetaChange}
                  placeholder="Internal notes"
                  multiline
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                <span>Ignore bottom strip before extraction</span>
                <span>{ignoreBottomPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={ignoreBottomPct}
                onChange={(event) => setIgnoreBottomPct(Number(event.target.value))}
                className="w-full accent-teal-300"
              />
            </div>
            <p className="text-xs text-slate-400">
              Extraction reads exact bitmap colors (no clustering) and stays responsive on large files.
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <ImageUploader label="CAD (Required)" required value={cadAsset} onChange={setCadAsset} />
            <ImageUploader
              label="Visualisation (Optional)"
              value={visualAsset}
              onChange={setVisualAsset}
            />
            <ImageUploader
              label="Inspiration (Optional)"
              value={inspirationAsset}
              onChange={setInspirationAsset}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={runExtraction} disabled={!canProceedToStepTwo}>
              {extracting ? 'Extracting...' : 'Next: Color Mapping'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Step 2: Color Mapping</h2>
                <p className="text-xs text-slate-400">{colors.length} colors mapped</p>
              </div>

              {pomsLoading ? <p className="text-sm text-slate-300">Loading poms...</p> : null}
              {pomsLoadError ? <p className="text-sm text-rose-200">{pomsLoadError}</p> : null}

              {!pomsLoading ? (
                <ColorGrid
                  colors={colors}
                  poms={poms}
                  onRemoveColor={removeColor}
                  onSelectPom={selectPom}
                  onPomSearchChange={updatePomSearch}
                  onMaterialChange={updatePomMaterial}
                />
              ) : null}
            </Card>

            {removedColors.length > 0 ? (
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">Removed Colors</h3>
                  <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={restoreAllColors}>
                    Restore All
                  </Button>
                </div>
                <div className="space-y-2">
                  {removedColors.map((item, index) => (
                    <div
                      key={`${item.color.hex}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded border border-white/20"
                          style={{ backgroundColor: item.color.hex }}
                        />
                        <span className="font-mono text-xs text-slate-200">{item.color.hex}</span>
                        <span className="text-xs text-slate-400">{item.color.pct.toFixed(2)}%</span>
                      </div>
                      <Button
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => restoreRemovedColor(index)}
                      >
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Texture Selection (up to 3)</h3>
              {texturesLoading ? <p className="text-sm text-slate-300">Loading textures...</p> : null}
              {texturesLoadError ? <p className="text-sm text-rose-200">{texturesLoadError}</p> : null}
              {!texturesLoading ? (
                <TexturePicker
                  textures={textures}
                  selectedTextureIds={selectedTextureIds}
                  onToggle={toggleTexture}
                  max={3}
                />
              ) : null}
            </Card>
          </div>

          <Card className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Preview & Save</h3>

            <PreviewStrip label="CAD" asset={cadAsset} />
            <PreviewStrip label="Visualisation" asset={visualAsset} />
            <PreviewStrip label="Inspiration" asset={inspirationAsset} />

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/55 p-3 text-xs text-slate-300">
              <p>Artwork No: {artworkLabel}</p>
              <p>Buyer: {meta.buyer || 'N/A'}</p>
              <p>Date: {meta.date || 'N/A'}</p>
              <p>Design: {meta.design || 'N/A'}</p>
              <p>
                Size: {meta.size || 'N/A'} {meta.sizeUnit || ''}
              </p>
              <p>Quality: {meta.quality || 'N/A'}</p>
              <p>Project Ref: {meta.projectRef || 'N/A'}</p>
              <p>Ignore Bottom: {ignoreBottomPct}%</p>
              <p>Textures: {selectedTexturesSummary || 'None'}</p>
            </div>

            {firebaseError ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-xs text-amber-100">
                Firebase is not configured yet. You can still extract colors, but mapping from Firestore and Save
                require a local `.env.local` with `VITE_FB_*`.
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wide text-slate-300">Reference Image In PDF</span>
                <select
                  value={pdfReferenceMode}
                  onChange={(event) => setPdfReferenceMode(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-teal-300 focus:outline-none"
                >
                  <option value="auto">Auto (Inspiration then Visualisation)</option>
                  <option value="inspiration" disabled={!inspirationAsset?.previewUrl}>
                    Inspiration
                  </option>
                  <option value="visualisation" disabled={!visualAsset?.previewUrl}>
                    Visualisation
                  </option>
                  <option value="none">Do Not Show Reference</option>
                </select>
              </label>

              <PdfDownloadButton
                artwork={previewArtworkForPdf}
                colors={colors}
                textures={selectedTextureDocs}
                poms={poms}
                referenceMode={pdfReferenceMode}
                label="Download PDF"
                disabled={pomsLoading}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={saveArtwork} disabled={!canSave}>
                {saving ? 'Saving...' : `Save ${artworkLabel}`}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  )
}
