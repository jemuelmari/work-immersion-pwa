import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register' // Idinagdag
import StudentDashboard from './pages/StudentDashboard'
import StudentDiary from './pages/StudentDiary'
import TeacherDashboard from './pages/TeacherDashboard'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'diary' | 'register'>('dashboard')

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  
  if (!user) {
    if (currentPage === 'register') return <Register />
    return <Login onGoToRegister={() => setCurrentPage('register')} />
  }

  if (user.role === 'Student') {
    if (currentPage === 'diary') return <StudentDiary onBack={() => setCurrentPage('dashboard')} />
    return <StudentDashboard onOpenDiary={() => setCurrentPage('diary')} />
  }

  return <TeacherDashboard />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
