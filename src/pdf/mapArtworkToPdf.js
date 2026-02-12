import { buildImageSourceMap } from './imageUtils'

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback
  }

  const next = value.trim()
  return next || fallback
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateObject(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`
}

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return formatDateObject(new Date())
  }

  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue)

    if (!Number.isNaN(parsed.getTime())) {
      return formatDateObject(parsed)
    }

    return dateValue
  }

  if (typeof dateValue?.toDate === 'function') {
    return formatDateObject(dateValue.toDate())
  }

  if (typeof dateValue?.seconds === 'number') {
    return formatDateObject(new Date(dateValue.seconds * 1000))
  }

  return formatDateObject(new Date())
}

function sanitizeFileToken(value) {
  return cleanText(value)
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim()
}

function normalizeSizeForFile(size, sizeUnit) {
  const rawSize = cleanText(size)
  const rawUnit = cleanText(sizeUnit)

  if (!rawSize && !rawUnit) {
    return ''
  }

  const compactSize = rawSize
    .replace(/[xX*]/g, 'x')
    .replace(/\s+/g, '')
    .trim()

  const compactUnit = rawUnit.replace(/\s+/g, '').trim()
  const withUnit = compactUnit && !compactSize.toLowerCase().endsWith(compactUnit.toLowerCase())
    ? `${compactSize}${compactUnit}`
    : compactSize

  return withUnit || compactUnit
}

function getPomSeries(pom) {
  return pom?.series || pom?.pomSeries || pom?.collection || ''
}

function getPomCode(pom) {
  return (
    pom?.number ||
    pom?.code ||
    pom?.pomCode ||
    pom?.pomNumber ||
    pom?.count ||
    pom?.name ||
    pom?.id ||
    ''
  )
}

function getPomMaterial(pom) {
  return pom?.material || pom?.fiber || pom?.yarn || pom?.composition || ''
}

function normalizePomLookup(value) {
  return cleanText(value).replace(/\s+/g, '').toLowerCase()
}

function firstNonEmpty(values) {
  for (const value of values) {
    const next = cleanText(value)
    if (next) {
      return next
    }
  }

  return ''
}

function getPomFrontImage(pom) {
  return firstNonEmpty([
    pom?.thumbFrontUrl ||
    pom?.frontThumbnailUrl ||
    pom?.frontThumbUrl ||
    pom?.frontUrl ||
    pom?.frontImageUrl ||
    pom?.frontImagePath ||
    pom?.thumbSideUrl ||
    pom?.sideThumbnailUrl ||
    pom?.sideThumbUrl ||
    pom?.sideUrl ||
    pom?.sideImageUrl ||
    pom?.sideImagePath,
  ])
}

function getPomSideImage(pom) {
  return firstNonEmpty([
    pom?.thumbSideUrl ||
    pom?.sideThumbnailUrl ||
    pom?.sideThumbUrl ||
    pom?.sideUrl ||
    pom?.sideImageUrl ||
    pom?.sideImagePath ||
    pom?.thumbFrontUrl ||
    pom?.frontThumbnailUrl ||
    pom?.frontThumbUrl ||
    pom?.frontUrl ||
    pom?.frontImageUrl ||
    pom?.frontImagePath,
  ])
}

function getTextureImage(texture) {
  return texture?.thumbUrl || texture?.imageUrl || ''
}

function resolveArtworkReference(artwork = {}) {
  if (artwork.artworkVersion) {
    return artwork.artworkVersion
  }

  const no = Number(artwork.artworkNo)
  const version = Number(artwork.version)

  if (Number.isFinite(no) && Number.isFinite(version)) {
    return `${no}.${version}`
  }

  return artwork.id || 'Artwork'
}

function resolveInspirationUrl(artwork, referenceMode) {
  const inspiration = cleanText(artwork?.inspirationUrl)
  const visualisation = cleanText(artwork?.visualisationUrl)

  if (referenceMode === 'none') {
    return ''
  }

  if (referenceMode === 'visualisation') {
    return visualisation
  }

  if (referenceMode === 'inspiration') {
    return inspiration
  }

  return inspiration || visualisation
}

function resolveVisualisationUrl(artwork) {
  return cleanText(artwork?.visualisationUrl)
}

function resolveHeroUrl(artwork, referenceMode) {
  const inspiration = cleanText(artwork?.inspirationUrl)
  const visualisation = cleanText(artwork?.visualisationUrl)

  if (referenceMode === 'none') {
    return ''
  }

  if (referenceMode === 'inspiration') {
    return inspiration
  }

  if (referenceMode === 'visualisation') {
    return visualisation
  }

  return visualisation || inspiration
}

function readImageDimensions(src) {
  if (!src) {
    return Promise.resolve({ width: 0, height: 0 })
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
      })
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = src
  })
}

function buildPomLookupMap(pomsById) {
  const map = new Map()

  pomsById.forEach((pom, pomId) => {
    const series = cleanText(getPomSeries(pom))
    const code = cleanText(getPomCode(pom))
    const combined = series && code ? `${series}-${code}` : ''
    const numberFull = cleanText(pom?.numberFull)

    ;[pomId, combined, numberFull, code]
      .map(normalizePomLookup)
      .filter(Boolean)
      .forEach((key) => {
        if (!map.has(key)) {
          map.set(key, pom)
        }
      })
  })

  return map
}

function mapColors(colors, pomsById) {
  const pomsByLookup = buildPomLookupMap(pomsById)

  return (Array.isArray(colors) ? colors : []).map((color, index) => {
    const pomId = cleanText(color?.pomId)
    const pomFromId = pomId ? pomsById.get(pomId) : null
    const colorSeries = cleanText(color?.pomSeries)
    const colorCode = cleanText(color?.pomCode)
    const colorLabel = cleanText(color?.pomLabel)
    const combinedLookup = colorSeries && colorCode ? `${colorSeries}-${colorCode}` : ''
    const lookupKeys = [colorLabel, combinedLookup, colorCode, pomId]
      .map(normalizePomLookup)
      .filter(Boolean)
    const pomFromLookup = lookupKeys.map((key) => pomsByLookup.get(key)).find(Boolean) || null
    const pom = pomFromId || pomFromLookup
    const pomSeries = cleanText(colorSeries || getPomSeries(pom))
    const pomCode = cleanText(colorCode || getPomCode(pom))
    const fallbackLabel = pomSeries || pomCode ? `${pomSeries ? `${pomSeries}-` : ''}${pomCode}` : 'Unmapped'
    const pomLabel = cleanText(colorLabel, fallbackLabel)
    const pomFrontUrl = firstNonEmpty([getPomFrontImage(pom), color?.pomFrontUrl, color?.pomFrontSrc])
    const pomSideUrl = firstNonEmpty([getPomSideImage(pom), color?.pomSideUrl, color?.pomSideSrc])
    const swatchName = `COLOR CODE ${String.fromCharCode(65 + (index % 26))} - SWATCH ${pad2(index + 1)}`
    const swatchPantone = color?.pomLabel ? `${pomLabel}` : ''

    console.log('[PDF MAP DEBUG] Color pom mapping', {
      index,
      hex: color?.hex || '',
      pomId,
      lookupKeys,
      matchedById: Boolean(pomFromId),
      matchedByLookup: Boolean(!pomFromId && pomFromLookup),
      pomLabel,
      hasFront: Boolean(pomFrontUrl),
      hasSide: Boolean(pomSideUrl),
      frontPreview: pomFrontUrl ? pomFrontUrl.slice(0, 120) : '',
      sidePreview: pomSideUrl ? pomSideUrl.slice(0, 120) : '',
    })

    return {
      id: `${color?.hex || 'color'}-${index}`,
      hex: cleanText(color?.hex, '#000000'),
      pct: Number(color?.pct) || 0,
      pomLabel,
      pomMaterial: cleanText(color?.pomMaterial || getPomMaterial(pom), ''),
      pomFrontUrl,
      pomSideUrl,
      swatchName,
      swatchPantone,
    }
  })
}

function mapTextures(textures) {
  return (Array.isArray(textures) ? textures : [])
    .slice(0, 3)
    .map((texture, index) => {
      if (typeof texture === 'string') {
        return {
          id: texture,
          name: texture,
          quality: '',
          material: '',
          finish: '',
          imageUrl: '',
          index,
        }
      }

      return {
        id: texture?.id || `texture-${index}`,
        name: cleanText(texture?.name, `Yarn ${String.fromCharCode(65 + index)}`),
        quality: cleanText(texture?.quality, ''),
        material: cleanText(texture?.material, ''),
        finish: cleanText(texture?.finish, ''),
        imageUrl: cleanText(getTextureImage(texture)),
        index,
      }
    })
}

function deriveContentFromColors(colors) {
  const unique = []

  colors.forEach((color) => {
    const material = cleanText(color?.pomMaterial)
    if (!material) {
      return
    }

    const lowered = material.toLowerCase()

    if (!unique.some((entry) => entry.toLowerCase() === lowered)) {
      unique.push(material)
    }
  })

  return unique.slice(0, 3).join(' / ')
}

function normalizeMeta(meta = {}, colors = []) {
  const contentFallback = deriveContentFromColors(colors)

  return {
    buyer: cleanText(meta.buyer),
    date: cleanText(meta.date, formatDateLabel(new Date())),
    design: cleanText(meta.design || meta.title, 'N/A'),
    size: cleanText(meta.size, 'N/A'),
    sizeUnit: cleanText(meta.sizeUnit),
    quality: cleanText(meta.quality, 'N/A'),
    projectRef: cleanText(meta.projectRef || meta.project, 'N/A'),
    content: cleanText(meta.content || meta.material || meta.composition, contentFallback || 'N/A'),
  }
}

export function buildPdfFileName(payload) {
  const sizeToken = normalizeSizeForFile(payload?.meta?.size, payload?.meta?.sizeUnit)
  const tokens = [
  payload?.artworkReference,
  payload?.meta?.buyer !== 'N/A' ? payload?.meta?.buyer : '',
  payload?.meta?.design !== 'N/A' ? payload?.meta?.design : '',
  sizeToken,
  payload?.meta?.quality !== 'N/A' ? payload?.meta?.quality : '',
]

    .map(sanitizeFileToken)
    .filter(Boolean)

  const fileStem = (tokens.join(' ') || 'Artwork').slice(0, 180).trim()
  return `${fileStem}.pdf`
}

export async function mapArtworkToPdf({
  artwork,
  colors = [],
  textures = [],
  poms = [],
  referenceMode = 'auto',
}) {
  const artworkReference = resolveArtworkReference(artwork || {})
  const pomsById = new Map(
    (Array.isArray(poms) ? poms : [])
      .filter((pom) => pom && cleanText(pom.id))
      .map((pom) => [cleanText(pom.id), pom])
  )
  const mappedColors = mapColors(colors, pomsById)
  const mappedTextures = mapTextures(textures).slice(0, 3)
  const meta = normalizeMeta(artwork?.meta || {}, mappedColors)

  const cadUrl = cleanText(artwork?.cadUrl)
  const heroUrl = resolveHeroUrl(artwork || {}, referenceMode)

  const visualisationUrl =
    referenceMode === 'visualisation' ? resolveVisualisationUrl(artwork || {}) : ''

  const inspirationUrl =
    referenceMode === 'inspiration' ? resolveInspirationUrl(artwork || {}, referenceMode) : ''


  const candidateUrls = [
    cadUrl,
    heroUrl,
    ...mappedColors.flatMap((color) => [color.pomFrontUrl, color.pomSideUrl]),
    ...mappedTextures.map((texture) => texture.imageUrl),
  ]

  console.log('[PDF MAP DEBUG] Preparing image sources', {
    artworkReference,
    referenceMode,
    candidateCount: candidateUrls.filter(Boolean).length,
    cadUrl: cadUrl ? cadUrl.slice(0, 120) : '',
    heroUrl: heroUrl ? heroUrl.slice(0, 120) : '',
  })

  const imageMap = await buildImageSourceMap(candidateUrls)
  const visualisationImage = visualisationUrl ? imageMap.get(visualisationUrl) || '' : ''
  const inspirationImage = inspirationUrl ? imageMap.get(inspirationUrl) || '' : ''
  const heroImage = heroUrl ? imageMap.get(heroUrl) || '' : ''
  const heroDimensions = await readImageDimensions(heroImage)

  const mappedColorSources = mappedColors.map((color, index) => {
    const pomFrontSrc = imageMap.get(color.pomFrontUrl) || ''
    const pomSideSrc = imageMap.get(color.pomSideUrl) || ''

    if (!pomFrontSrc && color.pomFrontUrl) {
      console.warn('[PDF WARN] Front image URL exists but did not resolve:', color.pomFrontUrl)
    }

    if (!pomSideSrc && color.pomSideUrl) {
      console.warn('[PDF WARN] Side image URL exists but did not resolve:', color.pomSideUrl)
    }


    console.log('[PDF MAP DEBUG] Final color image sources', {
      index,
      hex: color.hex,
      pomLabel: color.pomLabel,
      hasFrontUrl: Boolean(color.pomFrontUrl),
      hasSideUrl: Boolean(color.pomSideUrl),
      hasFrontSrc: Boolean(pomFrontSrc),
      hasSideSrc: Boolean(pomSideSrc),
      frontSrcPreview: pomFrontSrc ? pomFrontSrc.slice(0, 80) : '',
      sideSrcPreview: pomSideSrc ? pomSideSrc.slice(0, 80) : '',
    })

    return {
      ...color,
      pomFrontSrc,
      pomSideSrc,
    }
  })

  return {
    artworkReference,
    generatedDate: formatDateLabel(new Date()),
    meta,
    cadImage: imageMap.get(cadUrl) || '',
    visualisationImage,
    inspirationImage,
    heroImage,
    heroWidth: heroDimensions.width,
    heroHeight: heroDimensions.height,
    colors: mappedColorSources,
    textures: mappedTextures.map((texture) => ({
      ...texture,
      imageSrc: imageMap.get(texture.imageUrl) || '',
    })),
  }
}
