import { getPomCode, getPomLabel, getPomMaterial, getPomSearchText, getPomSeries } from './media'

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function buildPomSearchIndex(poms) {
  return poms.map((pom) => {
    const label = getPomLabel(pom)
    const code = getPomCode(pom)
    const series = getPomSeries(pom)
    const material = getPomMaterial(pom)
    const searchText = getPomSearchText(pom)

    return {
      pom,
      label,
      code,
      series,
      material,
      searchText,
      tokens: [...new Set(tokenize(`${label} ${code} ${series} ${material} ${searchText}`))],
    }
  })
}

function scorePom(entry, query, terms) {
  let score = 0
  const label = normalize(entry.label)
  const code = normalize(entry.code)
  const series = normalize(entry.series)
  const material = normalize(entry.material)
  const haystack = normalize(entry.searchText)

  if (label === query) score += 100
  if (code === query) score += 95
  if (`${series}-${code}` === query) score += 90
  if (label.startsWith(query)) score += 70
  if (code.startsWith(query)) score += 65
  if (series.startsWith(query)) score += 30
  if (material.startsWith(query)) score += 20
  if (haystack.includes(query)) score += 10

  terms.forEach((term) => {
    if (entry.tokens.some((token) => token.startsWith(term))) {
      score += 12
    }
  })

  return score
}

export function searchPomIndex(index, rawQuery, limit = 18) {
  const query = normalize(rawQuery)

  if (!query) {
    return []
  }

  const terms = tokenize(query)
  const matches = []

  index.forEach((entry) => {
    const matchesAllTerms = terms.every((term) => entry.tokens.some((token) => token.startsWith(term)))

    if (!matchesAllTerms && !entry.searchText.includes(query)) {
      return
    }

    const score = scorePom(entry, query, terms)

    if (score <= 0) {
      return
    }

    matches.push({
      ...entry,
      score,
    })
  })

  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return a.label.localeCompare(b.label)
  })

  return matches.slice(0, limit)
}
