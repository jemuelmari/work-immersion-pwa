import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Save, Loader2, User } from 'lucide-react'

const COURSE_TO_FIELD: Record<string, string> = {
  'Nursing': 'Health', 'Medical Technology': 'Health', 'Caregiving': 'Health',
  'BS Agriculture': 'Agriculture', 'Agribusiness': 'Agriculture', 'Animal Science': 'Agriculture',
  'IT': 'Engineering/IT', 'Civil Engineering': 'Engineering/IT', 'Electrical Engineering': 'Engineering/IT', 'Computer Science': 'Engineering/IT', 'Geodetic Engineering': 'Engineering/IT',
  'Accountancy': 'Business', 'Business Admin': 'Business', 'Entrepreneurship': 'Business', 'Marketing': 'Business',
  'BEEd': 'Education', 'BSEd': 'Education', 'Early Childhood Education': 'Education'
}

const FIELD_TO_AREAS: Record<string, string[]> = {
  'Health': ['RHU San Jose', 'Lying-In Clinic', 'Hospital'],
  'Agriculture': ['SHEBA', 'Department of Agriculture', 'Farm'],
  'Engineering/IT': ['LGU San Jose', 'Construction Site', 'IT Company'],
  'Business': ['LGU San Jose', 'Papay\'s Bakeshop', 'Bank', 'Office'],
  'Education': []
}

const SCHOOLS = ['Sta. Cruz Elementary School', 'Iba Elementary School', 'San Jose National High School', 'Other School']

const normalizeName = (str: string) => {
  return str.trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

export default function StudentProfile({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [formData, setFormData] = useState({
    lrn: '',
    firstName: '',
    lastName: '',
    middleName: '',
    sex: 'Male',
    section: '12 GAS',
    course: 'Nursing',
    field: 'Health',
    deploymentArea: '',
    schoolName: ''
  })

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return
      const { data } = await supabase.from('students').select('*').eq('lrn', user.id).single()
      if (data) {
        setFormData({
          lrn: data.lrn,
          firstName: data.first_name,
          lastName: data.last_name,
          middleName: data.middle_name || '',
          sex: data.sex || 'Male',
          section: data.section || '12 GAS',
          course: data.course || 'Nursing',
          field: data.field || 'Health',
          deploymentArea: data.deployment_area || '',
          schoolName: data.school_name || ''
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCourse = e.target.value
    const newField = COURSE_TO_FIELD[selectedCourse]
    setFormData(prev => ({
      ...prev,
      course: selectedCourse,
      field: newField,
      deploymentArea: FIELD_TO_AREAS[newField]?.[0] || '',
      schoolName: ''
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: normalizeName(formData.firstName),
          last_name: normalizeName(formData.lastName),
          middle_name: normalizeName(formData.middleName),
          sex: formData.sex,
          section: formData.section,
          course: formData.course,
          field: formData.field,
          deployment_area: formData.deploymentArea || formData.schoolName
        })
        .eq('lrn', formData.lrn)

      if (error) throw error
      setMessage({ type: 'success', text: 'Matagumpay na na-save ang iyong profile!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  const availableCourses = Object.keys(COURSE_TO_FIELD)
  const availableAreas = FIELD_TO_AREAS[formData.field] || []
  const isEducation = formData.field === 'Education'

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="glass-panel p-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-700" /></button>
        <div>
          <h1 className="font-bold text-gray-800 text-lg">My Profile</h1>
          <p className="text-xs text-gray-500 font-medium">I-edit ang iyong impormasyon</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4 mt-2">
        {message.text && (
          <div className={`p-4 rounded-2xl text-sm font-medium backdrop-blur-md border ${message.type === 'success' ? 'bg-green-50/80 text-green-700 border-green-200' : 'bg-red-50/80 text-red-700 border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="text-center mb-6">
            <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2"><User size={32} /></div>
            <p className="text-xs text-gray-500 font-bold">LRN: {formData.lrn}</p>
            <p className="text-xs text-gray-400">(Hindi na pwedeng baguhin)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input type="text" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
              <select value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none">
              <option value="12 GAS">12 GAS</option>
              <option value="12 HUMSS">12 HUMSS</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select value={formData.course} onChange={handleCourseChange} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none">
              {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field (Auto)</label>
            <input type="text" readOnly value={formData.field} className="w-full px-4 py-2.5 rounded-xl bg-gray-100/50 text-gray-500 border border-white/50 outline-none cursor-not-allowed" />
          </div>

          <div>
            {isEducation ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                <select value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none">
                  <option value="" disabled>Select School</option>
                  {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deployment Area</label>
                <select value={formData.deploymentArea} onChange={e => setFormData({...formData, deploymentArea: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none">
                  <option value="" disabled>Select Area</option>
                  {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </>
            )}
          </div>

          <button onClick={handleSave} disabled={saving} className="glass-button-primary w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-6">
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {saving ? 'Nag-sa-save...' : 'I-save ang Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
