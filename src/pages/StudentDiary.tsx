import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Save, Image as ImageIcon, Loader2, Star, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TOTAL_DAYS, RUBRIC_CATEGORIES, manilaDate } from '../lib/constants'
import { compressImage, getFileUrls } from '../lib/files'

export default function StudentDiary({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [dayNumber, setDayNumber] = useState(1)
  const [entryText, setEntryText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])   // path o lumang URL (sinesave sa DB)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])     // signed URLs para makita
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [entryDate, setEntryDate] = useState<string | null>(null)

  const fetchDiary = async (day: number) => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    setImageFile(null)
    const { data, error } = await supabase.from('diary').select('*').eq('lrn', user?.id).eq('day_number', day).maybeSingle()
    if (error) setMessage({ type: 'error', text: 'Hindi ma-load ang diary. I-check ang internet.' })
    if (data) {
      setEntryText(data.entry_text || '')
      setExistingImages(data.image_urls || [])
      setScore(data.rubric_score ?? null)
      setFeedback(data.teacher_feedback)
      setIsLocked(!!data.is_locked)
      setEntryDate(data.date)
      getFileUrls('diary_images', data.image_urls || []).then(setImagePreviews)
    } else {
      setEntryText('')
      setExistingImages([])
      setImagePreviews([])
      setScore(null)
      setFeedback(null)
      setIsLocked(false)
      setEntryDate(null)
    }
    setLoading(false)
  }

  useEffect(() => { fetchDiary(dayNumber) }, [dayNumber])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0])
    e.target.value = '' // para mapili ulit ang parehong file
  }

  const handleSave = async () => {
    if (isLocked) return
    if (!entryText.trim()) { setMessage({ type: 'error', text: 'Hindi pwedeng blangko ang diary.' }); return }
    if (!navigator.onLine) { setMessage({ type: 'error', text: 'Offline ka. Kailangan ng internet para ma-save ang diary.' }); return }
    setSaving(true)
    setMessage({ type: '', text: '' })

    const uploadedPaths = [...existingImages]

    if (imageFile) {
      try {
        const compressed = await compressImage(imageFile)
        const filePath = `${user?.id}/day_${dayNumber}_${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('diary_images').upload(filePath, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        uploadedPaths.push(filePath)
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Hindi na-upload ang larawan. ' + (err?.message || '') })
        setSaving(false)
        return
      }
    }

    const { error } = await supabase.from('diary').upsert({
      lrn: user?.id,
      day_number: dayNumber,
      date: entryDate || manilaDate(), // huwag palitan ang orihinal na petsa kapag nag-edit
      entry_text: entryText,
      image_urls: uploadedPaths
    }, { onConflict: 'lrn,day_number' })

    if (error) {
      const locked = /row-level security/i.test(error.message)
      setMessage({ type: 'error', text: locked ? 'Naka-lock na ang diary na ito (na-grade na). Hilingin sa teacher na i-unlock.' : 'May error sa pag-save: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Matagumpay na na-save ang diary!' })
      setImageFile(null)
      setExistingImages(uploadedPaths)
      if (!entryDate) setEntryDate(manilaDate())
      getFileUrls('diary_images', uploadedPaths).then(setImagePreviews)
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
            {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map(day => <option key={day} value={day}>Day {day}</option>)}
          </select>
        </div>

        {message.text && (
          <div className={`p-4 rounded-2xl text-sm font-medium backdrop-blur-md border ${message.type === 'success' ? 'bg-green-50/80 text-green-700 border-green-200' : 'bg-red-50/80 text-red-700 border-red-200'}`}>
            {message.text}
          </div>
        )}

        {isLocked && (
          <div className="p-4 rounded-2xl text-sm font-medium bg-yellow-50/80 text-yellow-800 border border-yellow-200 flex items-center gap-2">
            <Lock size={16} /> Na-grade na at naka-lock ang diary na ito. Hilingin sa teacher na i-unlock kung may babaguhin.
          </div>
        )}

        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div>
            <label className="block font-bold text-gray-700 mb-2">Ano ang nangyari ngayong araw?</label>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <textarea value={entryText} readOnly={isLocked} onChange={(e) => setEntryText(e.target.value)} placeholder="Isulat ang iyong mga natutunan, karanasan, at realizations..." className="glass-input w-full h-48 p-4 rounded-2xl outline-none resize-none text-gray-800 leading-relaxed"></textarea>
            )}
          </div>

          {imagePreviews.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-bold text-gray-700 mb-2">Mga naka-attach na larawan:</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imagePreviews.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Diary" className="h-20 w-20 object-cover rounded-xl shadow-sm border border-white/50" /></a>)}
              </div>
            </div>
          )}

          {!isLocked && <div className="pt-2 border-t border-white/40">
            <label className="flex items-center gap-2 cursor-pointer text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors bg-blue-50/50 w-fit px-4 py-2 rounded-xl">
              <ImageIcon size={18} /> Mag-attach ng Larawan
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {imageFile && <p className="text-xs text-green-600 mt-2 font-medium">Napili: {imageFile.name}</p>}
          </div>}
        </div>

        {/* GRADE DISPLAY SECTION WITH RUBRIC GUIDE */}
        {(score !== null || feedback) && (
          <div className="glass-card p-6 rounded-3xl border-l-4 border-l-green-500 bg-green-50/30">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><Star className="text-yellow-500" size={20} /> Teacher's Grade</h3>
            
            {score !== null && (
              <div className="flex justify-between items-center mb-4 bg-white/60 p-4 rounded-xl">
                <span className="font-bold text-gray-600">Total Score:</span>
                <span className="text-3xl font-extrabold text-green-600">{score}<span className="text-lg text-gray-400">/100</span></span>
              </div>
            )}

            <div className="mb-4 bg-white/40 p-4 rounded-xl border border-white/60">
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Paano ka gina-grade:</p>
              <ul className="text-xs text-gray-600 space-y-1.5">
                {RUBRIC_CATEGORIES.map(cat => (
                  <li key={cat.id}><span className="font-bold text-gray-700">{cat.name} ({cat.max}):</span> {cat.description}</li>
                ))}
              </ul>
            </div>

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

        {!isLocked && <button onClick={handleSave} disabled={saving || loading} className="glass-button-primary w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Nag-sa-save...' : 'I-save ang Diary'}
        </button>}
      </div>
    </div>
  )
}
