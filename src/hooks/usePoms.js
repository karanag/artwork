import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { db, firebaseError, storage } from '../firebase/client'
import {
  getPomFrontImage,
  getPomSearchText,
  getPomSideImage,
  getPomSortLabel,
} from '../poms/media'

const STORAGE_BUCKET = import.meta.env.VITE_FB_STORAGE_BUCKET || ''
const PROJECT_ID = import.meta.env.VITE_FB_PROJECT_ID || ''
const POMS_CACHE_KEY = 'rug-artwork-web:poms-cache:v2'
const POMS_CACHE_SCHEMA = 2

let inMemoryPomsCache = []
let hasInMemoryPomsCache = false
let inFlightPomsFetch = null

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function parseGsUrl(url) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(url)

  if (!match) {
    return null
  }

  return {
    bucket: match[1],
    path: match[2],
  }
}

function readCachedPomsFromStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(POMS_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (parsed?.schema !== POMS_CACHE_SCHEMA || !Array.isArray(parsed?.items)) {
      return null
    }

    return parsed.items
  } catch {
    return null
  }
}

function writeCachedPomsToStorage(items) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      POMS_CACHE_KEY,
      JSON.stringify({
        schema: POMS_CACHE_SCHEMA,
        cachedAt: Date.now(),
        items,
      })
    )
  } catch {
    // Ignore storage write failures (quota/privacy mode).
  }
}

function savePomsToCache(items) {
  const next = Array.isArray(items) ? items : []
  inMemoryPomsCache = next
  hasInMemoryPomsCache = true
  writeCachedPomsToStorage(next)
}

function readPomsFromCache() {
  if (hasInMemoryPomsCache) {
    return inMemoryPomsCache
  }

  const fromStorage = readCachedPomsFromStorage()
  if (Array.isArray(fromStorage)) {
    inMemoryPomsCache = fromStorage
    hasInMemoryPomsCache = true
    return fromStorage
  }

  return null
}

async function resolvePomUrl(url, pomId, fieldName) {
  if (!hasText(url)) {
    return ''
  }

  const rawUrl = url.trim()

  if (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) {
    return rawUrl
  }

  if (!rawUrl.startsWith('gs://')) {
    if (!storage) {
      console.error('[POMS DEBUG] Firebase storage is not initialized while resolving storage path', {
        pomId,
        fieldName,
        rawUrl,
      })
      return rawUrl
    }

    try {
      const resolvedPathUrl = await getDownloadURL(storageRef(storage, rawUrl))
      console.log('[POMS DEBUG] Resolved storage path to https', {
        pomId,
        fieldName,
        rawUrl,
        resolvedPathUrl,
      })
      return resolvedPathUrl
    } catch (error) {
      console.warn('[POMS DEBUG] Could not resolve storage path directly; returning raw value', {
        pomId,
        fieldName,
        rawUrl,
        message: error?.message || 'Unknown error',
      })
      return rawUrl
    }
  }

  const parsed = parseGsUrl(rawUrl)
  if (!parsed) {
    console.error('[POMS DEBUG] Failed to parse gs:// URL', { pomId, fieldName, rawUrl })
    return rawUrl
  }

  if (STORAGE_BUCKET && parsed.bucket !== STORAGE_BUCKET) {
    console.warn('[POMS DEBUG] Bucket mismatch for gs:// URL', {
      pomId,
      fieldName,
      gsBucket: parsed.bucket,
      envBucket: STORAGE_BUCKET,
    })
  }

  if (!storage) {
    console.error('[POMS DEBUG] Firebase storage is not initialized while resolving gs:// URL', {
      pomId,
      fieldName,
      rawUrl,
    })
    return rawUrl
  }

  try {
    const resolved = await getDownloadURL(storageRef(storage, rawUrl))
    console.log('[POMS DEBUG] Resolved gs:// to https', { pomId, fieldName, rawUrl, resolved })
    return resolved
  } catch (primaryError) {
    try {
      const fallbackResolved = await getDownloadURL(storageRef(storage, parsed.path))
      console.log('[POMS DEBUG] Resolved gs:// with path fallback', {
        pomId,
        fieldName,
        rawUrl,
        fallbackResolved,
      })
      return fallbackResolved
    } catch (fallbackError) {
      console.error('[POMS DEBUG] getDownloadURL failed', {
        pomId,
        fieldName,
        rawUrl,
        primaryMessage: primaryError?.message || 'Unknown error',
        fallbackMessage: fallbackError?.message || 'Unknown error',
      })
      return rawUrl
    }
  }
}

async function fetchAndResolvePomsFromFirestore() {
  const snap = await getDocs(collection(db, 'poms'))
  const rawDocs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

  const resolvedDocs = await Promise.all(
    rawDocs.map(async (pom) => {
      const rawFrontUrl = getPomFrontImage(pom)
      const rawSideUrl = getPomSideImage(pom)

      const frontUrl = await resolvePomUrl(rawFrontUrl, pom.id, 'frontUrl')
      const sideUrl = await resolvePomUrl(rawSideUrl, pom.id, 'sideUrl')

      const resolvedPom = {
        ...pom,
        frontUrl: frontUrl || pom.frontUrl || '',
        sideUrl: sideUrl || pom.sideUrl || '',
        thumbFrontUrl: frontUrl || pom.thumbFrontUrl || pom.frontThumbnailUrl || '',
        thumbSideUrl: sideUrl || pom.thumbSideUrl || pom.sideThumbnailUrl || '',
        displayFrontUrl: frontUrl || '',
        displaySideUrl: sideUrl || '',
        searchText: getPomSearchText(pom),
      }

      return resolvedPom
    })
  )

  const next = resolvedDocs.sort((a, b) => getPomSortLabel(a).localeCompare(getPomSortLabel(b)))
  savePomsToCache(next)
  return next
}

async function loadPomsWithSharedRequest() {
  if (inFlightPomsFetch) {
    return inFlightPomsFetch
  }

  inFlightPomsFetch = fetchAndResolvePomsFromFirestore()
  try {
    return await inFlightPomsFetch
  } finally {
    inFlightPomsFetch = null
  }
}

export default function usePoms() {
  const [poms, setPoms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const cachedPoms = readPomsFromCache()
      if (cachedPoms) {
        if (!cancelled) {
          setPoms(cachedPoms)
          setError('')
          setLoading(false)
        }
        return
      }

      if (!db) {
        if (!cancelled) {
          setLoading(false)
          setError(firebaseError || '')
        }
        return
      }

      if (PROJECT_ID && STORAGE_BUCKET && !STORAGE_BUCKET.includes(PROJECT_ID)) {
        console.warn('POM storageBucket may not match projectId', {
          projectId: PROJECT_ID,
          storageBucket: STORAGE_BUCKET,
        })
      }

      try {
        const next = await loadPomsWithSharedRequest()

        if (!cancelled) {
          setPoms(next)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load poms.')
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

  return { poms, loading, error }
}
