import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Wifi, WifiOff, Clock, Camera, CheckCircle, RefreshCw, LogOut, BookOpen } from 'lucide-react'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'

export default function StudentDashboard({ onOpenDiary }: { onOpenDiary: () => void }) {
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [time, setTime] = useState(new Date())
  
  const [hasTimedIn, setHasTimedIn] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  
  const [pendingSyncs, setPendingSyncs] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraMode, setCameraMode] = useState<'TIME_IN' | 'TIME_OUT'>('TIME_IN')

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

  // === CHECK STATUS ===
  const checkStatus = async () => {
    const count = await db.syncQueue.where('status').equals('pending').count()
    setPendingSyncs(count)
    
    if (isOnline && user?.id) {
      const today = new Date().toLocaleDateString('en-CA') 
      
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('lrn', user.id)
        .eq('date', today)
        .single()
      
      if (data) {
        setHasTimedIn(true)
        if (data.time_out) setHasTimedOut(true)
      }
    }
  }

  useEffect(() => {
    checkStatus()
  }, [isOnline, hasTimedIn, hasTimedOut])

  // === UPLOAD IMAGE ===
  const uploadPhoto = async (base64Data: string, action: string) => {
    if (!isOnline) return base64Data
    
    try {
      const fileName = `${user?.id}/${new Date().getTime()}_${action}.jpg`
      const blob = await (await fetch(base64Data)).blob()
      
      const { error } = await supabase.storage
        .from('attendance_photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' })
      
      if (error) throw error
      
      const { data: urlData } = supabase.storage
        .from('attendance_photos')
        .getPublicUrl(fileName)
        
      return urlData.publicUrl
    } catch (err) {
      console.error("Upload error:", err)
      return base64Data
    }
  }

  // === SYNC FUNCTION ===
  const syncData = async () => {
    if (!isOnline) return alert("Walang internet.")
    
    const pendingItems = await db.syncQueue.where('status').equals('pending').toArray()
    if (pendingItems.length === 0) return
    
    setIsSyncing(true)

    for (const item of pendingItems) {
      let isSuccess = false;
      
      try {
        if (item.action === 'TIME_IN') {
          const { error } = await supabase.from('attendance').insert({
            lrn: item.payload.lrn,
            date: item.payload.date,
            time_in: item.payload.time,
            time_in_photo: item.payload.photo_url
          })
          if (error && error.code !== '23505') throw error
          isSuccess = true;
        } 
        else if (item.action === 'TIME_OUT') {
          const { error } = await supabase.from('attendance').update({
            time_out: item.payload.time,
            time_out_photo: item.payload.photo_url
          })
          .eq('lrn', item.payload.lrn)
          .eq('date', item.payload.date)
          
          if (error) throw error
          isSuccess = true;
        }
      } catch (err: any) {
        console.error("SYNC ERROR:", err.message)
        alert("Sync Failed: " + (err.message || "Unknown error"))
      }

      if (isSuccess) {
        await db.syncQueue.delete(item.id!)
      }
    }
    
    setIsSyncing(false)
    checkStatus()
  }

  // === CAMERA ===
  const startCamera = async (mode: 'TIME_IN' | 'TIME_OUT') => {
    setCameraMode(mode)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      setIsCameraOpen(true)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      }, 100)
    } catch (err) {
      alert("Hindi ma-access ang camera.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraOpen(false)
  }

  // === CAPTURE IMAGE ===
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
    const today = now.toLocaleDateString('en-CA') 
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false })

    await db.syncQueue.add({
      action: cameraMode,
      payload: { 
        lrn: user?.id, 
        date: today, 
        time: timeStr, 
        photo_url: photoUrl 
      },
      status: 'pending',
      createdAt: now.toISOString()
    })

    if (cameraMode === 'TIME_IN') setHasTimedIn(true)
    else setHasTimedOut(true)

    checkStatus()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-gray-800">Hello, {user?.name.split(' ')[0]}!</h1>
          <p className="text-xs text-gray-500">{user?.section}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        
        {!isOnline && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm text-center border border-red-100">
            Offline ka ngayon. Ang iyong data ay awtomatikong ipapadala kapag may internet na.
          </div>
        )}

        {isSyncing && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm flex items-center justify-center gap-2 border border-blue-100">
            <RefreshCw className="animate-spin" size={16} /> Nag-sa-sync ng data...
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-4xl font-bold text-gray-800 tracking-tight mb-1">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm text-gray-500 mb-6">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>

          {isCameraOpen ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square w-full max-w-[300px] mx-auto">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {cameraMode === 'TIME_IN' ? 'Time In' : 'Time Out'}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={stopCamera} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold">Cancel</button>
                <button onClick={captureImage} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200">Capture</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {!hasTimedIn && (
                <button
                  onClick={() => startCamera('TIME_IN')}
                  className="w-full py-4 rounded-xl flex flex-col items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  <Camera size={28} />
                  <span className="font-bold text-lg">Time In Now</span>
                </button>
              )}

              {hasTimedIn && !hasTimedOut && (
                <button
                  onClick={() => startCamera('TIME_OUT')}
                  className="w-full py-4 rounded-xl flex flex-col items-center justify-center gap-2 bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all"
                >
                  <LogOut size={28} />
                  <span className="font-bold text-lg">Time Out Now</span>
                </button>
              )}

              {hasTimedIn && hasTimedOut && (
                <div className="w-full py-4 rounded-xl flex flex-col items-center justify-center gap-2 bg-gray-100 text-gray-400">
                  <CheckCircle size={28} />
                  <span className="font-bold text-lg">Completed for today!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DAILY DIARY BUTTON */}
        <button
          onClick={onOpenDiary}
          className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <BookOpen size={20} className="text-blue-600" /> My Daily Diary
        </button>

        {pendingSyncs > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center justify-between text-yellow-800 text-sm">
            <div className="flex items-center gap-3">
              <Clock size={20} className="shrink-0" />
              <p>May <strong>{pendingSyncs}</strong> kang hindi pa naka-sync.</p>
            </div>
            <button 
              onClick={syncData}
              disabled={!isOnline || isSyncing}
              className="bg-yellow-200 hover:bg-yellow-300 text-yellow-900 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
            >
              Sync Now
            </button>
          </div>
        )}

        <button onClick={logout} className="w-full text-red-500 text-sm font-medium py-2">
          Logout
        </button>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
