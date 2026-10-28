import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, ArrowLeft } from 'lucide-react'

// Dito natin kinuha lahat ng choices base sa binigay mong lumang Code.gs
const FIELDS = [
  'Health', 
  'Agriculture', 
  'Engineering/IT', 
  'Business', 
  'Education'
]

const COURSES = {
  'Health': ['Nursing', 'Medical Technology', 'Caregiving'],
  'Agriculture': ['BS Agriculture', 'Agribusiness', 'Animal Science'],
  'Engineering/IT': ['IT', 'Civil Engineering', 'Electrical Engineering', 'Computer Science'],
  'Business': ['Accountancy', 'Business Admin', 'Entrepreneurship', 'Marketing'],
  'Education': ['BEEd', 'BSEd', 'Early Childhood Education']
}

const DEPLOYMENT_AREAS = [
  'RHU San Jose',
  'Lying-In Clinic',
  'LGU San Jose',
  'SHEBA',
  'Department of Agriculture',
  'Sta. Cruz Elementary School',
  'Iba Elementary School',
  'Papay\'s Bakeshop',
  'School',
  'Other'
]

export default function Register({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    lrn: '',
    firstName: '',
    lastName: '',
    middleName: '',
    section: '12 GAS',
    field: 'Health',
    course: 'Nursing',
    deploymentArea: '',
    password: ''
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data: existing } = await supabase
        .from('students')
        .select('lrn')
        .eq('lrn', formData.lrn)
        .single()
        
      if (existing) throw new Error('Ang LRN na ito ay rehistrado na. Pakisubukang mag-login.')

      const { error: authError } = await supabase.auth.signUp({
        email: `${formData.lrn}@student.local`,
        password: formData.password,
      })

      if (authError) throw new Error('May error sa paggawa ng account: ' + authError.message)

      const { error: dbError } = await supabase.from('students').insert({
        lrn: formData.lrn,
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName,
        section: formData.section,
        field: formData.field,
        course: formData.course,
        deployment_area: formData.deploymentArea,
        password_hash: formData.password,
        status: 'Pending'
      })

      if (dbError) throw new Error('May error sa pag-save ng info: ' + dbError.message)

      setSuccess('Matagumpay ang registration! Hintayin mo lang ang approval ng iyong Teacher.')
      setTimeout(() => onBack(), 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedField = e.target.value
    setFormData({
      ...formData, 
      field: selectedField,
      course: COURSES[selectedField as keyof typeof COURSES][0] // Reset course sa unang option ng field
    })
  }

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              <select value={formData.field} onChange={handleFieldChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {COURSES[formData.field as keyof typeof COURSES].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deployment Area</label>
              <select required value={formData.deploymentArea} onChange={e => setFormData({...formData, deploymentArea: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="" disabled>Select Area</option>
                {DEPLOYMENT_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
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
