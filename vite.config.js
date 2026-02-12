import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function createImageProxyMiddleware() {
  const allowedHosts = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com'])

  return async function imageProxyMiddleware(req, res, next) {
    try {
      const requestUrl = new URL(req.url || '/', 'http://localhost')

      if (requestUrl.pathname !== '/__img_proxy') {
        next()
        return
      }

      const source = requestUrl.searchParams.get('src') || ''

      if (!source) {
        res.statusCode = 400
        res.end('Missing src query param.')
        return
      }

      let parsed
      try {
        parsed = new URL(source)
      } catch {
        res.statusCode = 400
        res.end('Invalid src URL.')
        return
      }

      if (!allowedHosts.has(parsed.hostname)) {
        res.statusCode = 403
        res.end('Host not allowed.')
        return
      }

      const upstream = await fetch(parsed.toString())

      if (!upstream.ok) {
        res.statusCode = upstream.status
        res.end(`Upstream fetch failed with status ${upstream.status}.`)
        return
      }

      const bytes = new Uint8Array(await upstream.arrayBuffer())
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=3600'
      const etag = upstream.headers.get('etag')

      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', cacheControl)
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (etag) {
        res.setHeader('ETag', etag)
      }
      res.end(bytes)
    } catch (error) {
      res.statusCode = 500
      res.end(`Proxy error: ${error?.message || 'Unknown error'}`)
    }
  }
}

const storageImageProxyPlugin = {
  name: 'storage-image-proxy',
  configureServer(server) {
    server.middlewares.use(createImageProxyMiddleware())
  },
  configurePreviewServer(server) {
    server.middlewares.use(createImageProxyMiddleware())
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), storageImageProxyPlugin],
})
