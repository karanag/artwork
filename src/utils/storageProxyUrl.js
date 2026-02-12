const IMAGE_PROXY_PATH = '/api/image-proxy'
const STORAGE_PROXY_HOST_ALLOWLIST = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
])

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '')
}

function shouldProxyStorageUrl(url) {
  if (!isHttpUrl(url)) {
    return false
  }

  try {
    const parsed = new URL(url)
    return STORAGE_PROXY_HOST_ALLOWLIST.has(parsed.hostname)
  } catch {
    return false
  }
}

export function toStorageProxyUrl(url) {
  if (!shouldProxyStorageUrl(url)) {
    return url
  }

  if (typeof window === 'undefined') {
    return url
  }

  const proxyUrl = new URL(IMAGE_PROXY_PATH, window.location.origin)
  proxyUrl.searchParams.set('src', url)
  return proxyUrl.toString()
}
