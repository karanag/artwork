const imageCache = new Map()
const STORAGE_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com'])

function isSupportedDataUrl(value) {
  return /^data:image\/(png|jpe?g);base64,/i.test(value || '')
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '')
}

function shouldProxyUrl(value) {
  if (!isHttpUrl(value)) {
    return false
  }

  try {
    const parsed = new URL(value)
    return STORAGE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

function toProxyUrl(url) {
  if (!shouldProxyUrl(url)) {
    return url
  }

  try {
    const proxyUrl = new URL('/__img_proxy', window.location.origin)
    proxyUrl.searchParams.set('src', url)
    return proxyUrl.toString()
  } catch {
    return url
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Failed to convert image to data URL.'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(source, withCors = false) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (withCors) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to decode image for PDF conversion.'))
    image.src = source
  })
}

function drawImageToPngDataUrl(image) {
  const width = Math.max(1, image.naturalWidth || image.width || 1)
  const height = Math.max(1, image.naturalHeight || image.height || 1)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true })

  if (!context) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  context.imageSmoothingEnabled = true
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

async function blobToPngDataUrl(blob) {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = await loadImage(objectUrl)
    return drawImageToPngDataUrl(image)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function urlToPngDataUrl(url) {
  const image = await loadImage(url)
  return drawImageToPngDataUrl(image)
}

async function normalizeBlobToSupportedDataUrl(blob) {
  if (!blob) {
    return ''
  }

  const mime = (blob.type || '').toLowerCase()

  if (mime.includes('png') || mime.includes('jpeg') || mime.includes('jpg')) {
    const directDataUrl = await blobToDataUrl(blob)

    if (isSupportedDataUrl(directDataUrl)) {
      return directDataUrl
    }
  }

  return blobToPngDataUrl(blob)
}

async function fetchImageBlob(url) {
  const fetchUrl = toProxyUrl(url)

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const blobResponse = await fetch(url)

    if (!blobResponse.ok) {
      throw new Error(`Image fetch failed with status ${blobResponse.status}.`)
    }

    return {
      blob: await blobResponse.blob(),
      contentType: blobResponse.headers.get('content-type') || '',
      status: blobResponse.status,
      fetchUrl: url,
    }
  }

  const response = await fetch(fetchUrl, {
    cache: 'force-cache',
    credentials: 'omit',
    mode: 'cors',
  })

  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}.`)
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || '',
    status: response.status,
    fetchUrl,
  }
}

export async function fetchImageAsBase64(url) {
  if (!url || typeof url !== 'string') {
    return ''
  }

  if (isSupportedDataUrl(url)) {
    return url
  }

  if (imageCache.has(url)) {
    return imageCache.get(url)
  }

  try {
    const { blob, contentType, status, fetchUrl } = await fetchImageBlob(url)
    console.log('[PDF IMG DEBUG] Fetch success', {
      url: url.slice(0, 140),
      fetchUrl: fetchUrl ? fetchUrl.slice(0, 140) : '',
      status,
      contentType,
      blobType: blob?.type || '',
      blobSize: blob?.size || 0,
    })

    let dataUrl = await normalizeBlobToSupportedDataUrl(blob)

    if (!isSupportedDataUrl(dataUrl) && fetchUrl) {
      // Some Storage objects return opaque MIME types; direct URL decoding can still succeed.
      dataUrl = await urlToPngDataUrl(fetchUrl)
    }

    if (!isSupportedDataUrl(dataUrl)) {
      throw new Error('Converted data URL is not in PNG/JPEG format.')
    }

    imageCache.set(url, dataUrl)
    return dataUrl
  } catch (error) {
    console.error('[PDF IMG DEBUG] Base64 conversion failed', {
      url,
      message: error?.message || 'Unknown error',
    })
    imageCache.set(url, '')
    return ''
  }
}

export async function toPdfImageSource(url) {
  return fetchImageAsBase64(url)
}

export async function buildImageSourceMap(urls) {
  const map = new Map()
  const unique = [...new Set(urls.filter(Boolean))]

  await Promise.all(
    unique.map(async (url) => {
      const source = await fetchImageAsBase64(url)
      map.set(url, source)
    })
  )

  return map
}
