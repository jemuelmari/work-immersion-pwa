import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ChangePassword from './pages/ChangePassword'
import StudentDashboard from './pages/StudentDashboard'
import StudentDiary from './pages/StudentDiary'
import StudentRequirements from './pages/StudentRequirements'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherScores from './pages/TeacherScores'
import TeacherAnnouncements from './pages/TeacherAnnouncements'

type Page = 'dashboard' | 'diary' | 'register' | 'change-password' | 'requirements' | 'scores' | 'announcements'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  useEffect(() => {
    if (user && user.role === 'Student' && user.isFirstLogin && currentPage !== 'change-password') {
      setCurrentPage('change-password')
    }
  }, [user, currentPage])

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  
  if (!user) {
    if (currentPage === 'register') return <Register onBack={() => setCurrentPage('dashboard')} />
    return <Login onGoToRegister={() => setCurrentPage('register')} />
  }

  if (currentPage === 'change-password') return <ChangePassword onComplete={() => setCurrentPage('dashboard')} />

  if (user.role === 'Student') {
    if (currentPage === 'diary') return <StudentDiary onBack={() => setCurrentPage('dashboard')} />
    if (currentPage === 'requirements') return <StudentRequirements onBack={() => setCurrentPage('dashboard')} />
    return <StudentDashboard onOpenDiary={() => setCurrentPage('diary')} onOpenRequirements={() => setCurrentPage('requirements')} />
  }

  if (currentPage === 'scores') return <TeacherScores onBack={() => setCurrentPage('dashboard')} />
  if (currentPage === 'announcements') return <TeacherAnnouncements onBack={() => setCurrentPage('dashboard')} />
  
  return <TeacherDashboard onOpenScores={() => setCurrentPage('scores')} onOpenAnnouncements={() => setCurrentPage('announcements')} />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
