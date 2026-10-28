import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Login />
  }

  // Kung Student, ipakita ang StudentDashboard
  if (user.role === 'Student') {
    return <StudentDashboard />
  }

  // Kung Teacher/Admin, ipakita ang TeacherDashboard
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
