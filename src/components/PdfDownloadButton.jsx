import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import Button from './Button'
import ArtworkPDF from '../pdf/ArtworkPDF'
import { buildPdfFileName, mapArtworkToPdf } from '../pdf/mapArtworkToPdf'

export default function PdfDownloadButton({
  artwork,
  colors = [],
  textures = [],
  poms = [],
  referenceMode = 'auto',
  label = 'Download PDF',
  className = '',
  disabled = false,
}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const busy = status !== 'idle'
  const isDisabled = busy || disabled

  const onDownload = async () => {
    if (disabled) {
      return
    }

    if (!artwork) {
      setError('Artwork data is missing for PDF export.')
      return
    }

    setStatus('preparing')
    setError('')

    try {
      const mapped = await mapArtworkToPdf({
        artwork,
        colors,
        textures,
        poms,
        referenceMode,
      })

      if (!mapped?.cadImage) {
        throw new Error('CAD image could not be prepared for PDF.')
      }

      const missingPomMedia = (mapped?.colors || []).filter(
        (entry) => entry?.pomLabel && !entry?.pomFrontSrc && !entry?.pomSideSrc
      )

      if (missingPomMedia.length) {
        console.warn('[PDF MAP DEBUG] Missing pom media after preparation', {
          missingCount: missingPomMedia.length,
          entries: missingPomMedia.map((entry) => ({
            hex: entry.hex,
            pomLabel: entry.pomLabel,
            pomFrontUrl: entry.pomFrontUrl || '',
            pomSideUrl: entry.pomSideUrl || '',
          })),
        })
      }

      setStatus('rendering')
      const blob = await pdf(<ArtworkPDF data={mapped} />).toBlob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = buildPdfFileName(mapped)
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1200)
    } catch (err) {
      setError('Failed to generate PDF. Please check image access and try again.')
      console.error(err)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className={className}>
      <Button variant="secondary" onClick={onDownload} disabled={isDisabled}>
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-100 border-t-transparent" />
            {status === 'preparing' ? 'Preparing images...' : 'Rendering PDF...'}
          </span>
        ) : disabled ? (
          'Preparing poms...'
        ) : (
          label
        )}
      </Button>
      {error ? <p className="mt-1 text-xs text-rose-200">{error}</p> : null}
    </div>
  )
}
