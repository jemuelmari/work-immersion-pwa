import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Loader2, User, GraduationCap } from 'lucide-react'

export default function Login({ onGoToRegister }: { onGoToRegister: () => void }) {
  const { login } = useAuth()
  const [isTeacher, setIsTeacher] = useState(false)
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: loginError } = await login(id, password, isTeacher)
    if (loginError) setError(loginError)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Work Immersion</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button type="button" onClick={() => { setIsTeacher(false); setId(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${!isTeacher ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><User size={16} /> Student</button>
          <button type="button" onClick={() => { setIsTeacher(true); setId(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${isTeacher ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><GraduationCap size={16} /> Teacher</button>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isTeacher ? 'Email Address' : 'LRN (12 digits)'}</label>
            <input type={isTeacher ? 'email' : 'text'} required value={id} onChange={(e) => setId(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder={isTeacher ? 'teacher@deped.gov.ph' : '123456789012'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        {/* DITO LALABAS ANG REGISTER BUTTON */}
        <div className="mt-6 text-center text-sm text-gray-600">
          Wala pang account?{' '}
          <button onClick={onGoToRegister} className="text-blue-600 font-bold hover:underline">
            Mag-register dito
          </button>
        </div>

      </div>
    </div>
  )
}
