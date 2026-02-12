import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { db, firebaseError, storage } from '../firebase/client'

const STORAGE_BUCKET = import.meta.env.VITE_FB_STORAGE_BUCKET || ''
const PROJECT_ID = import.meta.env.VITE_FB_PROJECT_ID || ''

function pomSortLabel(pom) {
  const code = pom.number || pom.name || pom.code || pom.pomCode || pom.pomNumber || pom.id || ''
  const material = pom.material || pom.fiber || pom.yarn || ''
  return `${code} ${material}`.trim().toLowerCase()
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isHttpsUrl(value) {
  return hasText(value) && value.startsWith('https://')
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

function firstNonEmpty(values) {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim()
    }
  }

  return ''
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

async function testPomImageFetch(url, pomId, label) {
  if (!hasText(url) || !url.startsWith('http')) {
    return
  }

  try {
    const response = await fetch(url)
    console.log('[POMS DEBUG] Pom fetch status:', {
      pomId,
      label,
      status: response.status,
      ok: response.ok,
      url,
    })

    if (!response.ok) {
      console.error('[POMS DEBUG] Pom fetch non-ok response', {
        pomId,
        label,
        status: response.status,
        url,
      })
    }
  } catch (error) {
    console.error('[POMS DEBUG] Fetch error:', {
      pomId,
      label,
      url,
      message: error?.message || 'Unknown error',
    })
  }
}

export default function usePoms() {
  const [poms, setPoms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!db) {
        if (!cancelled) {
          setLoading(false)
          setError(firebaseError || '')
        }
        return
      }

      console.log('[POMS DEBUG] Firebase env check', {
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      })

      if (PROJECT_ID && STORAGE_BUCKET && !STORAGE_BUCKET.includes(PROJECT_ID)) {
        console.warn('[POMS DEBUG] storageBucket may not match projectId', {
          projectId: PROJECT_ID,
          storageBucket: STORAGE_BUCKET,
        })
      }

      try {
        const snap = await getDocs(collection(db, 'poms'))
        const rawDocs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        const resolvedDocs = await Promise.all(
          rawDocs.map(async (pom) => {
            console.log('[POMS DEBUG] Full pom document', pom)
            console.log('[POMS DEBUG] Raw pom URL fields', {
              pomId: pom.id,
              frontImageUrl: pom.frontImageUrl || '',
              sideImageUrl: pom.sideImageUrl || '',
              frontThumbnailUrl: pom.frontThumbnailUrl || '',
              sideThumbnailUrl: pom.sideThumbnailUrl || '',
              frontUrl: pom.frontUrl || '',
              sideUrl: pom.sideUrl || '',
              thumbFrontUrl: pom.thumbFrontUrl || '',
              thumbSideUrl: pom.thumbSideUrl || '',
              frontImagePath: pom.frontImagePath || '',
              sideImagePath: pom.sideImagePath || '',
              frontThumbnailPath: pom.frontThumbnailPath || '',
              sideThumbnailPath: pom.sideThumbnailPath || '',
            })

            const rawFrontUrl = firstNonEmpty([
              pom.frontUrl,
              pom.frontImageUrl,
              pom.imageFrontUrl,
              pom.front,
              pom.imageUrl,
              pom.frontImagePath,
            ])
            const rawSideUrl = firstNonEmpty([
              pom.sideUrl,
              pom.sideImageUrl,
              pom.imageSideUrl,
              pom.side,
              pom.sideImagePath,
            ])
            const rawThumbFrontUrl = firstNonEmpty([
              pom.thumbFrontUrl,
              pom.frontThumbnailUrl,
              pom.frontThumbUrl,
              pom.frontThumbnailPath,
            ])
            const rawThumbSideUrl = firstNonEmpty([
              pom.thumbSideUrl,
              pom.sideThumbnailUrl,
              pom.sideThumbUrl,
              pom.sideThumbnailPath,
            ])

            const frontUrl = await resolvePomUrl(rawFrontUrl, pom.id, 'frontUrl')
            const sideUrl = await resolvePomUrl(rawSideUrl, pom.id, 'sideUrl')
            const thumbFrontUrl = await resolvePomUrl(rawThumbFrontUrl, pom.id, 'thumbFrontUrl')
            const thumbSideUrl = await resolvePomUrl(rawThumbSideUrl, pom.id, 'thumbSideUrl')

            const resolvedPom = {
              ...pom,
              frontUrl: frontUrl || pom.frontUrl || '',
              sideUrl: sideUrl || pom.sideUrl || '',
              thumbFrontUrl: thumbFrontUrl || pom.thumbFrontUrl || '',
              thumbSideUrl: thumbSideUrl || pom.thumbSideUrl || '',
            }

            console.log('[POMS DEBUG] Resolved pom URLs', {
              pomId: pom.id,
              rawFrontUrl,
              rawSideUrl,
              rawThumbFrontUrl,
              rawThumbSideUrl,
              frontUrl: resolvedPom.frontUrl,
              sideUrl: resolvedPom.sideUrl,
              thumbFrontUrl: resolvedPom.thumbFrontUrl,
              thumbSideUrl: resolvedPom.thumbSideUrl,
              frontIsHttps: isHttpsUrl(resolvedPom.frontUrl),
              sideIsHttps: isHttpsUrl(resolvedPom.sideUrl),
            })

            await testPomImageFetch(resolvedPom.frontUrl || resolvedPom.thumbFrontUrl, pom.id, 'front')
            await testPomImageFetch(resolvedPom.sideUrl || resolvedPom.thumbSideUrl, pom.id, 'side')

            return resolvedPom
          })
        )

        const next = resolvedDocs.sort((a, b) => pomSortLabel(a).localeCompare(pomSortLabel(b)))

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
