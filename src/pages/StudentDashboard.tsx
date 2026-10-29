import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Wifi, WifiOff, Clock, Camera, CheckCircle, RefreshCw, LogOut, BookOpen, FileText, Sun, Moon, User } from 'lucide-react'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'

export default function StudentDashboard({ onOpenDiary, onOpenRequirements, onOpenProfile }: { onOpenDiary: () => void; onOpenRequirements: () => void; onOpenProfile: () => void }) {
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [time, setTime] = useState(new Date())
  const [pendingSyncs, setPendingSyncs] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [announcement, setAnnouncement] = useState<{title: string, body: string} | null>(null)
  
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [cameraMode, setCameraMode] = useState<'MORNING_IN' | 'MORNING_OUT' | 'AFTERNOON_IN' | 'AFTERNOON_OUT'>('MORNING_IN')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

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
    }
  }, [])

  const fetchTodayRecord = async () => {
    const count = await db.syncQueue.where('status').equals('pending').count()
    setPendingSyncs(count)
    
    if (isOnline && user?.id) {
      const now = new Date()
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
      const { data } = await supabase.from('attendance').select('*').eq('lrn', user.id).eq('date', today).single()
      if (data) setTodayRecord(data)
      
      const { data: annData } = await supabase.from('announcements').select('*').order('created_at', {ascending: false}).limit(1)
      if (annData && annData.length > 0) setAnnouncement(annData[0])
    }
  }

  useEffect(() => { fetchTodayRecord() }, [isOnline])

  const uploadPhoto = async (base64Data: string, action: string) => {
    if (!isOnline) return base64Data
    try {
      const fileName = `${user?.id}/${new Date().getTime()}_${action}.jpg`
      const blob = await (await fetch(base64Data)).blob()
      const { error } = await supabase.storage.from('attendance_photos').upload(fileName, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('attendance_photos').getPublicUrl(fileName)
      return urlData.publicUrl
    } catch (err) { console.error("Upload error:", err); return base64Data }
  }

  const syncData = async () => {
    if (!isOnline) return alert("Walang internet.")
    const pendingItems = await db.syncQueue.where('status').equals('pending').toArray()
    if (pendingItems.length === 0) return
    setIsSyncing(true)
    for (const item of pendingItems) {
      let isSuccess = false;
      try {
        if (item.action.startsWith('MORNING') || item.action.startsWith('AFTERNOON')) {
          const { error } = await supabase.from('attendance').upsert(item.payload, { onConflict: 'lrn,date' })
          if (error) throw error
          isSuccess = true;
        }
      } catch (err: any) { console.error("SYNC ERROR:", err.message); alert("Sync Failed: " + (err.message || "Unknown")) }
      if (isSuccess) await db.syncQueue.delete(item.id!)
    }
    setIsSyncing(false)
    fetchTodayRecord()
  }

  const startCamera = async (mode: 'MORNING_IN' | 'MORNING_OUT' | 'AFTERNOON_IN' | 'AFTERNOON_OUT') => {
    setCameraMode(mode)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      setIsCameraOpen(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream }, 100)
    } catch (err) { alert("Hindi ma-access ang camera.") }
  }

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null) }
    setIsCameraOpen(false)
  }

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.4)
    stopCamera()
    const photoUrl = await uploadPhoto(photoBase64, cameraMode)
    
    const now = new Date()
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0')

    let payload: any = {
      lrn: user?.id, date: today,
      time_in_photo: todayRecord?.time_in_photo || null,
      time_out_photo: todayRecord?.time_out_photo || null
    }
    if (todayRecord) payload = { ...todayRecord, ...payload }

    if (cameraMode === 'MORNING_IN') { payload.morning_in = timeStr; payload.time_in_photo = photoUrl } 
    else if (cameraMode === 'MORNING_OUT') { payload.morning_out = timeStr } 
    else if (cameraMode === 'AFTERNOON_IN') { payload.afternoon_in = timeStr } 
    else if (cameraMode === 'AFTERNOON_OUT') { payload.afternoon_out = timeStr; payload.time_out_photo = photoUrl }

    await db.syncQueue.add({ action: cameraMode, payload: payload, status: 'pending', createdAt: now.toISOString() })
    setTodayRecord(payload)
    fetchTodayRecord()
  }

  const getButtonState = () => {
    if (!todayRecord) return 'MORNING_IN'
    if (!todayRecord.morning_in) return 'MORNING_IN'
    if (!todayRecord.morning_out) return 'MORNING_OUT'
    if (!todayRecord.afternoon_in) return 'AFTERNOON_IN'
    if (!todayRecord.afternoon_out) return 'AFTERNOON_OUT'
    return 'COMPLETED'
  }

  const currentState = getButtonState()

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
            <p className="text-blue-900/80">{announcement.body}</p>
          </div>
        )}

        {!isOnline && <div className="bg-red-50/80 backdrop-blur-md text-red-700 p-3 rounded-2xl text-sm text-center border border-red-100 font-medium">Offline ka ngayon.</div>}
        {isSyncing && <div className="bg-blue-50/80 backdrop-blur-md text-blue-700 p-3 rounded-2xl text-sm flex items-center justify-center gap-2 border border-blue-100 font-medium"><RefreshCw className="animate-spin" size={16} /> Nag-sa-sync...</div>}

        <div className="glass-card p-6 rounded-3xl text-center">
          <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight mb-1">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm text-gray-500 mb-6 font-medium">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>

          {isCameraOpen ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square w-full max-w-[280px] mx-auto shadow-lg">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-medium">{cameraMode.replace('_', ' ')}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={stopCamera} className="flex-1 py-3 rounded-xl bg-gray-200/80 text-gray-700 font-bold hover:bg-gray-300/80 transition-colors">Cancel</button>
                <button onClick={captureImage} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">Capture</button>
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

        {/* BAGONG BUTTON PARA SA PROFILE */}
        <button onClick={onOpenProfile} className="glass-card w-full p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors">
          <div className="bg-orange-100 text-orange-600 p-2 rounded-xl"><User size={24} /></div>
          <span className="font-bold text-sm text-gray-700">My Profile</span>
        </button>

        {pendingSyncs > 0 && (
          <div className="glass-card p-4 rounded-2xl flex items-center justify-between text-yellow-800 text-sm">
            <div className="flex items-center gap-3"><Clock size={20} className="shrink-0 text-yellow-600" /><p>May <strong>{pendingSyncs}</strong> kang pending.</p></div>
            <button onClick={syncData} disabled={!isOnline || isSyncing} className="bg-yellow-200/80 hover:bg-yellow-300 text-yellow-900 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 backdrop-blur-sm">Sync Now</button>
          </div>
        )}

        <button onClick={logout} className="w-full text-red-500/80 text-sm font-bold py-3 hover:text-red-600 transition-colors">Logout</button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
