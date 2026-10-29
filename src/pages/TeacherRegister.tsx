import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, ArrowLeft, GraduationCap } from 'lucide-react'

export default function TeacherRegister({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Hindi magkatugma ang dalawang password.')
      return
    }

    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (authError) throw new Error('Auth Error: ' + authError.message)

      const { error: dbError } = await supabase.from('teachers').insert({
        email,
        password_hash: password,
        status: 'Pending',
        role: 'Teacher'
      })
      if (dbError) throw new Error('DB Error: ' + dbError.message)

      setSuccess('Matagumpay ang registration! Hintayin mo lang ang approval ng Admin.')
      setTimeout(() => onBack(), 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 rounded-3xl max-w-md w-full relative">
        <button onClick={onBack} className="absolute top-5 left-5 p-2 text-gray-500 hover:text-blue-600 bg-white/50 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>

        <div className="text-center mb-8 mt-4">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Teacher Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Mag-register bilang co-teacher</p>
        </div>

        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">{error}</div>}
        {success && <div className="bg-green-50/80 text-green-600 p-3 rounded-xl text-sm mb-4 border border-green-100">{success}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="teacher@deped.gov.ph" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kumpirmahin ang Password</label>
            <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="••••••••" />
          </div>
          <button disabled={loading} type="submit" className="glass-button-primary w-full text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center mt-4">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}
