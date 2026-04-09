import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collection, getDocs } from 'firebase/firestore'
import {
  createFirebaseClients,
  firstNonEmpty,
  loadFirebaseEnv,
  parseStoragePathFromUrl,
  resolveStorageDownloadUrl,
} from './lib/firebaseRuntime.mjs'

const COLLECTIONS = ['poms', 'artworks', 'textures']

function timestampLabel(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function collectMediaRefs(collectionName, docData) {
  if (collectionName === 'poms') {
    return [
      {
        label: 'front-original',
        url: firstNonEmpty([docData.frontImageUrl, docData.frontUrl]),
        path: firstNonEmpty([docData.frontImagePath, parseStoragePathFromUrl(docData.frontImageUrl)]),
      },
      {
        label: 'side-original',
        url: firstNonEmpty([docData.sideImageUrl, docData.sideUrl]),
        path: firstNonEmpty([docData.sideImagePath, parseStoragePathFromUrl(docData.sideImageUrl)]),
      },
      {
        label: 'front-thumb',
        url: firstNonEmpty([docData.frontThumbnailUrl, docData.thumbFrontUrl]),
        path: firstNonEmpty([docData.frontThumbnailPath, parseStoragePathFromUrl(docData.frontThumbnailUrl)]),
      },
      {
        label: 'side-thumb',
        url: firstNonEmpty([docData.sideThumbnailUrl, docData.thumbSideUrl]),
        path: firstNonEmpty([docData.sideThumbnailPath, parseStoragePathFromUrl(docData.sideThumbnailUrl)]),
      },
    ].filter((entry) => entry.url || entry.path)
  }

  if (collectionName === 'artworks') {
    const topLevel = [
      {
        label: 'cad',
        url: docData.cadUrl || '',
        path: parseStoragePathFromUrl(docData.cadUrl),
      },
      {
        label: 'visualisation',
        url: docData.visualisationUrl || '',
        path: parseStoragePathFromUrl(docData.visualisationUrl),
      },
      {
        label: 'inspiration',
        url: docData.inspirationUrl || '',
        path: parseStoragePathFromUrl(docData.inspirationUrl),
      },
    ]

    const colorRefs = (Array.isArray(docData.colors) ? docData.colors : []).flatMap((color, index) => {
      return [
        {
          label: `color-${index + 1}-front`,
          url: color?.pomFrontUrl || '',
          path: parseStoragePathFromUrl(color?.pomFrontUrl || ''),
        },
        {
          label: `color-${index + 1}-side`,
          url: color?.pomSideUrl || '',
          path: parseStoragePathFromUrl(color?.pomSideUrl || ''),
        },
      ]
    })

    return [...topLevel, ...colorRefs].filter((entry) => entry.url || entry.path)
  }

  if (collectionName === 'textures') {
    return [
      {
        label: 'texture-original',
        url: docData.imageUrl || '',
        path: firstNonEmpty([docData.imagePath, parseStoragePathFromUrl(docData.imageUrl)]),
      },
      {
        label: 'texture-thumb',
        url: firstNonEmpty([docData.thumbnailUrl, docData.thumbUrl]),
        path: firstNonEmpty([
          docData.thumbnailPath,
          docData.thumbPath,
          parseStoragePathFromUrl(docData.thumbnailUrl),
        ]),
      },
    ].filter((entry) => entry.url || entry.path)
  }

  return []
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
  return {
    size: buffer.byteLength,
    contentType: response.headers.get('content-type') || '',
  }
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })

  await Promise.all(runners)
}

async function run() {
  const cwd = process.cwd()
  await loadFirebaseEnv(cwd)
  const { db, storage, config } = createFirebaseClients()
  const backupRoot = path.join(cwd, 'backups', 'firebase', timestampLabel())
  const firestoreRoot = path.join(backupRoot, 'firestore')
  const storageRoot = path.join(backupRoot, 'storage')

  await mkdir(firestoreRoot, { recursive: true })
  await mkdir(storageRoot, { recursive: true })

  const summary = {
    createdAt: new Date().toISOString(),
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    backupRoot,
    collections: {},
    media: {
      downloaded: 0,
      failed: 0,
      items: [],
    },
  }
  const downloadJobs = []
  const seenTargets = new Set()

  for (const collectionName of COLLECTIONS) {
    const snap = await getDocs(collection(db, collectionName))
    const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    await writeFile(
      path.join(firestoreRoot, `${collectionName}.json`),
      JSON.stringify(docs, null, 2),
      'utf8'
    )

    summary.collections[collectionName] = {
      count: docs.length,
    }

    for (const docData of docs) {
      const refs = collectMediaRefs(collectionName, docData)

      for (const mediaRef of refs) {
        const targetPath = mediaRef.path || parseStoragePathFromUrl(mediaRef.url)
        const backupFilePath = targetPath
          ? path.join(storageRoot, targetPath)
          : path.join(storageRoot, collectionName, docData.id, `${mediaRef.label}.bin`)

        if (seenTargets.has(backupFilePath)) {
          summary.media.items.push({
            status: 'skipped-duplicate',
            collection: collectionName,
            docId: docData.id,
            label: mediaRef.label,
            sourcePath: mediaRef.path || '',
            backupFilePath,
          })
          continue
        }

        seenTargets.add(backupFilePath)
        downloadJobs.push({
          collectionName,
          docId: docData.id,
          mediaRef,
          backupFilePath,
        })
      }
    }
  }

  await runWithConcurrency(downloadJobs, 8, async ({ collectionName, docId, mediaRef, backupFilePath }) => {
    try {
      const downloadUrl = mediaRef.url || (await resolveStorageDownloadUrl(storage, mediaRef.path))
      const metadata = await downloadToFile(downloadUrl, backupFilePath)

      summary.media.downloaded += 1
      summary.media.items.push({
        status: 'downloaded',
        collection: collectionName,
        docId,
        label: mediaRef.label,
        sourcePath: mediaRef.path || '',
        downloadUrl,
        backupFilePath,
        size: metadata.size,
        contentType: metadata.contentType,
      })
    } catch (error) {
      summary.media.failed += 1
      summary.media.items.push({
        status: 'failed',
        collection: collectionName,
        docId,
        label: mediaRef.label,
        sourcePath: mediaRef.path || '',
        sourceUrl: mediaRef.url || '',
        backupFilePath,
        error: error?.message || 'Unknown error',
      })
    }
  })

  await writeFile(path.join(backupRoot, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  console.log(JSON.stringify({
    backupRoot,
    collections: summary.collections,
    downloadedMedia: summary.media.downloaded,
    failedMedia: summary.media.failed,
  }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
