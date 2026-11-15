import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Wifi, WifiOff, Clock, CheckCircle, RefreshCw, BookOpen, FileText, Sun, Moon, User, AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AttendanceAction, ACTION_FIELD, AttendanceQueueItem, FileQueueItem } from '../lib/db'
import { manilaDate } from '../lib/constants'
import {
  queueAttendance, getQueuedForDate, getQueueCounts, syncAll, retryFailed,
  discardAttendanceItem, discardFileItem, SYNC_EVENT,
} from '../lib/sync'

type DayRecord = Partial<Record<'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out', string | null>>
type FailedItem = AttendanceQueueItem | FileQueueItem

const ACTION_LABEL: Record<AttendanceAction, string> = {
  MORNING_IN: 'Morning Time In',
  MORNING_OUT: 'Morning Time Out',
  AFTERNOON_IN: 'Afternoon Time In',
  AFTERNOON_OUT: 'Afternoon Time Out',
}

const toTimeString = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso))

const formatTime = (t?: string | null) => {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export default function StudentDashboard({ onOpenDiary, onOpenRequirements, onOpenProfile }: { onOpenDiary: () => void; onOpenRequirements: () => void; onOpenProfile: () => void }) {
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [time, setTime] = useState(new Date())
  const [pendingCount, setPendingCount] = useState(0)
  const [failedItems, setFailedItems] = useState<FailedItem[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [announcement, setAnnouncement] = useState<{ title: string; body: string } | null>(null)

  // Ang record ngayong araw = galing server + mga naka-queue pa sa device
  const [serverRecord, setServerRecord] = useState<DayRecord | null>(null)
  const [queuedRecord, setQueuedRecord] = useState<DayRecord>({})
  const [cameraMode, setCameraMode] = useState<AttendanceAction>('MORNING_IN')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const today = manilaDate(time)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const refreshLocal = useCallback(async () => {
    if (!user?.id) return
    const date = manilaDate()
    const queued = await getQueuedForDate(user.id, date)
    const rec: DayRecord = {}
    for (const item of queued) {
      if (item.status === 'pending') rec[ACTION_FIELD[item.action]] = toTimeString(item.capturedAt)
    }
    setQueuedRecord(rec)
    const counts = await getQueueCounts(user.id)
    setPendingCount(counts.pending)
    setFailedItems(counts.failed)
  }, [user?.id])

  const refreshServer = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return
    const date = manilaDate()
    const { data } = await supabase
      .from('attendance')
      .select('morning_in, morning_out, afternoon_in, afternoon_out')
      .eq('lrn', user.id)
      .eq('date', date)
      .maybeSingle()
    setServerRecord(data ?? null)

    const { data: annData } = await supabase.from('announcements').select('title, body').order('created_at', { ascending: false }).limit(1)
    setAnnouncement(annData && annData.length > 0 ? annData[0] : null)
  }, [user?.id])

  // Unang load, pagbalik ng internet, pagpalit ng araw
  useEffect(() => { refreshLocal(); refreshServer() }, [isOnline, today, refreshLocal, refreshServer])

  // Tuwing matapos ang background sync
  useEffect(() => {
    const onSync = () => { refreshLocal(); refreshServer() }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [refreshLocal, refreshServer])

  const record: DayRecord = {
    morning_in: serverRecord?.morning_in || queuedRecord.morning_in,
    morning_out: serverRecord?.morning_out || queuedRecord.morning_out,
    afternoon_in: serverRecord?.afternoon_in || queuedRecord.afternoon_in,
    afternoon_out: serverRecord?.afternoon_out || queuedRecord.afternoon_out,
  }

  const getButtonState = (): AttendanceAction | 'COMPLETED' => {
    if (!record.morning_in) return 'MORNING_IN'
    if (!record.morning_out) return 'MORNING_OUT'
    if (!record.afternoon_in) return 'AFTERNOON_IN'
    if (!record.afternoon_out) return 'AFTERNOON_OUT'
    return 'COMPLETED'
  }
  const currentState = getButtonState()

  const handleSyncNow = async () => {
    setIsSyncing(true)
    const result = await retryFailed(user!.id)
    setIsSyncing(false)
    if (result.offline) alert('Walang internet o hindi maabot ang server. Kusang magsi-sync kapag bumalik ang internet.')
  }

  const handleDiscard = async (item: FailedItem) => {
    if (!confirm('Burahin ang item na ito sa device? Hindi na ito maipapadala.')) return
    if ('action' in item) await discardAttendanceItem(item.id!)
    else await discardFileItem(item.id!)
  }

  const startCamera = async (mode: AttendanceAction) => {
    setCameraMode(mode)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } })
      streamRef.current = mediaStream
      setIsCameraOpen(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream }, 100)
    } catch {
      alert('Hindi ma-access ang camera. Payagan ang camera permission sa browser settings.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setIsCameraOpen(false)
  }

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !user?.id || isSaving) return
    setIsSaving(true)
    const video = videoRef.current
    const canvas = canvasRef.current
    const maxSize = 640
    const scale = Math.min(1, maxSize / Math.max(video.videoWidth || maxSize, video.videoHeight || maxSize))
    canvas.width = Math.round((video.videoWidth || maxSize) * scale)
    canvas.height = Math.round((video.videoHeight || maxSize) * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.6))
    stopCamera()

    // Litrato lang sa Morning In at Afternoon Out (gaya ng dati)
    const needsPhoto = cameraMode === 'MORNING_IN' || cameraMode === 'AFTERNOON_OUT'
    try {
      await queueAttendance(user.id, cameraMode, needsPhoto ? blob : null)
      await refreshLocal()
      syncAll().catch(console.error) // ipadala agad kung online
    } catch (err: any) {
      alert('Hindi na-save ang attendance: ' + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  const isQueued = (field: keyof DayRecord) => !serverRecord?.[field] && !!queuedRecord[field]

  return (
    <div className="min-h-screen pb-20">
      <div className="glass-panel p-4 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Hello, {user?.name.split(' ')[0]}!</h1>
          <p className="text-xs text-gray-500 font-medium">{user?.section}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4 mt-2">
        {announcement && (
          <div className="glass-card p-4 rounded-2xl text-blue-800 text-sm border-l-4 border-l-blue-500">
            <h3 className="font-bold mb-1 flex items-center gap-1">📢 {announcement.title}</h3>
            <p className="text-blue-900/80 whitespace-pre-wrap">{announcement.body}</p>
          </div>
        )}

        {!isOnline && <div className="bg-red-50/80 backdrop-blur-md text-red-700 p-3 rounded-2xl text-sm text-center border border-red-100 font-medium">Offline ka ngayon. Puwede ka pa ring mag-time in/out — kusang ipapadala kapag may internet na.</div>}
        {isSyncing && <div className="bg-blue-50/80 backdrop-blur-md text-blue-700 p-3 rounded-2xl text-sm flex items-center justify-center gap-2 border border-blue-100 font-medium"><RefreshCw className="animate-spin" size={16} /> Nag-sa-sync...</div>}

        <div className="glass-card p-6 rounded-3xl text-center">
          <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight mb-1">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })}
          </div>
          <div className="text-sm text-gray-500 mb-6 font-medium">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}</div>

          {isCameraOpen ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square w-full max-w-[280px] mx-auto shadow-lg">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-medium">{ACTION_LABEL[cameraMode]}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={stopCamera} className="flex-1 py-3 rounded-xl bg-gray-200/80 text-gray-700 font-bold hover:bg-gray-300/80 transition-colors">Cancel</button>
                <button onClick={captureImage} disabled={isSaving} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50">Capture</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentState === 'MORNING_IN' && <button onClick={() => startCamera('MORNING_IN')} className="glass-button-primary w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-white"><Sun size={28} /><span className="font-bold text-lg">Morning Time In</span></button>}
              {currentState === 'MORNING_OUT' && <button onClick={() => startCamera('MORNING_OUT')} className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-bold shadow-lg shadow-orange-200 hover:from-orange-500 hover:to-orange-600 transition-all"><Sun size={28} /><span className="text-lg">Morning Time Out</span></button>}
              {currentState === 'AFTERNOON_IN' && <button onClick={() => startCamera('AFTERNOON_IN')} className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:from-blue-500 hover:to-blue-700 transition-all"><Moon size={28} /><span className="text-lg">Afternoon Time In</span></button>}
              {currentState === 'AFTERNOON_OUT' && <button onClick={() => startCamera('AFTERNOON_OUT')} className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gradient-to-r from-indigo-400 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-indigo-700 transition-all"><Moon size={28} /><span className="text-lg">Afternoon Time Out</span></button>}
              {currentState === 'COMPLETED' && <div className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gray-100/50 text-gray-400 border border-gray-200"><CheckCircle size={28} /><span className="font-bold text-lg">Completed for today!</span></div>}
            </div>
          )}

          {/* Buod ng oras ngayong araw */}
          {record.morning_in && (
            <div className="grid grid-cols-2 gap-2 mt-5 text-xs">
              {(['morning_in', 'morning_out', 'afternoon_in', 'afternoon_out'] as const).map(f => (
                <div key={f} className="bg-white/50 rounded-xl px-3 py-2 text-left">
                  <p className="text-gray-500 font-medium capitalize">{f.replace('_', ' ')}</p>
                  <p className="font-bold text-gray-800">
                    {formatTime(record[f])}
                    {isQueued(f) && <span className="ml-1 text-yellow-600 font-medium">(hindi pa na-sync)</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onOpenDiary} className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white/90 transition-colors">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><BookOpen size={24} /></div>
            <span className="font-bold text-sm text-gray-700">My Diary</span>
          </button>
          <button onClick={onOpenRequirements} className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white/90 transition-colors">
            <div className="bg-green-100 text-green-600 p-2 rounded-xl"><FileText size={24} /></div>
            <span className="font-bold text-sm text-gray-700">Requirements</span>
          </button>
        </div>

        <button onClick={onOpenProfile} className="glass-card w-full p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors">
          <div className="bg-orange-100 text-orange-600 p-2 rounded-xl"><User size={24} /></div>
          <span className="font-bold text-sm text-gray-700">My Profile</span>
        </button>

        {(pendingCount > 0 || failedItems.length > 0) && (
          <div className="glass-card p-4 rounded-2xl text-sm space-y-3">
            <div className="flex items-center justify-between text-yellow-800">
              <div className="flex items-center gap-3">
                <Clock size={20} className="shrink-0 text-yellow-600" />
                <p>
                  {pendingCount > 0 && <>May <strong>{pendingCount}</strong> na hindi pa na-sync. </>}
                  {failedItems.length > 0 && <>May <strong>{failedItems.length}</strong> na pumalpak.</>}
                </p>
              </div>
              <button onClick={handleSyncNow} disabled={!isOnline || isSyncing} className="bg-yellow-200/80 hover:bg-yellow-300 text-yellow-900 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 backdrop-blur-sm shrink-0">Sync Now</button>
            </div>

            {failedItems.map(item => (
              <div key={('action' in item ? 'a' : 'f') + item.id} className="bg-red-50/80 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-red-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold">
                    {'action' in item
                      ? `${ACTION_LABEL[item.action]} — ${new Date(item.capturedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`
                      : `${item.requirementName} (${item.fileName})`}
                  </p>
                  <p>{item.error}</p>
                </div>
                <button onClick={() => handleDiscard(item)} title="Burahin" className="p-1 text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (pendingCount > 0 && !confirm('May mga hindi pa na-sync. Kapag nag-logout ka, maiiwan ang mga ito sa device na ito at maipapadala lang kapag nag-login ka ulit dito. Tuloy?')) return
            logout()
          }}
          className="w-full text-red-500/80 text-sm font-bold py-3 hover:text-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
