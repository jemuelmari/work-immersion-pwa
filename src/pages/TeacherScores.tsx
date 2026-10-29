import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Search, Save, Loader2, ArrowLeft, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Student { lrn: string; first_name: string; last_name: string; section: string; }

export default function TeacherScores({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [scores, setScores] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase.from('students').select('lrn, first_name, last_name, section').eq('status', 'Approved').order('last_name')
      if (data) setStudents(data)
      setLoading(false)
    }
    fetchStudents()
  }, [])

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student)
    setScores({})
    const { data } = await supabase.from('scores').select('*').eq('lrn', student.lrn)
    if (data) {
      const scoreMap: Record<number, string> = {}
      data.forEach(s => { scoreMap[s.day_number] = s.score.toString() })
      setScores(scoreMap)
    }
  }

  const handleSaveScores = async () => {
    if (!selectedStudent) return
    setSaving(true)
    for (let day = 1; day <= 20; day++) {
      const scoreValue = scores[day]
      if (scoreValue !== undefined && scoreValue !== '') {
        const numScore = parseFloat(scoreValue)
        if (!isNaN(numScore)) {
          await supabase.from('scores').upsert({
            lrn: selectedStudent.lrn, day_number: day, score: numScore, criteria: { submittedBy: user?.name }
          }, { onConflict: 'lrn,day_number' })
        }
      }
    }
    setSaving(false)
    alert('Scores saved successfully!')
  }

  const filteredStudents = students.filter(s => 
    s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.first_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen pb-10">
      <div className="glass-panel p-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-700" /></button>
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Scores Management</h1>
          <p className="text-xs text-gray-500 font-medium">Bigyan ng grade ang performance ng estudyante</p>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        
        {/* LEFT: STUDENT LIST */}
        <div className="glass-card rounded-3xl h-[80vh] flex flex-col overflow-hidden">
          <div className="p-4 bg-white/40 border-b border-white/50 backdrop-blur-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="glass-input w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-6 text-center text-sm text-gray-500 font-medium">Loading...</div> : 
              filteredStudents.map(s => (
                <button key={s.lrn} onClick={() => handleSelectStudent(s)} className={`w-full text-left p-4 border-b border-white/30 hover:bg-white/60 transition-colors flex items-center gap-3 ${selectedStudent?.lrn === s.lrn ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : ''}`}>
                  <div className={`p-2 rounded-full ${selectedStudent?.lrn === s.lrn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}><User size={16} /></div>
                  <div>
                    <p className={`font-bold text-sm ${selectedStudent?.lrn === s.lrn ? 'text-blue-800' : 'text-gray-800'}`}>{s.last_name}, {s.first_name}</p>
                    <p className="text-xs text-gray-500 font-medium">{s.section} | {s.lrn}</p>
                  </div>
                </button>
              ))
            }
          </div>
        </div>

        {/* RIGHT: SCORE ENTRY */}
        <div className="md:col-span-2 glass-card rounded-3xl p-6">
          {selectedStudent ? (
            <>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/50">
                <div>
                  <h2 className="font-extrabold text-xl text-gray-800">{selectedStudent.last_name}, {selectedStudent.first_name}</h2>
                  <p className="text-sm text-gray-500 font-medium">{selectedStudent.section}</p>
                </div>
                <button onClick={handleSaveScores} disabled={saving} className="glass-button-primary text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Scores
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(day => (
                  <div key={day} className="bg-white/50 p-3 rounded-2xl border border-white hover:border-blue-300 transition-colors">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Day {day}</label>
                    <input type="number" min="0" max="100" value={scores[day] || ''} onChange={(e) => setScores({...scores, [day]: e.target.value})} className="glass-input w-full px-3 py-2 rounded-lg text-sm font-bold text-blue-600 outline-none" placeholder="0" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <User size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Pumili ng estudyante sa kaliwa para magbigay ng grade.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
