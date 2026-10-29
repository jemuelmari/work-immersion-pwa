import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import TeacherRegister from './pages/TeacherRegister'
import ForgotPassword from './pages/ForgotPassword' // BAGO
import ChangePassword from './pages/ChangePassword'
import StudentDashboard from './pages/StudentDashboard'
import StudentDiary from './pages/StudentDiary'
import StudentRequirements from './pages/StudentRequirements'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherScores from './pages/TeacherScores'
import TeacherAnnouncements from './pages/TeacherAnnouncements'

type Page = 'dashboard' | 'diary' | 'register' | 'teacher-register' | 'forgot-password' | 'change-password' | 'requirements' | 'scores' | 'announcements'

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
    if (currentPage === 'teacher-register') return <TeacherRegister onBack={() => setCurrentPage('dashboard')} />
    if (currentPage === 'forgot-password') return <ForgotPassword onBack={() => setCurrentPage('dashboard')} />
    
    return <Login 
      onGoToRegister={() => setCurrentPage('register')} 
      onGoToTeacherRegister={() => setCurrentPage('teacher-register')} 
      onGoToForgotPassword={() => setCurrentPage('forgot-password')}
    />
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
