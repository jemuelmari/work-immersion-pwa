import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/db'
import { Upload, FileText, ArrowLeft, Loader2, CheckCircle, XCircle, Download } from 'lucide-react'

// BAGONG LISTAHAN NG REQUIREMENTS BASE SA BINIGAY MO
const REQUIRED_DOCS = [
  "Parental Consent",
  "Application Letter and Resume",
  "Barangay Clearance",
  "Medical Certificate",
  "Mayor's Clearance",
  "Certificate of Indigence",
  "Birth Certificate"
]

export default function StudentRequirements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const fetchRequirements = async () => {
    setLoading(true)
    const { data } = await supabase.from('requirements').select('*').eq('lrn', user?.id)
    
    const mergedList = REQUIRED_DOCS.map(docName => {
      const existing = data?.find(d => d.requirement_name === docName)
      return {
        name: docName,
        status: existing ? existing.status : 'Missing',
        file_url: existing?.file_url || null,
        file_name: existing?.file_name || null
      }
    })

    setRequirements(mergedList)
    setLoading(false)
  }

  useEffect(() => { fetchRequirements() }, [])

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); processOfflineQueue() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) processOfflineQueue()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const processOfflineQueue = async () => {
    const pendingItems = await db.fileQueue.where('status').equals('pending').toArray()
    if (pendingItems.length === 0) return
    for (const item of pendingItems) {
      await uploadFileToSupabase(item.fileBlob, item.fileName, item.requirementName, item.lrn)
      await db.fileQueue.delete(item.id!)
    }
    fetchRequirements()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, reqName: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') { alert('PDF files lang ang pwede i-upload.'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Sobra ang laki ng file. Max 5MB lang.'); return }

    setUploadingId(reqName)

    if (isOnline) {
      await uploadFileToSupabase(file, file.name, reqName, user!.id)
      fetchRequirements()
    } else {
      await db.fileQueue.add({
        lrn: user!.id, requirementName: reqName, fileBlob: file, fileName: file.name,
        status: 'pending', createdAt: new Date().toISOString()
      })
      alert('Offline ka ngayon. Naka-save muna ang file sa device at awtomatikong ipapadala kapag may internet na.')
    }

    setUploadingId(null)
  }

  const uploadFileToSupabase = async (fileBlob: Blob, fileName: string, reqName: string, lrn: string) => {
    try {
      const filePath = `${lrn}/${reqName.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from('requirements_files').upload(filePath, fileBlob, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('requirements_files').getPublicUrl(filePath)
      
      await supabase.from('requirements').upsert({
        lrn: lrn, requirement_name: reqName, file_name: fileName, file_url: urlData.publicUrl,
        status: 'Uploaded', uploaded_at: new Date().toISOString()
      }, { onConflict: 'lrn,requirement_name' })
    } catch (err: any) { alert('Upload Error: ' + err.message) }
  }

  const handleDownloadAll = () => {
    const uploadedReqs = requirements.filter(r => r.status === 'Uploaded')
    if (uploadedReqs.length === 0) return

    uploadedReqs.forEach((req) => {
      const safeName = req.name.replace(/[^a-zA-Z0-9]/g, '_')
      const nameParts = user?.name.split(' ') || ['Student', 'Name']
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join('_')
      const fileName = `${user?.id}_${lastName}_${firstName}_${safeName}.pdf`
      
      const link = document.createElement('a')
      link.href = req.file_url
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  const uploadedCount = requirements.filter(r => r.status === 'Uploaded').length
  const progressPercent = Math.round((uploadedCount / REQUIRED_DOCS.length) * 100)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
        <h1 className="font-bold text-gray-800">My Requirements</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        {!isOnline && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm text-center border border-red-100 flex items-center justify-center gap-2">
            <XCircle size={16} /> Offline ka ngayon. Ang upload ay makakapasok kapag may net na.
          </div>
        )}

        {/* CHECKLIST */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-700">Checklist ng mga Requirements</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requirements.map(req => (
                <div key={req.name} className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {req.status === 'Uploaded' ? <CheckCircle className="text-green-500" size={20} /> : <XCircle className="text-gray-300" size={20} />}
                      <p className={`text-sm font-medium ${req.status === 'Uploaded' ? 'text-gray-800' : 'text-gray-500'}`}>{req.name}</p>
                    </div>
                    {req.status === 'Uploaded' && (
                      <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                        <FileText size={14} /> View
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer text-xs font-bold transition-colors ${uploadingId === req.name ? 'bg-gray-200 text-gray-500' : req.status === 'Uploaded' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                      {uploadingId === req.name ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                      {uploadingId === req.name ? 'Nag-a-upload...' : req.status === 'Uploaded' ? 'Re-upload (Palitan)' : 'Upload PDF'}
                      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleUpload(e, req.name)} disabled={uploadingId !== null} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PROGRESS BAR SA PINAKABABA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-800">Upload Progress</h2>
            <span className={`font-bold ${progressPercent === 100 ? 'text-green-600' : 'text-blue-600'}`}>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
            <div className={`h-3 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 text-center mb-4">
            {uploadedCount} sa {REQUIRED_DOCS.length} requirements ang na-upload.
          </p>
          
          {uploadedCount > 0 && (
            <button onClick={handleDownloadAll} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors">
              <Download size={20} /> Download All Files ({uploadedCount})
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
