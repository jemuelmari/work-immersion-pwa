import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'

export default function TeacherAnnouncements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.from('announcements').insert({
      title, body, author_email: user?.id
    })

    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Matagumpay na naipost!')
      setTitle('')
      setBody('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
        <h1 className="font-bold text-gray-800">Announcements</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <form onSubmit={handlePost} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          {message && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Hal. Reminder para sa DTR" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea required rows={5} value={body} onChange={e => setBody(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Isulat ang announcement..."></textarea>
          </div>
          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />} I-post
          </button>
        </form>
      </div>
    </div>
  )
}
