import { useRef, useState } from 'react'
import Button from './Button'
import Card from './Card'

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const level = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** level
  return `${value.toFixed(value > 99 ? 0 : 1)} ${units[level]}`
}

export default function ImageUploader({ label, required = false, value, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.')
      event.target.value = ''
      return
    }

    setBusy(true)

    try {
      const previewUrl = URL.createObjectURL(file)
      const imageEl = new Image()
      await new Promise((resolve, reject) => {
        imageEl.onload = resolve
        imageEl.onerror = () => reject(new Error('Unable to read image.'))
        imageEl.src = previewUrl
      })

      if (value?.previewUrl?.startsWith('blob:') && value.previewUrl !== previewUrl) {
        URL.revokeObjectURL(value.previewUrl)
      }

      onChange({
        file,
        previewUrl,
        width: imageEl.naturalWidth,
        height: imageEl.naturalHeight,
      })
    } catch (error) {
      alert(error?.message || 'Failed to load image file.')
    } finally {
      setBusy(false)
    }
  }

  const clearFile = () => {
    if (value?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(value.previewUrl)
    }

    onChange(null)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          {label}
          {required ? <span className="ml-1 text-teal-200">*</span> : null}
        </p>
        {value ? (
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={clearFile}>
            Clear
          </Button>
        ) : null}
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-slate-900/45 px-4 py-6 text-center hover:border-teal-300/70 hover:bg-slate-900/65">
        <span className="text-sm text-slate-200">{busy ? 'Loading image...' : 'Choose image'}</span>
        <span className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          required={required && !value}
          onChange={onFileChange}
          className="hidden"
          disabled={busy}
        />
      </label>

      {value ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
          <img
            src={value.previewUrl}
            alt={label}
            loading="lazy"
            className="h-36 w-full object-cover object-center"
          />
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
            <span>{value.file?.name || value.name || 'Selected image'}</span>
            <span>{formatBytes(value.file?.size || 0)}</span>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
