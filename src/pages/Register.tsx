import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react'
import { COURSE_TO_FIELD, FIELD_TO_AREAS, SCHOOLS, SECTIONS, normalizeName } from '../lib/constants'


export default function Register({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    lrn: '',
    firstName: '',
    lastName: '',
    middleName: '',
    sex: 'Male',
    section: '12 GAS',
    course: 'Nursing',
    field: 'Health',
    deploymentArea: 'RHU San Jose',
    schoolName: '',
    password: '',
    confirmPassword: ''
  })

  // Check kung 12 digits ang LRN
  const isLrnValid = formData.lrn.length === 12

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

    // Strict Check Bago Mag-submit
    if (formData.lrn.length !== 12) {
      setError('Ang LRN ay dapat eksaktong 12 digits. Ikaw ay may ' + formData.lrn.length + ' digits.')
      return
    }

    if (formData.password.length < 6) {
      setError('Dapat hindi bababa sa 6 characters ang password.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Hindi magkatugma ang dalawang password.')
      return
    }
    const isEducationField = formData.field === 'Education'
    if (isEducationField && !formData.schoolName) {
      setError('Pumili ng school.')
      return
    }

    setLoading(true)

    try {
      // Ang database trigger ang gagawa ng students row mula sa data na ito
      // (laging "Pending" ang status, hindi ito mababago mula sa app).
      const { error: authError } = await supabase.auth.signUp({
        email: `${formData.lrn}@student.local`,
        password: formData.password,
        options: {
          data: {
            account_type: 'student',
            first_name: normalizeName(formData.firstName),
            last_name: normalizeName(formData.lastName),
            middle_name: normalizeName(formData.middleName),
            sex: formData.sex,
            section: formData.section,
            course: formData.course,
            field: formData.field,
            deployment_area: isEducationField ? formData.schoolName : formData.deploymentArea,
            school_name: isEducationField ? formData.schoolName : null,
          }
        }
      })
      if (authError) {
        if (/already registered|already exists/i.test(authError.message)) throw new Error('Ang LRN na ito ay rehistrado na. Kung nakalimutan mo ang password, gamitin ang "Nakalimutan ang Password?".')
        if (/database error/i.test(authError.message)) throw new Error('Hindi na-save ang registration. I-check ang LRN at subukan ulit.')
        throw new Error(authError.message)
      }

      // Huwag munang i-login hangga't hindi approved
      await supabase.auth.signOut()

      setSuccess('Matagumpay ang registration! Hintayin mo ang approval ng iyong Teacher bago mag-login.')
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
    <div className="min-h-screen flex items-center justify-center p-4 py-8">
      <div className="glass-card p-8 rounded-3xl max-w-lg w-full relative">
        <button onClick={onBack} className="absolute top-5 left-5 p-2 text-gray-500 hover:text-blue-600 bg-white/50 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        
        <div className="text-center mb-8 mt-4">
          <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Student Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Mag-register para makapagsimula</p>
        </div>

        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">{error}</div>}
        {success && <div className="bg-green-50/80 text-green-600 p-3 rounded-xl text-sm mb-4 border border-green-100">{success}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
              <span>LRN (12 Digits)</span>
              <span className={`text-xs font-bold ${isLrnValid ? 'text-green-600' : 'text-red-500'}`}>
                {formData.lrn.length}/12
              </span>
            </label>
            <input 
              required 
              type="text" 
              inputMode="numeric"
              maxLength={12} 
              value={formData.lrn} 
              onChange={e => setFormData({...formData, lrn: e.target.value.replace(/\D/g, '').slice(0, 12)})} 
              className={`w-full px-4 py-2.5 rounded-xl outline-none transition-all border ${
                isLrnValid ? 'border-green-300 bg-green-50/30' : 'border-red-300 bg-red-50/30'
              }`}
              placeholder="123456789012" 
            />
            <p className="text-xs text-gray-500 mt-1">Dapat eksaktong 12 digits.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input type="text" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
              <select value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none appearance-none">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none appearance-none">
                {SECTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none appearance-none">
                {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field (Auto)</label>
              <input type="text" readOnly value={formData.field} className="w-full px-4 py-2.5 rounded-xl bg-gray-100/50 text-gray-500 border border-white/50 outline-none cursor-not-allowed" />
            </div>
            <div>
              {isEducation ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                  <select required value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none appearance-none">
                    <option value="" disabled>Select School</option>
                    {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deployment Area</label>
                  <select required value={formData.deploymentArea} onChange={e => setFormData({...formData, deploymentArea: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none appearance-none">
                    <option value="" disabled>Select Area</option>
                    {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" minLength={6} autoComplete="new-password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="Hindi bababa sa 6 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kumpirmahin ang Password</label>
            <input required type="password" minLength={6} autoComplete="new-password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="glass-input w-full px-4 py-2.5 rounded-xl outline-none" placeholder="••••••••" />
          </div>

          {/* DISABLED ANG BUTTON KUNG HINDI 12 DIGITS */}
          <button 
            disabled={loading || !isLrnValid} 
            type="submit" 
            className={`w-full font-bold py-3 rounded-xl transition-all flex justify-center items-center mt-6 ${
              isLrnValid 
                ? 'glass-button-primary text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}
