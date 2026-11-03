import { useState } from 'react'

export type Encoder = (file: File, maxSide: number, quality: number) => Promise<string>

const MAX_SIDE = 1600
const QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.3]
const SCALES = [1, 0.75, 0.5, 0.35]

const dataUrlBytes = (u: string) => Math.floor(((u.length - u.indexOf(',') - 1) * 3) / 4)

/** Real encoder: draws the image on a canvas (max side `maxSide`) and exports WebP, falling back to JPEG. */
// oxlint-disable-next-line react/only-export-components
export const canvasEncode: Encoder = async (file, maxSide, quality) => {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

/** Shrinks `file` into a data URL under `maxBytes`, stepping quality down then size down. */
// oxlint-disable-next-line react/only-export-components
export async function compressImage(file: File, maxBytes = 200_000, encode: Encoder = canvasEncode): Promise<string> {
  for (const scale of SCALES) {
    for (const q of QUALITIES) {
      const out = await encode(file, Math.round(MAX_SIDE * scale), q)
      if (dataUrlBytes(out) <= maxBytes) return out
    }
  }
  throw new Error('Não foi possível reduzir a imagem abaixo do limite.')
}

export default function ImageField({ label, value, disabled, onSave, onFocus, onBlur }: {
  label: string; value: string; disabled?: boolean
  onSave: (dataUrl: string) => void; onFocus?: () => void; onBlur?: () => void
}) {
  const [error, setError] = useState('')
  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    try { onSave(await compressImage(file)) } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="flex items-center gap-2">
      {value && <img src={value} alt={label} className="h-10 w-10 rounded object-cover" />}
      <input
        type="file" accept="image/*" aria-label={label} disabled={disabled}
        onFocus={onFocus} onBlur={onBlur}
        onChange={(e) => void pick(e.target.files?.[0])}
        className="w-40 text-xs"
      />
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
