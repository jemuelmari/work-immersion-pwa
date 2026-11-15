import Dexie, { Table } from 'dexie'

export type AttendanceAction = 'MORNING_IN' | 'MORNING_OUT' | 'AFTERNOON_IN' | 'AFTERNOON_OUT'

export const ACTION_FIELD: Record<AttendanceAction, 'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out'> = {
  MORNING_IN: 'morning_in',
  MORNING_OUT: 'morning_out',
  AFTERNOON_IN: 'afternoon_in',
  AFTERNOON_OUT: 'afternoon_out',
}

/** Isang time-in/out na naghihintay ma-sync. */
export interface AttendanceQueueItem {
  id?: number
  clientActionId: string        // pang-iwas sa doble kapag na-retry
  lrn: string
  action: AttendanceAction
  capturedAt: string            // ISO; oras nang pindutin ang Capture
  photo?: Blob | string | null  // Blob (bago) o data URL (galing sa lumang version)
  photoPath?: string | null     // naka-upload na sa Storage
  status: 'pending' | 'failed'
  error?: string
  createdAt: string
}

/** Lumang format (version 2). Kino-convert na sa attendanceQueue. */
export interface SyncQueueItem {
  id?: number
  action: string
  payload: any
  status: 'pending' | 'syncing' | 'failed'
  createdAt: string
}

export interface FileQueueItem {
  id?: number
  lrn: string
  requirementName: string
  fileBlob: Blob
  fileName: string
  status: 'pending' | 'syncing' | 'failed'
  error?: string
  createdAt: string
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export { newId }

export class AppDatabase extends Dexie {
  syncQueue!: Table<SyncQueueItem>
  fileQueue!: Table<FileQueueItem>
  attendanceQueue!: Table<AttendanceQueueItem>

  constructor() {
    super('WorkImmersionDB')
    this.version(2).stores({
      syncQueue: '++id, action, status, createdAt',
      fileQueue: '++id, lrn, requirementName, status, createdAt'
    })
    this.version(3)
      .stores({
        syncQueue: '++id, action, status, createdAt',
        fileQueue: '++id, lrn, requirementName, status, createdAt',
        attendanceQueue: '++id, clientActionId, lrn, status, capturedAt'
      })
      .upgrade(async tx => {
        // I-convert ang mga naiwang time-in mula sa lumang version para hindi mawala.
        const old = await tx.table('syncQueue').toArray() as SyncQueueItem[]
        for (const item of old) {
          const action = item.action as AttendanceAction
          const field = ACTION_FIELD[action]
          const p = item.payload || {}
          if (!field || !p.lrn || !p.date || !p[field]) continue
          const capturedAt = new Date(`${p.date}T${p[field]}+08:00`)
          if (isNaN(capturedAt.getTime())) continue
          let photo: string | null = null
          let photoPath: string | null = null
          const rawPhoto = action === 'MORNING_IN' ? p.time_in_photo : action === 'AFTERNOON_OUT' ? p.time_out_photo : null
          if (typeof rawPhoto === 'string') {
            if (rawPhoto.startsWith('data:')) photo = rawPhoto
            else {
              const i = rawPhoto.indexOf('/attendance_photos/')
              if (i !== -1) photoPath = decodeURIComponent(rawPhoto.slice(i + '/attendance_photos/'.length))
            }
          }
          await tx.table('attendanceQueue').add({
            clientActionId: newId(),
            lrn: p.lrn,
            action,
            capturedAt: capturedAt.toISOString(),
            photo,
            photoPath,
            status: 'pending',
            createdAt: item.createdAt || new Date().toISOString(),
          } as AttendanceQueueItem)
        }
        await tx.table('syncQueue').clear()
      })
  }
}

export const db = new AppDatabase()
