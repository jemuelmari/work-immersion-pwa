import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Loader2, User, GraduationCap, KeyRound } from 'lucide-react'

export default function Login({ onGoToRegister, onGoToTeacherRegister, onGoToForgotPassword }: { onGoToRegister: () => void; onGoToTeacherRegister: () => void; onGoToForgotPassword: () => void }) {
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 rounded-3xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Work Immersion</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <div className="flex bg-white/40 p-1 rounded-xl mb-6 backdrop-blur-sm border border-white/50">
          <button type="button" onClick={() => { setIsTeacher(false); setId(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isTeacher ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <User size={16} /> Student
          </button>
          <button type="button" onClick={() => { setIsTeacher(true); setId(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${isTeacher ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <GraduationCap size={16} /> Teacher
          </button>
        </div>

        {error && <div className="bg-red-50/80 backdrop-blur-sm text-red-600 p-3 rounded-xl text-sm mb-4 text-center border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isTeacher ? 'Email Address' : 'LRN (12 digits)'}</label>
            <input type={isTeacher ? 'email' : 'text'} required value={id} onChange={(e) => setId(e.target.value)} className="glass-input w-full px-4 py-3 rounded-xl outline-none transition-all" placeholder={isTeacher ? 'teacher@deped.gov.ph' : '123456789012'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input w-full px-4 py-3 rounded-xl outline-none transition-all" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="glass-button-primary w-full text-white font-bold py-3 rounded-xl flex justify-center items-center mt-6">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 space-y-3">
          {!isTeacher ? (
            <>
              <p>Wala pang account? <button onClick={onGoToRegister} className="text-blue-600 font-bold hover:underline">Mag-register dito</button></p>
              <p><button onClick={onGoToForgotPassword} className="text-orange-600 font-bold hover:underline flex items-center justify-center gap-1"><KeyRound size={14}/> Nakalimutan ang Password?</button></p>
            </>
          ) : (
            <p>Bagong Teacher? <button onClick={onGoToTeacherRegister} className="text-blue-600 font-bold hover:underline">Mag-register dito</button></p>
          )}
        </div>
      </div>
    </div>
  )
}
