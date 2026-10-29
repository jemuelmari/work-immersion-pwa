import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, FileText, ArrowLeft, Loader2 } from 'lucide-react'

export default function StudentRequirements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchFiles = async () => {
    const { data } = await supabase.from('requirements').select('*').eq('lrn', user?.id).order('uploaded_at', { ascending: false })
    if (data) setFiles(data)
    setLoading(false)
  }

  useEffect(() => { fetchFiles() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const fileName = `${user?.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('requirements_files').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('requirements_files').getPublicUrl(fileName)
      
      await supabase.from('requirements').insert({
        lrn: user?.id,
        file_name: file.name,
        file_url: urlData.publicUrl
      })

      fetchFiles()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
        <h1 className="font-bold text-gray-800">Requirements</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <p className="text-sm text-gray-600 mb-4">I-upload ang mga kailangang dokumento (ID, Consent Form, etc.)</p>
          <label className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl cursor-pointer font-bold transition-colors ${uploading ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            {uploading ? 'Nag-a-upload...' : 'Mag-upload ng File'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-700">Mga Na-upload Mo</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Wala ka pang na-upload.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {files.map(f => (
                <div key={f.id} className="p-4 flex items-center gap-3">
                  <FileText className="text-blue-500 shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                    <p className="text-xs text-gray-500">{new Date(f.uploaded_at).toLocaleDateString()}</p>
                  </div>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium">View</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
