function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim()
    }
  }

  return ''
}

export function getPomSeries(pom) {
  return pom?.series || pom?.pomSeries || pom?.collection || ''
}

export function getPomCode(pom) {
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

export function getPomMaterial(pom) {
  return pom?.material || pom?.fiber || pom?.yarn || pom?.composition || ''
}

export function getPomLabel(pom) {
  const series = getPomSeries(pom)
  const code = getPomCode(pom)
  return series ? `${series}-${code}` : code
}

export function getPomFrontImage(pom) {
  return firstNonEmpty([
    pom?.compressedFrontImageUrl,
    pom?.compressedFrontUrl,
    pom?.displayFrontUrl,
    pom?.thumbFrontUrl,
    pom?.frontThumbnailUrl,
    pom?.frontThumbUrl,
    pom?.pomFrontUrl,
    pom?.frontUrl,
    pom?.frontImageUrl,
    pom?.imageUrl,
    pom?.thumbSideUrl,
    pom?.sideThumbnailUrl,
    pom?.sideThumbUrl,
    pom?.sideUrl,
    pom?.sideImageUrl,
  ])
}

export function getPomSideImage(pom) {
  return firstNonEmpty([
    pom?.compressedSideImageUrl,
    pom?.compressedSideUrl,
    pom?.displaySideUrl,
    pom?.thumbSideUrl,
    pom?.sideThumbnailUrl,
    pom?.sideThumbUrl,
    pom?.pomSideUrl,
    pom?.sideUrl,
    pom?.sideImageUrl,
    pom?.thumbFrontUrl,
    pom?.frontThumbnailUrl,
    pom?.frontThumbUrl,
    pom?.frontUrl,
    pom?.frontImageUrl,
  ])
}

export function getPomSearchText(pom) {
  return [
    pom?.id,
    pom?.series,
    pom?.pomSeries,
    pom?.collection,
    pom?.number,
    pom?.code,
    pom?.pomCode,
    pom?.pomNumber,
    pom?.numberFull,
    pom?.count,
    pom?.name,
    pom?.material,
    pom?.fiber,
    pom?.yarn,
    pom?.composition,
    pom?.searchText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function getPomSortLabel(pom) {
  const code = getPomCode(pom)
  const material = getPomMaterial(pom)
  return `${code} ${material}`.trim().toLowerCase()
}
