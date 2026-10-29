import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [lrn, setLrn] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Check if student exists
      const { data: student } = await supabase.from('students').select('lrn').eq('lrn', lrn).single()
      if (!student) throw new Error('Walang estudyante na may ganitong LRN.')

      // Create reset request
      const { error: dbError } = await supabase.from('password_reset_requests').insert({
        lrn: lrn,
        reason: reason,
        status: 'Pending'
      })

      if (dbError) throw dbError

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 rounded-3xl max-w-md w-full text-center">
          <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Request Sent!</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Ang iyong request ay naipadala na sa iyong Teacher. Hintayin mo ang confirmation at bagong password.
          </p>
          <button onClick={onBack} className="glass-button-primary text-white font-bold py-3 px-6 rounded-xl">
            Bumalik sa Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 rounded-3xl max-w-md w-full relative">
        <button onClick={onBack} className="absolute top-5 left-5 p-2 text-gray-500 hover:text-blue-600 bg-white/50 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>

        <div className="text-center mb-6 mt-4">
          <div className="bg-orange-100 text-orange-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nakalimutan ang Password?</h1>
          <p className="text-gray-500 text-sm mt-1">Mag-request ng password reset sa iyong Teacher</p>
        </div>

        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LRN (12 digits)</label>
            <input required type="text" maxLength={12} value={lrn} onChange={e => setLrn(e.target.value.replace(/\D/g, ''))} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="123456789012" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dahilan (Optional)</label>
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none resize-none" placeholder="Hal. Nakalimutan ko na ang password ko..."></textarea>
          </div>
          <button disabled={loading} type="submit" className="glass-button-primary w-full text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center mt-4">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Ipadala ang Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
