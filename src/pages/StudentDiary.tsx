import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Save, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface StudentDiaryProps {
  onBack: () => void;
}

export default function StudentDiary({ onBack }: StudentDiaryProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [dayNumber, setDayNumber] = useState(1)
  const [entryText, setEntryText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [message, setMessage] = useState({ type: '', text: '' })

  const today = new Date().toLocaleDateString('en-CA')

  // I-load ang diary entry para sa napiling araw
  const fetchDiary = async (day: number) => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    
    const { data, error } = await supabase
      .from('diary')
      .select('*')
      .eq('lrn', user?.id)
      .eq('day_number', day)
      .single()

    if (data) {
      setEntryText(data.entry_text || '')
      setExistingImages(data.image_urls || [])
    } else {
      setEntryText('')
      setExistingImages([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDiary(dayNumber)
  }, [dayNumber])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0])
    }
  }

  const handleSave = async () => {
    if (!entryText.trim()) {
      setMessage({ type: 'error', text: 'Hindi pwedeng blangko ang diary.' })
      return
    }

    setSaving(true)
    setMessage({ type: '', text: '' })

    let uploadedUrls = [...existingImages]

    // 1. Mag-upload ng bagong image kung meron
    if (imageFile) {
      try {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user?.id}/day_${dayNumber}_${new Date().getTime()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('diary_images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('diary_images')
          .getPublicUrl(fileName)
          
        uploadedUrls.push(urlData.publicUrl)
      } catch (err) {
        console.error("Upload error:", err)
        setMessage({ type: 'error', text: 'Hindi na-upload ang larawan.' })
        setSaving(false)
        return
      }
    }

    // 2. I-save sa Database (Upsert = Insert kung wala, Update kung meron na)
    const { error } = await supabase.from('diary').upsert({
      lrn: user?.id,
      day_number: dayNumber,
      date: today,
      entry_text: entryText,
      image_urls: uploadedUrls
    }, { onConflict: 'lrn,day_number' })

    if (error) {
      console.error("Save error:", error)
      setMessage({ type: 'error', text: 'May error sa pag-save sa database.' })
    } else {
      setMessage({ type: 'success', text: 'Matagumpay na na-save ang diary!' })
      setImageFile(null)
      setExistingImages(uploadedUrls)
    }
    
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="font-bold text-gray-800">My Diary</h1>
          <p className="text-xs text-gray-500">I-record ang iyong karanasan</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        
        {/* Day Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <label className="font-medium text-gray-700">Araw (Day):</label>
          <select 
            value={dayNumber} 
            onChange={(e) => setDayNumber(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map(day => (
              <option key={day} value={day}>Day {day}</option>
            ))}
          </select>
        </div>

        {/* Notification */}
        {message.text && (
          <div className={`p-4 rounded-xl text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Editor */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ano ang nangyari ngayong araw?</label>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <textarea
                value={entryText}
                onChange={(e) => setEntryText(e.target.value)}
                placeholder="Isulat ang iyong mga natutunan, karanasan, at realizations..."
                className="w-full h-40 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              ></textarea>
            )}
          </div>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Mga naka-attach na larawan:</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {existingImages.map((url, i) => (
                  <img key={i} src={url} alt="Diary" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-blue-600 font-medium text-sm hover:text-blue-700">
              <ImageIcon size={18} />
              Mag-attach ng Larawan (Optional)
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {imageFile && (
              <p className="text-xs text-green-600 mt-1">Napili: {imageFile.name}</p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-300"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Nag-sa-save...' : 'I-save ang Diary'}
        </button>
      </div>
    </div>
  )
}
