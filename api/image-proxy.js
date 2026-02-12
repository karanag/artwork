import { Buffer } from 'node:buffer'
import process from 'node:process'

const DEFAULT_ALLOWED_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com']

function asSingleQueryParam(value) {
  if (Array.isArray(value)) {
    return value[0] || ''
  }

  return typeof value === 'string' ? value : ''
}

function getAllowedHosts() {
  const configured = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return new Set([...DEFAULT_ALLOWED_HOSTS, ...configured])
}

function resolveSourceUrl(req) {
  const source = asSingleQueryParam(req.query?.src) || asSingleQueryParam(req.query?.url)
  return source.trim()
}

function parseUpstreamUrl(source, allowedHosts) {
  let parsed

  try {
    parsed = new URL(source)
  } catch {
    return { error: 'Invalid src URL.' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { error: 'Only http(s) URLs are supported.' }
  }

  if (!allowedHosts.has(parsed.hostname)) {
    return { error: 'Host not allowed.' }
  }

  return { parsed }
}

function applyProxyHeaders(res, reqOrigin) {
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req, res) {
  applyProxyHeaders(res, req.headers?.origin || '')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET,HEAD,OPTIONS')
    res.end('Method not allowed.')
    return
  }

  const source = resolveSourceUrl(req)

  if (!source) {
    res.statusCode = 400
    res.end('Missing src query param.')
    return
  }

  const validation = parseUpstreamUrl(source, getAllowedHosts())

  if (!validation.parsed) {
    res.statusCode = 400
    res.end(validation.error || 'Invalid URL.')
    return
  }

  try {
    const upstream = await fetch(validation.parsed.toString(), {
      method: req.method,
      redirect: 'follow',
    })

    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.end(`Upstream fetch failed with status ${upstream.status}.`)
      return
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=3600'
    const etag = upstream.headers.get('etag')
    const contentLength = upstream.headers.get('content-length')

    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', cacheControl)
    if (etag) {
      res.setHeader('ETag', etag)
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    const bytes = Buffer.from(await upstream.arrayBuffer())
    res.end(bytes)
  } catch (error) {
    res.statusCode = 500
    res.end(`Proxy error: ${error?.message || 'Unknown error'}`)
  }
}
