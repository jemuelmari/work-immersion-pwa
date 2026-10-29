import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/db'
import { Upload, FileText, ArrowLeft, Loader2, CheckCircle, XCircle, Download } from 'lucide-react'

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
    <div className="min-h-screen pb-20">
      <div className="glass-panel p-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-700" /></button>
        <h1 className="font-bold text-gray-800 text-lg">My Requirements</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4 mt-2">
        {!isOnline && (
          <div className="bg-red-50/80 backdrop-blur-md text-red-700 p-3 rounded-2xl text-sm text-center border border-red-100 font-medium flex items-center justify-center gap-2">
            <XCircle size={16} /> Offline ka ngayon. Ang upload ay makakapasok kapag may net na.
          </div>
        )}

        {/* CHECKLIST */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="p-4 bg-white/40 border-b border-white/50 backdrop-blur-sm">
            <h2 className="font-bold text-sm text-gray-800">Checklist ng mga Requirements</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="divide-y divide-white/40">
              {requirements.map(req => (
                <div key={req.name} className="p-4 flex flex-col gap-3 hover:bg-white/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {req.status === 'Uploaded' ? <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={20} /> : <XCircle className="text-gray-300 mt-0.5 shrink-0" size={20} />}
                      <div>
                        <p className={`text-sm font-semibold ${req.status === 'Uploaded' ? 'text-gray-800' : 'text-gray-500'}`}>{req.name}</p>
                        {req.status === 'Uploaded' && (
                          <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1">
                            <FileText size={12} /> View Uploaded PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all ${
                      uploadingId === req.name 
                        ? 'bg-gray-200 text-gray-500' 
                        : req.status === 'Uploaded' 
                          ? 'bg-white/60 text-gray-700 border border-gray-200 hover:bg-white' 
                          : 'glass-button-primary text-white'
                    }`}>
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

        {/* PROGRESS BAR */}
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="font-bold text-gray-800">Upload Progress</h2>
              <p className="text-xs text-gray-500 font-medium mt-1">{uploadedCount} sa {REQUIRED_DOCS.length} requirements</p>
            </div>
            <span className={`text-3xl font-extrabold ${progressPercent === 100 ? 'text-green-500' : 'text-blue-600'}`}>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200/50 rounded-full h-4 mb-4 overflow-hidden shadow-inner">
            <div className={`h-full rounded-full transition-all duration-500 ease-out ${progressPercent === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${progressPercent}%` }}></div>
          </div>
          
          {uploadedCount > 0 && (
            <button onClick={handleDownloadAll} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500 text-white font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-colors">
              <Download size={20} /> Download All Files ({uploadedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
