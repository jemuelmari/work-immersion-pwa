import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md mt-10 text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-2">Login Successful!</h1>
        <p className="text-gray-600 mb-4">Welcome, <span className="font-bold">{user.name}</span></p>
        <p className="text-sm text-gray-500 mb-6">Role: {user.role} | ID: {user.id}</p>
        
        <button 
          onClick={() => {
            localStorage.removeItem('wi_user');
            window.location.reload();
          }}
          className="bg-red-500 text-white px-6 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
