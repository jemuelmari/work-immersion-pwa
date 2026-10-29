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

    if (newPassword !== confirmPassword) {
      setError('Hindi magkatugma ang dalawang password.')
      return
    }

    if (newPassword.length < 6) {
      setError('Dapat hindi bababa sa 6 characters ang password.')
      return
    }

    setLoading(true)

    try {
      // 1. I-update ang password sa Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      })
      if (authError) throw authError

      // 2. I-update ang database para hindi na mag-prompt ulit
      const { error: dbError } = await supabase
        .from('students')
        .update({ 
          password_hash: newPassword, 
          is_first_login: false 
        })
        .eq('lrn', user?.id)
      
      if (dbError) throw dbError

      onComplete() // Lipat sa Dashboard
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Palitan ang Password</h1>
          <p className="text-gray-500 text-sm mt-1">
            Para sa seguridad, kailangan mong palitan ang iyong default password bago magpatuloy.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bagong Password</label>
            <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kumpirmahin ang Password</label>
            <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'I-save ang Bagong Password'}
          </button>
          
          <button type="button" onClick={logout} className="w-full text-gray-500 text-sm mt-2 hover:underline">
            Mag-logout na lang muna
          </button>
        </form>
      </div>
    </div>
  )
}
