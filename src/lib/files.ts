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

export let lastFileError = ''

/**
 * Link para makita ang file.
 * 1) Signed link (gumagana kahit private ang bucket)
 * 2) Kung pumalpak, public link (gumagana kapag public ang bucket)
 */
export async function getFileUrl(bucket: Bucket, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (value.startsWith('data:') || value.startsWith('blob:')) return value // lumang offline photo
  const path = toStoragePath(bucket, value)
  if (!path) return value.startsWith('http') ? value : null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (data?.signedUrl) return data.signedUrl
  lastFileError = error?.message || 'unknown error'
  console.warn(`Signed URL failed for ${bucket}/${path}:`, lastFileError)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function getFileUrls(bucket: Bucket, values: (string | null | undefined)[]): Promise<string[]> {
  const urls = await Promise.all(values.map(v => getFileUrl(bucket, v)))
  return urls.filter((u): u is string => !!u)
}

/** Ginagawa nang maaga ang mga link para normal na <a href> ang View (hindi naba-block sa cellphone). */
export async function getFileUrlMap<T>(bucket: Bucket, items: T[], key: (item: T) => string, value: (item: T) => string | null | undefined) {
  const entries = await Promise.all(items.map(async item => [key(item), await getFileUrl(bucket, value(item))] as const))
  const map: Record<string, string> = {}
  for (const [k, url] of entries) if (url) map[k] = url
  return map
}

/** Binubuksan ang file sa bagong tab (pang-fallback kapag wala pang naka-handang link). */
export async function openFile(bucket: Bucket, value: string | null | undefined) {
  const url = await getFileUrl(bucket, value)
  if (!url) { alert('Hindi mabuksan ang file. ' + lastFileError); return }
  if (!window.open(url, '_blank')) window.location.assign(url)
}

async function fetchFileBlob(bucket: Bucket, value: string | null | undefined, label: string) {
  const url = await getFileUrl(bucket, value)
  if (!url) throw new Error('Walang link para sa ' + label)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hindi makuha ang ${label} (${res.status}). ${lastFileError}`)
  return res.blob()
}

/** Dina-download ang file gamit ang tamang filename (gumagana kahit ibang domain ang storage). */
export async function downloadFile(bucket: Bucket, value: string | null | undefined, fileName: string) {
  const blob = await fetchFileBlob(bucket, value, fileName)
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/** Diretsong print sa computer. Sa cellphone, binubuksan ang PDF para doon i-print/i-share. */
export async function printFile(bucket: Bucket, value: string | null | undefined, label: string) {
  const blob = await fetchFileBlob(bucket, value, label)
  const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    if (!window.open(objectUrl, '_blank')) window.location.assign(objectUrl)
    return
  }
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.src = objectUrl
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(objectUrl, '_blank')
    }
    setTimeout(() => { iframe.remove(); URL.revokeObjectURL(objectUrl) }, 60_000)
  }
  document.body.appendChild(iframe)
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
