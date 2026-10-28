import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import StudentDashboard from './pages/StudentDashboard'
import StudentDiary from './pages/StudentDiary'
import TeacherDashboard from './pages/TeacherDashboard'

function AppContent() {
  const { user, loading } = useAuth()
  // State para malaman kung anong page ang bubuksan (dashboard o diary)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'diary'>('dashboard')

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Login />
  }

  // === STUDENT VIEWS ===
  if (user.role === 'Student') {
    if (currentPage === 'diary') {
      return <StudentDiary onBack={() => setCurrentPage('dashboard')} />
    }
    // Ipapasa natin ang function na magpapalit ng page papuntang Diary
    return <StudentDashboard onOpenDiary={() => setCurrentPage('diary')} />
  }

  // === TEACHER VIEW ===
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
