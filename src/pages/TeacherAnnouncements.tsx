import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Send, Loader2, Megaphone } from 'lucide-react'

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
    const { error } = await supabase.from('announcements').insert({ title, body, author_email: user?.id })
    if (error) setMessage('Error: ' + error.message)
    else { setMessage('Matagumpay na naipost!'); setTitle(''); setBody('') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="glass-panel p-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-800 text-lg">Announcements</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto mt-4">
        <form onSubmit={handlePost} className="glass-card p-6 rounded-3xl space-y-5">
          <div className="text-center mb-2">
            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2"><Megaphone size={24} /></div>
            <h2 className="font-bold text-gray-800">Post an Announcement</h2>
          </div>
          
          {message && <div className="bg-blue-50/80 text-blue-700 p-3 rounded-xl text-sm font-medium text-center border border-blue-100">{message}</div>}
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="glass-input w-full px-4 py-3 rounded-xl outline-none" placeholder="Hal. Reminder para sa DTR" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Message</label>
            <textarea required rows={5} value={body} onChange={e => setBody(e.target.value)} className="glass-input w-full px-4 py-3 rounded-xl outline-none resize-none" placeholder="Isulat ang announcement..."></textarea>
          </div>
          <button disabled={loading} type="submit" className="glass-button-primary w-full text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />} I-post
          </button>
        </form>
      </div>
    </div>
  )
}
