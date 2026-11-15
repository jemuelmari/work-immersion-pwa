import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/db'
import { REQUIRED_DOCS } from '../lib/constants'
import { openFile, downloadMany, safeFilePart, getFileUrlMap } from '../lib/files'
import { uploadRequirement, syncRequirementFiles, SYNC_EVENT } from '../lib/sync'
import { Upload, FileText, ArrowLeft, Loader2, CheckCircle, XCircle, Download, Clock } from 'lucide-react'

interface RequirementRow {
  name: string
  status: 'Uploaded' | 'Queued' | 'Missing'
  file_url: string | null
  file_name: string | null
}

export default function StudentRequirements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [requirements, setRequirements] = useState<RequirementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [links, setLinks] = useState<Record<string, string>>({})

  const fetchRequirements = useCallback(async () => {
    if (!user?.id) return
    const queued = await db.fileQueue.where('lrn').equals(user.id).toArray()
    let data: any[] | null = null
    if (navigator.onLine) {
      const res = await supabase.from('requirements').select('requirement_name, status, file_url, file_name').eq('lrn', user.id)
      data = res.data
    }

    setRequirements(REQUIRED_DOCS.map(docName => {
      const existing = data?.find(d => d.requirement_name === docName)
      const inQueue = queued.find(q => q.requirementName === docName && q.status !== 'failed')
      return {
        name: docName,
        status: existing?.status === 'Uploaded' ? 'Uploaded' : inQueue ? 'Queued' : 'Missing',
        file_url: existing?.file_url || null,
        file_name: existing?.file_name || inQueue?.fileName || null,
      }
    }))
    setLoading(false)
    if (data) getFileUrlMap('requirements_files', data, (d: any) => d.requirement_name, (d: any) => d.file_url).then(setLinks)
  }, [user?.id])

  useEffect(() => { fetchRequirements() }, [fetchRequirements])

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); fetchRequirements() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener(SYNC_EVENT, fetchRequirements)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(SYNC_EVENT, fetchRequirements)
    }
  }, [fetchRequirements])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, reqName: string) => {
    const file = e.target.files?.[0]
    e.target.value = '' // para mapili ulit ang parehong file
    if (!file || !user) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { alert('PDF files lang ang pwede i-upload.'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Sobra ang laki ng file. Max 5MB lang.'); return }

    setUploadingId(reqName)
    try {
      if (navigator.onLine) {
        await uploadRequirement(user.id, reqName, file, file.name)
      } else {
        await db.fileQueue.add({
          lrn: user.id, requirementName: reqName, fileBlob: file, fileName: file.name,
          status: 'pending', createdAt: new Date().toISOString()
        })
        alert('Offline ka ngayon. Naka-save muna ang file sa device at kusang ipapadala kapag may internet na.')
      }
    } catch (err: any) {
      if (!navigator.onLine || /fetch|network/i.test(err?.message || '')) {
        // Naputol ang internet habang nag-a-upload: i-queue na lang
        await db.fileQueue.add({
          lrn: user.id, requirementName: reqName, fileBlob: file, fileName: file.name,
          status: 'pending', createdAt: new Date().toISOString()
        })
        alert('Naputol ang internet. Naka-save ang file sa device at ipapadala mamaya.')
        syncRequirementFiles().catch(console.error)
      } else {
        alert('Upload Error: ' + (err?.message || err))
      }
    } finally {
      setUploadingId(null)
      fetchRequirements()
    }
  }

  const handleDownloadAll = async () => {
    const uploaded = requirements.filter(r => r.status === 'Uploaded')
    if (uploaded.length === 0 || !user) return
    const nameParts = user.name.split(' ')
    const firstName = safeFilePart(nameParts[0])
    const lastName = safeFilePart(nameParts.slice(1).join(' '))
    setDownloading(true)
    await downloadMany(uploaded.map(req => ({
      bucket: 'requirements_files' as const,
      value: req.file_url,
      fileName: `${user.id}_${lastName}_${firstName}_${safeFilePart(req.name)}.pdf`,
    })))
    setDownloading(false)
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
                  <div className="flex items-start gap-3">
                    {req.status === 'Uploaded' ? <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={20} />
                      : req.status === 'Queued' ? <Clock className="text-yellow-500 mt-0.5 shrink-0" size={20} />
                      : <XCircle className="text-gray-300 mt-0.5 shrink-0" size={20} />}
                    <div>
                      <p className={`text-sm font-semibold ${req.status === 'Missing' ? 'text-gray-500' : 'text-gray-800'}`}>{req.name}</p>
                      {req.status === 'Uploaded' && (
                        links[req.name]
                          ? <a href={links[req.name]} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1"><FileText size={12} /> View Uploaded PDF</a>
                          : <button onClick={() => openFile('requirements_files', req.file_url)} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1"><FileText size={12} /> View Uploaded PDF</button>
                      )}
                      {req.status === 'Queued' && <p className="text-xs text-yellow-700 mt-1">Naka-save sa device, ipapadala kapag may internet</p>}
                    </div>
                  </div>

                  <label className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${uploadingId !== null ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                    uploadingId === req.name
                      ? 'bg-gray-200 text-gray-500'
                      : req.status === 'Missing'
                        ? 'glass-button-primary text-white'
                        : 'bg-white/60 text-gray-700 border border-gray-200 hover:bg-white'
                  }`}>
                    {uploadingId === req.name ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                    {uploadingId === req.name ? 'Nag-a-upload...' : req.status === 'Missing' ? 'Upload PDF' : 'Re-upload (Palitan)'}
                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleUpload(e, req.name)} disabled={uploadingId !== null} />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

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
            <button onClick={handleDownloadAll} disabled={downloading || !isOnline} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500 text-white font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-colors disabled:opacity-50">
              {downloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />} Download All Files ({uploadedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
