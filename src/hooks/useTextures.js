import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, firebaseError } from '../firebase/client'

function textureSortLabel(texture) {
  return `${texture.name || ''}`.trim().toLowerCase()
}

export default function useTextures() {
  const [textures, setTextures] = useState([])
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

      try {
        const snap = await getDocs(collection(db, 'textures'))
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => textureSortLabel(a).localeCompare(textureSortLabel(b)))

        if (!cancelled) {
          setTextures(next)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load textures.')
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

  return { textures, loading, error }
}
