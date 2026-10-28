import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Wifi, WifiOff, Clock, Camera, CheckCircle, RefreshCw } from 'lucide-react'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [time, setTime] = useState(new Date())
  const [hasTimedIn, setHasTimedIn] = useState(false)
  const [pendingSyncs, setPendingSyncs] = useState(0)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

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

  const checkQueue = async () => {
    const count = await db.syncQueue.where('status').equals('pending').count()
    setPendingSyncs(count)
  }

  useEffect(() => {
    checkQueue()
  }, [hasTimedIn])

  // MANUAL SYNC LANG MUNA, WALANG AUTO SYNC
  const syncData = async () => {
    if (!isOnline) {
      alert("Walang internet.")
      return
    }
    
    const pendingItems = await db.syncQueue.where('status').equals('pending').toArray()
    if (pendingItems.length === 0) {
      alert("Walang naka-queue na data.")
      return
    }
    
    setIsSyncing(true)

    for (const item of pendingItems) {
      let isSuccess = false;
      
      try {
        if (item.action === 'TIME_IN') {
          console.log("Sinusubukang i-sync ito:", item.payload) // <--- TIGNAN NATIN ITO
          
          const { error } = await supabase.from('attendance').insert({
            lrn: item.payload.lrn,
            date: item.payload.date,
            time_in: item.payload.time
          })
          
          if (error) {
            console.error("SUPABASE ERROR:", error.message, "| CODE:", error.code) // <--- DITO LALABAS ANG ERROR
            throw error
          }
          isSuccess = true;
        }
      } catch (err) {
        console.error("CATCH BLOCK:", err)
      }

      if (isSuccess) {
        await db.syncQueue.delete(item.id!)
      } else {
        alert("Hindi na-sync. Tingnan ang Console (F12) para sa detalye.")
      }
    }
    
    setIsSyncing(false)
    checkQueue()
  }

  // KINOMENTOHAN NATIN ANG AUTO SYNC PARA HINDI AGAD MAWALA
  // useEffect(() => {
  //   if (isOnline) {
  //     syncData()
  //   }
  // }, [isOnline])

  const startCamera = async () => {
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

  const captureAndTimeIn = async () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0]

    await db.syncQueue.add({
      action: 'TIME_IN',
      payload: { lrn: user?.id, date: today, time: timeStr }, 
      status: 'pending',
      createdAt: now.toISOString()
    })
    
    setHasTimedIn(true)
    checkQueue()
    stopCamera()
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
              </div>
              <div className="flex gap-2">
                <button onClick={stopCamera} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold">Cancel</button>
                <button onClick={captureAndTimeIn} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200">Capture</button>
              </div>
            </div>
          ) : (
            <button
              onClick={startCamera}
              disabled={hasTimedIn}
              className={`w-full py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
                hasTimedIn ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              }`}
            >
              {hasTimedIn ? <CheckCircle size={28} /> : <Camera size={28} />}
              <span className="font-bold text-lg">{hasTimedIn ? 'Timed In Today' : 'Time In Now'}</span>
            </button>
          )}
        </div>

        {/* Pending Sync Info - MANANATILI NA ITO DAHIL WALANG AUTO-SYNC */}
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
