import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loader2, Lock } from 'lucide-react'

export default function ChangePassword({ onComplete }: { onComplete: () => void }) {
  const { user, logout } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Hindi magkatugma ang dalawang password.'); return }
    if (newPassword.length < 6) { setError('Dapat hindi bababa sa 6 characters ang password.'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
      if (authError) throw authError
      const { error: dbError } = await supabase.from('students').update({ password_hash: newPassword, is_first_login: false }).eq('lrn', user?.id)
      if (dbError) throw dbError
      
      const savedUser = localStorage.getItem('wi_user')
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser)
        parsedUser.isFirstLogin = false
        localStorage.setItem('wi_user', JSON.stringify(parsedUser))
      }
      window.location.reload()
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 rounded-3xl max-w-md w-full">
        <div className="text-center mb-8">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Palitan ang Password</h1>
          <p className="text-gray-500 text-sm mt-1">Para sa seguridad, kailangan mong palitan ang iyong default password.</p>
        </div>
        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-xl text-sm mb-4 text-center border border-red-100">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bagong Password</label>
            <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kumpirmahin ang Password</label>
            <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="••••••••" />
          </div>
          <button disabled={loading} type="submit" className="glass-button-primary w-full text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center mt-6">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'I-save ang Bagong Password'}
          </button>
          <button type="button" onClick={logout} className="w-full text-gray-500 text-sm mt-4 hover:text-gray-800 transition-colors">
            Mag-logout na lang muna
          </button>
        </form>
      </div>
    </div>
  )
}
