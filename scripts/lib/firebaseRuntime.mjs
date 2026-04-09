import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref as storageRef } from 'firebase/storage'

function parseEnvFile(content) {
  const values = {}

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) {
      return
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key && !(key in process.env)) {
      process.env[key] = value
    }

    values[key] = value
  })

  return values
}

export async function loadFirebaseEnv(cwd = process.cwd()) {
  const envPath = path.join(cwd, '.env.local')
  const content = await readFile(envPath, 'utf8')
  return parseEnvFile(content)
}

export function getFirebaseConfig() {
  return {
    apiKey: process.env.VITE_FB_API_KEY,
    authDomain: process.env.VITE_FB_AUTH_DOMAIN,
    projectId: process.env.VITE_FB_PROJECT_ID,
    storageBucket: process.env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FB_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FB_APP_ID,
  }
}

export function createFirebaseClients() {
  const config = getFirebaseConfig()
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missingKeys.length) {
    throw new Error(`Missing Firebase env vars: ${missingKeys.join(', ')}`)
  }

  const app = initializeApp(config)

  return {
    app,
    db: getFirestore(app),
    storage: getStorage(app),
    config,
  }
}

export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function firstNonEmpty(values) {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim()
    }
  }

  return ''
}

export function parseStoragePathFromUrl(url) {
  if (!hasText(url)) {
    return ''
  }

  try {
    const parsed = new URL(url)
    const marker = '/o/'
    const markerIndex = parsed.pathname.indexOf(marker)

    if (markerIndex === -1) {
      return ''
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length))
  } catch {
    return ''
  }
}

export async function resolveStorageDownloadUrl(storage, value) {
  if (!hasText(value)) {
    return ''
  }

  const trimmed = value.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return getDownloadURL(storageRef(storage, trimmed))
}

export function resolvePomOriginalRefs(pom) {
  return {
    frontUrl: firstNonEmpty([pom.frontImageUrl, pom.frontUrl]),
    frontPath: firstNonEmpty([pom.frontImagePath, parseStoragePathFromUrl(pom.frontImageUrl), pom.frontPath]),
    sideUrl: firstNonEmpty([pom.sideImageUrl, pom.sideUrl]),
    sidePath: firstNonEmpty([pom.sideImagePath, parseStoragePathFromUrl(pom.sideImageUrl), pom.sidePath]),
  }
}

export function resolvePomCompressedRefs(pom) {
  return {
    frontUrl: firstNonEmpty([
      pom.compressedFrontImageUrl,
      pom.compressedFrontUrl,
      pom.displayFrontUrl,
      pom.frontThumbnailUrl,
      pom.thumbFrontUrl,
    ]),
    frontPath: firstNonEmpty([
      pom.compressedFrontImagePath,
      pom.compressedFrontPath,
      pom.displayFrontPath,
      pom.frontThumbnailPath,
      pom.thumbFrontPath,
      parseStoragePathFromUrl(pom.frontThumbnailUrl),
      parseStoragePathFromUrl(pom.thumbFrontUrl),
    ]),
    sideUrl: firstNonEmpty([
      pom.compressedSideImageUrl,
      pom.compressedSideUrl,
      pom.displaySideUrl,
      pom.sideThumbnailUrl,
      pom.thumbSideUrl,
    ]),
    sidePath: firstNonEmpty([
      pom.compressedSideImagePath,
      pom.compressedSidePath,
      pom.displaySidePath,
      pom.sideThumbnailPath,
      pom.thumbSidePath,
      parseStoragePathFromUrl(pom.sideThumbnailUrl),
      parseStoragePathFromUrl(pom.thumbSideUrl),
    ]),
  }
}

export function buildPomSearchText(pom) {
  return [
    pom.id,
    pom.series,
    pom.pomSeries,
    pom.collection,
    pom.number,
    pom.code,
    pom.pomCode,
    pom.pomNumber,
    pom.numberFull,
    pom.count,
    pom.name,
    pom.material,
    pom.fiber,
    pom.yarn,
    pom.composition,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
