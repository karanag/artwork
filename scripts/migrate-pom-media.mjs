import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  buildPomSearchText,
  createFirebaseClients,
  hasText,
  loadFirebaseEnv,
  parseStoragePathFromUrl,
  resolvePomCompressedRefs,
} from './lib/firebaseRuntime.mjs'

function readFlag(flag) {
  return process.argv.includes(flag)
}

async function loadTinifyApiKey(cwd) {
  if (hasText(process.env.TINIFY_API_KEY)) {
    return process.env.TINIFY_API_KEY.trim()
  }

  const batchFilePath = '/Users/karan/development/Projects/tinify/batch.py'

  try {
    const content = await readFile(batchFilePath, 'utf8')
    const match = content.match(/tinify\.key\s*=\s*["']([^"']+)["']/)
    return match?.[1]?.trim() || ''
  } catch {
    return ''
  }
}

async function run() {
  const cwd = process.cwd()
  await loadFirebaseEnv(cwd)
  const tinifyApiKey = await loadTinifyApiKey(cwd)
  const write = readFlag('--write')

  const { db } = createFirebaseClients()
  const pomsSnap = await getDocs(collection(db, 'poms'))
  const artworksSnap = await getDocs(collection(db, 'artworks'))

  const pomPatchMap = new Map()
  const stats = {
    tinifyApiKeyFound: Boolean(tinifyApiKey),
    pomsRead: pomsSnap.size,
    pomsUpdated: 0,
    artworksRead: artworksSnap.size,
    artworksUpdated: 0,
    skippedPomsWithoutCompressedRefs: 0,
  }

  for (const docSnap of pomsSnap.docs) {
    const pom = { id: docSnap.id, ...docSnap.data() }
    const compressed = resolvePomCompressedRefs(pom)

    if (!compressed.frontUrl || !compressed.sideUrl || !compressed.frontPath || !compressed.sidePath) {
      stats.skippedPomsWithoutCompressedRefs += 1
      continue
    }

    const patch = {
      compressedFrontImageUrl: compressed.frontUrl,
      compressedFrontImagePath: compressed.frontPath,
      compressedSideImageUrl: compressed.sideUrl,
      compressedSideImagePath: compressed.sidePath,
      searchText: buildPomSearchText(pom),
      compressedMediaVersion: 1,
    }

    pomPatchMap.set(docSnap.id, patch)

    const changed =
      pom.compressedFrontImageUrl !== patch.compressedFrontImageUrl ||
      pom.compressedFrontImagePath !== patch.compressedFrontImagePath ||
      pom.compressedSideImageUrl !== patch.compressedSideImageUrl ||
      pom.compressedSideImagePath !== patch.compressedSideImagePath ||
      pom.searchText !== patch.searchText ||
      pom.compressedMediaVersion !== 1

    if (changed && write) {
      await updateDoc(doc(db, 'poms', docSnap.id), {
        ...patch,
        compressedMediaUpdatedAt: serverTimestamp(),
      })
    }

    if (changed) {
      stats.pomsUpdated += 1
    }
  }

  for (const docSnap of artworksSnap.docs) {
    const data = docSnap.data()
    const colors = Array.isArray(data.colors) ? data.colors : []
    let changed = false

    const nextColors = colors.map((color) => {
      const pomId = color?.pomId
      const patch = pomId ? pomPatchMap.get(pomId) : null

      const nextColor = {
        ...color,
        pomFrontUrl: patch?.compressedFrontImageUrl || color?.pomFrontUrl || null,
        pomSideUrl: patch?.compressedSideImageUrl || color?.pomSideUrl || null,
        pomFrontPath:
          patch?.compressedFrontImagePath ||
          color?.pomFrontPath ||
          parseStoragePathFromUrl(color?.pomFrontUrl || '') ||
          null,
        pomSidePath:
          patch?.compressedSideImagePath ||
          color?.pomSidePath ||
          parseStoragePathFromUrl(color?.pomSideUrl || '') ||
          null,
      }

      if (
        color?.pomFrontUrl !== nextColor.pomFrontUrl ||
        color?.pomSideUrl !== nextColor.pomSideUrl ||
        color?.pomFrontPath !== nextColor.pomFrontPath ||
        color?.pomSidePath !== nextColor.pomSidePath
      ) {
        changed = true
      }

      return nextColor
    })

    if (changed && write) {
      await updateDoc(doc(db, 'artworks', docSnap.id), {
        colors: nextColors,
        pomMediaUpdatedAt: serverTimestamp(),
      })
    }

    if (changed) {
      stats.artworksUpdated += 1
    }
  }

  console.log(JSON.stringify({ write, ...stats }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
