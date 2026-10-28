import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    lrn: '',
    firstName: '',
    lastName: '',
    middleName: '',
    section: '12 GAS', // Default
    password: ''
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // 1. Check kung existing na ang LRN
      const { data: existing } = await supabase
        .from('students')
        .select('lrn')
        .eq('lrn', formData.lrn)
        .single()
        
      if (existing) throw new Error('Ang LRN na ito ay rehistrado na. Pakisubukang mag-login.')

      // 2. Gumawa ng Supabase Auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${formData.lrn}@student.local`,
        password: formData.password,
      })

      if (authError) throw new Error('May error sa paggawa ng account: ' + authError.message)

      // 3. I-save sa students table (Status: Pending)
      const { error: dbError } = await supabase.from('students').insert({
        lrn: formData.lrn,
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName,
        section: formData.section,
        password_hash: formData.password, // Dapat i-hash ito sa totoong app, pero okay na muna ito
        status: 'Pending' // Importante: Kailangan i-approve ni Teacher
      })

      if (dbError) throw new Error('May error sa pag-save ng info: ' + dbError.message)

      setSuccess('Matagumpay ang registration! Hintayin mo lang ang approval ng iyong Teacher.')
      setTimeout(() => navigate('/'), 3000) // Balik sa login pagkatapos ng 3 seconds

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full relative">
        <button onClick={() => navigate('/')} className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="12 GAS">12 GAS</option>
              <option value="12 HUMSS">12 HUMSS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center mt-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}
