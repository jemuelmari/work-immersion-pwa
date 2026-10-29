import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Save, Image as ImageIcon, Loader2, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function StudentDiary({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [dayNumber, setDayNumber] = useState(1)
  const [entryText, setEntryText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // States para sa Grade
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-CA')

  const fetchDiary = async (day: number) => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    const { data } = await supabase.from('diary').select('*').eq('lrn', user?.id).eq('day_number', day).single()
    if (data) {
      setEntryText(data.entry_text || '')
      setExistingImages(data.image_urls || [])
      setScore(data.rubric_score)
      setFeedback(data.teacher_feedback)
    } else {
      setEntryText('')
      setExistingImages([])
      setScore(null)
      setFeedback(null)
    }
    setLoading(false)
  }

  useEffect(() => { fetchDiary(dayNumber) }, [dayNumber])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0])
  }

  const handleSave = async () => {
    if (!entryText.trim()) { setMessage({ type: 'error', text: 'Hindi pwedeng blangko ang diary.' }); return }
    setSaving(true)
    setMessage({ type: '', text: '' })

    let uploadedUrls = [...existingImages]

    if (imageFile) {
      try {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user?.id}/day_${dayNumber}_${new Date().getTime()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('diary_images').upload(fileName, imageFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('diary_images').getPublicUrl(fileName)
        uploadedUrls.push(urlData.publicUrl)
      } catch (err) {
        setMessage({ type: 'error', text: 'Hindi na-upload ang larawan.' })
        setSaving(false)
        return
      }
    }

    // Kapag nag-save ng bagong entry, hindi natin ginalaw ang score para hindi mawala
    const { error } = await supabase.from('diary').upsert({
      lrn: user?.id, day_number: dayNumber, date: today, entry_text: entryText, image_urls: uploadedUrls
    }, { onConflict: 'lrn,day_number' })

    if (error) setMessage({ type: 'error', text: 'May error sa pag-save sa database.' })
    else {
      setMessage({ type: 'success', text: 'Matagumpay na na-save ang diary!' })
      setImageFile(null)
      setExistingImages(uploadedUrls)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="glass-panel p-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-700" /></button>
        <div>
          <h1 className="font-bold text-gray-800 text-lg">My Diary</h1>
          <p className="text-xs text-gray-500 font-medium">I-record ang iyong karanasan</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 mt-2">
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between">
          <label className="font-bold text-gray-700">Araw (Day):</label>
          <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))} className="glass-input px-4 py-2.5 rounded-xl font-bold text-blue-600 outline-none appearance-none">
            {Array.from({ length: 20 }, (_, i) => i + 1).map(day => <option key={day} value={day}>Day {day}</option>)}
          </select>
        </div>

        {message.text && (
          <div className={`p-4 rounded-2xl text-sm font-medium backdrop-blur-md border ${message.type === 'success' ? 'bg-green-50/80 text-green-700 border-green-200' : 'bg-red-50/80 text-red-700 border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div>
            <label className="block font-bold text-gray-700 mb-2">Ano ang nangyari ngayong araw?</label>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <textarea value={entryText} onChange={(e) => setEntryText(e.target.value)} placeholder="Isulat ang iyong mga natutunan, karanasan, at realizations..." className="glass-input w-full h-48 p-4 rounded-2xl outline-none resize-none text-gray-800 leading-relaxed"></textarea>
            )}
          </div>

          {existingImages.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-bold text-gray-700 mb-2">Mga naka-attach na larawan:</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {existingImages.map((url, i) => <img key={i} src={url} alt="Diary" className="h-20 w-20 object-cover rounded-xl shadow-sm border border-white/50" />)}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/40">
            <label className="flex items-center gap-2 cursor-pointer text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors bg-blue-50/50 w-fit px-4 py-2 rounded-xl">
              <ImageIcon size={18} /> Mag-attach ng Larawan
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {imageFile && <p className="text-xs text-green-600 mt-2 font-medium">Napili: {imageFile.name}</p>}
          </div>
        </div>

        {/* GRADE DISPLAY SECTION */}
        {(score !== null || feedback) && (
          <div className="glass-card p-6 rounded-3xl border-l-4 border-l-green-500 bg-green-50/30">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><Star className="text-yellow-500" size={20} /> Teacher's Grade</h3>
            
            {score !== null && (
              <div className="flex justify-between items-center mb-4 bg-white/60 p-4 rounded-xl">
                <span className="font-bold text-gray-600">Total Score:</span>
                <span className="text-3xl font-extrabold text-green-600">{score}<span className="text-lg text-gray-400">/100</span></span>
              </div>
            )}

            {feedback && (
              <div>
                <p className="text-sm font-bold text-gray-600 mb-2">Feedback:</p>
                <div className="bg-white/60 p-4 rounded-xl text-gray-700 italic text-sm whitespace-pre-wrap">
                  "{feedback}"
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || loading} className="glass-button-primary w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Nag-sa-save...' : 'I-save ang Diary'}
        </button>
      </div>
    </div>
  )
}
