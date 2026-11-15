import { supabase } from './supabase'

export type Bucket = 'attendance_photos' | 'diary_images' | 'requirements_files'

/**
 * Private na ang mga bucket, kaya path (hal. "123456789012/file.pdf") na ang sinesave sa database.
 * Gumagana rin ito sa mga lumang record na buong public URL ang naka-save.
 */
export function toStoragePath(bucket: Bucket, value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('data:') || value.startsWith('blob:')) return null
  const marker = `/${bucket}/`
  if (value.startsWith('http')) {
    const idx = value.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(value.slice(idx + marker.length).split('?')[0])
  }
  return value
}

/** Gumagawa ng pansamantalang link (1 oras) para makita ang private file. */
export async function getFileUrl(bucket: Bucket, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (value.startsWith('data:') || value.startsWith('blob:')) return value // lumang offline photo
  const path = toStoragePath(bucket, value)
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error || !data) return null
  return data.signedUrl
}

export async function getFileUrls(bucket: Bucket, values: (string | null | undefined)[]): Promise<string[]> {
  const urls = await Promise.all(values.map(v => getFileUrl(bucket, v)))
  return urls.filter((u): u is string => !!u)
}

/** Binubuksan ang file sa bagong tab. Binubuksan muna ang tab para hindi ma-block ng popup blocker. */
export async function openFile(bucket: Bucket, value: string | null | undefined) {
  const win = window.open('', '_blank')
  const url = await getFileUrl(bucket, value)
  if (!url) {
    win?.close()
    alert('Hindi mabuksan ang file. Baka nabura na ito o walang internet.')
    return
  }
  if (win) win.location.href = url
  else window.location.href = url
}

/** Dina-download ang file gamit ang tamang filename (gumagana kahit ibang domain ang storage). */
export async function downloadFile(bucket: Bucket, value: string | null | undefined, fileName: string) {
  const url = await getFileUrl(bucket, value)
  if (!url) throw new Error('Walang link para sa ' + fileName)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Hindi ma-download ang ' + fileName)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

/** Sunod-sunod na download (may pagitan para hindi i-block ng browser). */
export async function downloadMany(items: { bucket: Bucket; value: string | null; fileName: string }[]) {
  const failed: string[] = []
  for (const item of items) {
    try {
      await downloadFile(item.bucket, item.value, item.fileName)
    } catch {
      failed.push(item.fileName)
    }
    await new Promise(r => setTimeout(r, 400))
  }
  if (failed.length) alert('Hindi na-download:\n' + failed.join('\n'))
}

/** Pinapaliit ang litrato bago i-upload (JPEG, max na lapad/taas). */
export async function compressImage(file: Blob, maxSize = 1280, quality = 0.75): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Hindi mabasa ang larawan. Subukan ang JPG o PNG.')
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Hindi ma-convert ang larawan.'))), 'image/jpeg', quality)
  )
}

export function safeFilePart(s: string | null | undefined) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
}
