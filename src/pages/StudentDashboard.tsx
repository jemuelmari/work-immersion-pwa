import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Wifi, WifiOff, Clock, Camera } from 'lucide-react'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [time, setTime] = useState(new Date())
  const [hasTimedIn, setHasTimedIn] = useState(false)
  const [pendingSyncs, setPendingSyncs] = useState(0)

  // Relo at Network Status
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

  // I-check kung may pending syncs sa IndexedDB
  useEffect(() => {
    const checkQueue = async () => {
      const count = await db.syncQueue.where('status').equals('pending').count()
      setPendingSyncs(count)
    }
    checkQueue()
  }, [hasTimedIn])

  const handleTimeIn = async () => {
    if (!user) return
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // 1. I-save sa IndexedDB (Offline First)
    await db.syncQueue.add({
      action: 'TIME_IN',
      payload: { lrn: user.id, date: today, time: now.toTimeString().split(' ')[0] },
      status: 'pending',
      createdAt: now.toISOString()
    })
    
    setHasTimedIn(true)
    setPendingSyncs(prev => prev + 1)

    // 2. Kung online, subukang i-sync agad
    if (isOnline) {
      // Dito papasok ang sync logic natin mamaya
      console.log("Online: Attempting to sync...")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
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

      {/* Main Content */}
      <div className="p-4 max-w-md mx-auto space-y-4">
        
        {/* Relo at Time In Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100">
          <div className="text-4xl font-bold text-gray-800 tracking-tight mb-1">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm text-gray-500 mb-6">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>

          <button
            onClick={handleTimeIn}
            disabled={hasTimedIn}
            className={`w-full py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
              hasTimedIn ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
            }`}
          >
            <Camera size={28} />
            <span className="font-bold text-lg">{hasTimedIn ? 'Timed In Today' : 'Time In Now'}</span>
          </button>
        </div>

        {/* Pending Sync Info */}
        {pendingSyncs > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center gap-3 text-yellow-800 text-sm">
            <Clock size={20} className="shrink-0" />
            <p>May <strong>{pendingSyncs}</strong> kang hindi pa naka-sync. Ito ay awtomatikong ipapadala kapag bumalik ang internet.</p>
          </div>
        )}

        <button onClick={logout} className="w-full text-red-500 text-sm font-medium py-2">
          Logout
        </button>
      </div>
    </div>
  )
}
