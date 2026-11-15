import { supabase } from './supabase'
import { db, AttendanceQueueItem, AttendanceAction, newId } from './db'
import { manilaDate } from './constants'
import { safeFilePart } from './files'

export const SYNC_EVENT = 'wi-sync-done'

export interface SyncResult { synced: number; failed: number; offline: boolean }

// Pansamantalang problema (walang net, expired token) → subukan ulit mamaya, huwag markahang failed.
const isTransientError = (err: any) =>
  !navigator.onLine ||
  /failed to fetch|load failed|network|timeout|jwt|fetch/i.test(String(err?.message || err || ''))

const notify = () => window.dispatchEvent(new Event(SYNC_EVENT))

// =====================================================================
// ATTENDANCE
// =====================================================================

/** I-save ang time-in/out sa device. Ang sync ang magpapadala sa server. */
export async function queueAttendance(lrn: string, action: AttendanceAction, photo: Blob | null) {
  await db.attendanceQueue.add({
    clientActionId: newId(),
    lrn,
    action,
    capturedAt: new Date().toISOString(),
    photo,
    photoPath: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
  notify()
}

/** Mga naka-queue (pending o failed) ng estudyante para sa isang petsa. */
export async function getQueuedForDate(lrn: string, date: string) {
  const items = await db.attendanceQueue.where('lrn').equals(lrn).toArray()
  return items.filter(i => manilaDate(new Date(i.capturedAt)) === date)
}

export async function getQueueCounts(lrn: string) {
  const [att, files] = await Promise.all([
    db.attendanceQueue.where('lrn').equals(lrn).toArray(),
    db.fileQueue.where('lrn').equals(lrn).toArray(),
  ])
  return {
    pending: att.filter(i => i.status === 'pending').length + files.filter(i => i.status !== 'failed').length,
    failed: [...att.filter(i => i.status === 'failed'), ...files.filter(i => i.status === 'failed')],
  }
}

async function uploadAttendancePhoto(item: AttendanceQueueItem): Promise<string | null> {
  if (item.photoPath) return item.photoPath
  if (!item.photo) return null
  const blob = typeof item.photo === 'string' ? await (await fetch(item.photo)).blob() : item.photo
  const path = `${item.lrn}/${manilaDate(new Date(item.capturedAt))}_${item.action}_${item.clientActionId.slice(0, 8)}.jpg`
  const { error } = await supabase.storage
    .from('attendance_photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) {
    if (isTransientError(error)) throw error
    // Hindi dapat mawala ang oras dahil lang sa litrato: ituloy nang walang litrato.
    console.warn('Photo upload failed, recording time without photo:', error.message)
    return null
  }
  await db.attendanceQueue.update(item.id!, { photoPath: path, photo: null })
  return path
}

let attendanceRun: Promise<SyncResult> | null = null

export function syncAttendance(): Promise<SyncResult> {
  if (attendanceRun) return attendanceRun
  attendanceRun = (async () => {
    let synced = 0
    let failed = 0
    if (!navigator.onLine) return { synced, failed, offline: true }

    const items = await db.attendanceQueue.where('status').equals('pending').sortBy('capturedAt')
    for (const item of items) {
      try {
        const photoPath = await uploadAttendancePhoto(item)
        const { error } = await supabase.rpc('record_attendance', {
          p_action: item.action,
          p_captured_at: item.capturedAt,
          p_photo_path: photoPath,
          p_client_action_id: item.clientActionId,
        })
        if (error) throw error
        await db.attendanceQueue.delete(item.id!)
        synced++
      } catch (err: any) {
        if (isTransientError(err)) return { synced, failed, offline: true }
        await db.attendanceQueue.update(item.id!, { status: 'failed', error: err?.message || String(err) })
        failed++
      }
    }
    return { synced, failed, offline: false }
  })().finally(() => {
    attendanceRun = null
    notify()
  })
  return attendanceRun
}

// =====================================================================
// REQUIREMENTS (PDF)
// =====================================================================

/** Ina-upload ang PDF at sine-save ang record. Nagto-throw kapag pumalpak. */
export async function uploadRequirement(lrn: string, requirementName: string, file: Blob, fileName: string) {
  const path = `${lrn}/${safeFilePart(requirementName)}_${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('requirements_files')
    .upload(path, file, { contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  const { error: dbError } = await supabase.from('requirements').upsert({
    lrn,
    requirement_name: requirementName,
    file_name: fileName,
    file_url: path, // path na (private bucket), hindi public URL
    status: 'Uploaded',
    uploaded_at: new Date().toISOString(),
  }, { onConflict: 'lrn,requirement_name' })
  if (dbError) throw dbError
}

let filesRun: Promise<SyncResult> | null = null

export function syncRequirementFiles(): Promise<SyncResult> {
  if (filesRun) return filesRun
  filesRun = (async () => {
    let synced = 0
    let failed = 0
    if (!navigator.onLine) return { synced, failed, offline: true }

    const items = await db.fileQueue.where('status').anyOf('pending', 'syncing').sortBy('createdAt')
    for (const item of items) {
      try {
        await uploadRequirement(item.lrn, item.requirementName, item.fileBlob, item.fileName)
        await db.fileQueue.delete(item.id!) // binubura lang kapag talagang na-upload
        synced++
      } catch (err: any) {
        if (isTransientError(err)) return { synced, failed, offline: true }
        await db.fileQueue.update(item.id!, { status: 'failed', error: err?.message || String(err) })
        failed++
      }
    }
    return { synced, failed, offline: false }
  })().finally(() => {
    filesRun = null
    notify()
  })
  return filesRun
}

// =====================================================================
// FAILED ITEMS
// =====================================================================

export async function retryFailed(lrn: string) {
  await db.attendanceQueue.where('lrn').equals(lrn).filter(i => i.status === 'failed')
    .modify({ status: 'pending', error: undefined })
  await db.fileQueue.where('lrn').equals(lrn).filter(i => i.status === 'failed')
    .modify({ status: 'pending', error: undefined })
  return syncAll()
}

export async function discardAttendanceItem(id: number) {
  await db.attendanceQueue.delete(id)
  notify()
}

export async function discardFileItem(id: number) {
  await db.fileQueue.delete(id)
  notify()
}

// =====================================================================
// BACKGROUND SYNC
// =====================================================================

export async function syncAll() {
  const a = await syncAttendance()
  const f = await syncRequirementFiles()
  return { synced: a.synced + f.synced, failed: a.failed + f.failed, offline: a.offline || f.offline }
}

/** Kusang nagsi-sync: pagbukas ng app, pagbalik ng internet, pagbalik sa app, at bawat 2 minuto. */
export function startBackgroundSync() {
  const run = () => { if (navigator.onLine) syncAll().catch(console.error) }
  const onVisible = () => { if (document.visibilityState === 'visible') run() }
  window.addEventListener('online', run)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(run, 2 * 60 * 1000)
  run()
  return () => {
    window.removeEventListener('online', run)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}

export type { AttendanceQueueItem }
