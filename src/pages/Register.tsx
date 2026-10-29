import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, ArrowLeft } from 'lucide-react'

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

export default function Register({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    lrn: '', firstName: '', lastName: '', middleName: '',
    section: '12 GAS', course: 'Nursing', field: 'Health',
    deploymentArea: 'RHU San Jose', schoolName: '', password: ''
  })

  useEffect(() => {
    const selectedField = COURSE_TO_FIELD[formData.course]
    setFormData(prev => {
      const availableAreas = FIELD_TO_AREAS[selectedField]
      const newArea = availableAreas && availableAreas.length > 0 ? availableAreas[0] : ''
      return { ...prev, field: selectedField, deploymentArea: newArea, schoolName: '' }
    })
  }, [formData.course])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data: existing } = await supabase.from('students').select('lrn').eq('lrn', formData.lrn).single()
      if (existing) throw new Error('Ang LRN na ito ay rehistrado na.')

      const { error: authError } = await supabase.auth.signUp({
        email: `${formData.lrn}@student.local`,
        password: formData.password,
      })
      if (authError) throw new Error('Auth Error: ' + authError.message)

      const { error: dbError } = await supabase.from('students').insert({
        lrn: formData.lrn,
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName,
        section: formData.section,
        field: formData.field,
        course: formData.course,
        deployment_area: formData.deploymentArea || formData.schoolName,
        password_hash: formData.password,
        status: 'Pending',
        is_first_login: true
      })
      if (dbError) throw new Error('DB Error: ' + dbError.message)

      setSuccess('Matagumpay ang registration! Hintayin mo ang approval ng iyong Teacher.')
      setTimeout(() => onBack(), 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const availableCourses = Object.keys(COURSE_TO_FIELD)
  const availableAreas = FIELD_TO_AREAS[formData.field] || []
  const isEducation = formData.field === 'Education'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full relative">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        
        <div className="text-center mb-6 mt-4">
          <h1 className="text-2xl font-bold text-gray-800">Student Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Mag-register para makapagsimula</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4">{success}</div>}

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LRN (12 Digits)</label>
            <input required type="text" maxLength={12} value={formData.lrn} onChange={e => setFormData({...formData, lrn: e.target.value.replace(/\D/g, '')})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="123456789012" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <input type="text" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="12 GAS">12 GAS</option>
                <option value="12 HUMSS">12 HUMSS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field (Auto)</label>
              <input type="text" readOnly value={formData.field} className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600 outline-none cursor-not-allowed" />
            </div>
            <div>
              {isEducation ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                  <select required value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="" disabled>Select School</option>
                    {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deployment Area</label>
                  <select required value={formData.deploymentArea} onChange={e => setFormData({...formData, deploymentArea: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="" disabled>Select Area</option>
                    {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center mt-4">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}
