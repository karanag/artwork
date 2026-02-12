import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { FRIENDLY_ENV_ERROR, storage } from './client'

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function buildArtworkStoragePath(artworkId, label, fileName) {
  const safeName = sanitizeFileName(fileName)
  return `artworks/${artworkId}/${label}_${safeName}`
}

export async function uploadFileToStorage(file, path) {
  if (!storage) {
    throw new Error(FRIENDLY_ENV_ERROR)
  }

  if (!file) {
    throw new Error('No file provided for upload.')
  }

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}
