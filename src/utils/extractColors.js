function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toHexChannel(value) {
  return value.toString(16).padStart(2, '0')
}

function rgbToHex(r, g, b) {
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`
}

function heapSwap(heap, i, j) {
  const temp = heap[i]
  heap[i] = heap[j]
  heap[j] = temp
}

function heapBubbleUp(heap, index) {
  let current = index
  while (current > 0) {
    const parent = Math.floor((current - 1) / 2)
    if (heap[parent][1] <= heap[current][1]) {
      break
    }
    heapSwap(heap, parent, current)
    current = parent
  }
}

function heapBubbleDown(heap, index) {
  let current = index
  const length = heap.length

  while (true) {
    const left = current * 2 + 1
    const right = left + 1
    let smallest = current

    if (left < length && heap[left][1] < heap[smallest][1]) {
      smallest = left
    }

    if (right < length && heap[right][1] < heap[smallest][1]) {
      smallest = right
    }

    if (smallest === current) {
      break
    }

    heapSwap(heap, current, smallest)
    current = smallest
  }
}

function takeTopCounts(entries, topN) {
  if (!Number.isFinite(topN) || topN >= entries.length) {
    return [...entries].sort((a, b) => b[1] - a[1])
  }

  const minHeap = []

  for (const entry of entries) {
    if (minHeap.length < topN) {
      minHeap.push(entry)
      heapBubbleUp(minHeap, minHeap.length - 1)
      continue
    }

    if (entry[1] > minHeap[0][1]) {
      minHeap[0] = entry
      heapBubbleDown(minHeap, 0)
    }
  }

  return minHeap.sort((a, b) => b[1] - a[1])
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export default async function extractColors(imageEl, options = {}) {
  if (!imageEl) {
    throw new Error('Image element is required for color extraction.')
  }

  const width = imageEl.naturalWidth || imageEl.width
  const height = imageEl.naturalHeight || imageEl.height

  if (!width || !height) {
    throw new Error('Image has invalid dimensions.')
  }

  const ignoreBottomPct = clamp(Number(options.ignoreBottomPct) || 0, 0, 12)
  const ignoreRows = Math.floor((height * ignoreBottomPct) / 100)
  const scanHeight = Math.max(1, height - ignoreRows)
  const maxColors = Number.isFinite(options.maxColors) || options.maxColors === Infinity
    ? Math.max(1, Math.floor(Number(options.maxColors)))
    : 120
  const yieldEveryPixels = clamp(Number(options.yieldEveryPixels) || 350000, 50000, 2000000)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Unable to extract colors: canvas context unavailable.')
  }

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(imageEl, 0, 0, width, height)

  const pixels = ctx.getImageData(0, 0, width, scanHeight).data
  const colorCounts = new Map()
  let consideredPixels = 0
  let processedPixels = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]

    if (alpha === 0) {
      continue
    }

    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const rgbKey = (red << 16) | (green << 8) | blue

    colorCounts.set(rgbKey, (colorCounts.get(rgbKey) || 0) + 1)
    consideredPixels += 1
    processedPixels += 1

    if (processedPixels % yieldEveryPixels === 0) {
      await yieldToBrowser()
    }
  }

  if (consideredPixels === 0) {
    return []
  }

  const topEntries = takeTopCounts(Array.from(colorCounts.entries()), maxColors)

  return topEntries
    .map(([rgbKey, count]) => {
      const red = (rgbKey >> 16) & 255
      const green = (rgbKey >> 8) & 255
      const blue = rgbKey & 255

      return {
        hex: rgbToHex(red, green, blue),
        pct: Number(((count / consideredPixels) * 100).toFixed(2)),
      }
    })
    .sort((a, b) => b.pct - a.pct)
}
