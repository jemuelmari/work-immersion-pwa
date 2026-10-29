import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Search, Save, Loader2, ArrowLeft } from 'lucide-react'
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
            lrn: selectedStudent.lrn,
            day_number: day,
            score: numScore,
            criteria: { submittedBy: user?.name }
          }, { onConflict: 'lrn,day_number' })
        }
      }
    }

    setSaving(false)
    alert('Scores saved successfully!')
  }

  const filteredStudents = students.filter(s => 
    s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.first_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="font-bold text-gray-800">Scores Management</h1>
          <p className="text-xs text-gray-500">Bigyan ng grade ang performance ng estudyante</p>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[80vh] flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-4 text-center text-sm text-gray-500">Loading...</div> : 
              filteredStudents.map(s => (
                <button key={s.lrn} onClick={() => handleSelectStudent(s)} className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedStudent?.lrn === s.lrn ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}>
                  <p className="font-medium text-sm text-gray-800">{s.last_name}, {s.first_name}</p>
                  <p className="text-xs text-gray-500">{s.section} | {s.lrn}</p>
                </button>
              ))
            }
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {selectedStudent ? (
            <>
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-lg text-gray-800">{selectedStudent.last_name}, {selectedStudent.first_name}</h2>
                  <p className="text-xs text-gray-500">{selectedStudent.section}</p>
                </div>
                <button onClick={handleSaveScores} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(day => (
                  <div key={day} className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Day {day}</label>
                    <input type="number" min="0" max="100" value={scores[day] || ''} onChange={(e) => setScores({...scores, [day]: e.target.value})} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0-100" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p>Pumili ng estudyante sa kaliwa para magbigay ng grade.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
