import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, Users, CalendarCheck, Search, X, Download, BookOpen, Image as ImageIcon, CheckCircle, XCircle, UserPlus, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Student {
  lrn: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  section: string;
  status: string;
  field: string;
  course: string;
  deployment_area: string;
  sex: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  time_in: string;
  time_out: string;
  total_hours: number;
  time_in_photo: string;
  time_out_photo: string;
}

interface DiaryRecord {
  id: string;
  day_number: number;
  date: string;
  entry_text: string;
  image_urls: string[];
}

interface RequirementRecord {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

export default function TeacherDashboard({ onOpenScores, onOpenAnnouncements }: { onOpenScores: () => void; onOpenAnnouncements: () => void }) {
  const { user, logout } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Filter States
  const [filterSection, setFilterSection] = useState('All')
  const [filterSex, setFilterSex] = useState('All')

  const [activeTab, setActiveTab] = useState<'directory' | 'approvals'>('directory')
  
  // Modal States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [modalTab, setModalTab] = useState<'attendance' | 'diary' | 'requirements'>('attendance')
  
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [diary, setDiary] = useState<DiaryRecord[]>([])
  const [requirements, setRequirements] = useState<RequirementRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [selectedDiaryEntry, setSelectedDiaryEntry] = useState<DiaryRecord | null>(null)

  const fetchStudents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('last_name', { ascending: true })
    
    if (!error && data) setStudents(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleApprove = async (lrn: string) => {
    const { error } = await supabase.from('students').update({ status: 'Approved' }).eq('lrn', lrn)
    if (!error) fetchStudents()
    else alert("Error sa pag-approve: " + error.message)
  }

  const handleReject = async (lrn: string) => {
    if (!confirm("Sigurado ka bang gusto mong i-reject ito?")) return
    const { error } = await supabase.from('students').update({ status: 'Rejected' }).eq('lrn', lrn)
    if (!error) fetchStudents()
    else alert("Error sa pag-reject: " + error.message)
  }

  const approvedStudents = students.filter(s => s.status === 'Approved')
  const pendingStudents = students.filter(s => s.status === 'Pending')

  // --- FILTER LOGIC ---
  const filteredStudents = approvedStudents.filter(s => {
    const matchesSearch = s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.lrn.includes(searchTerm);
    const matchesSection = filterSection === 'All' || s.section === filterSection;
    const matchesSex = filterSex === 'All' || s.sex === filterSex;
    
    return matchesSearch && matchesSection && matchesSex;
  })

  // --- EXPORT TO CSV FUNCTION ---
  const handleExportStudents = () => {
    let csvContent = "LRN,Last Name,First Name,Middle Name,Sex,Section,Field,Course,Deployment Area\n"
    
    filteredStudents.forEach(s => {
      csvContent += `${s.lrn},"${s.last_name}","${s.first_name}","${s.middle_name || ''}",${s.sex},${s.section},${s.field},${s.course},${s.deployment_area}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.setAttribute("href", URL.createObjectURL(blob))
    link.setAttribute("download", `StudentList_${filterSection}_${filterSex}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleViewRecord = async (student: Student) => {
    setSelectedStudent(student)
    setModalTab('attendance')
    setLoadingRecords(true)
    
    const { data: attData } = await supabase.from('attendance').select('*').eq('lrn', student.lrn).order('date', { ascending: true })
    if (attData) setAttendance(attData)

    const { data: diaryData } = await supabase.from('diary').select('*').eq('lrn', student.lrn).order('day_number', { ascending: true })
    if (diaryData) setDiary(diaryData)

    const { data: reqData } = await supabase.from('requirements').select('*').eq('lrn', student.lrn).order('uploaded_at', { ascending: false })
    if (reqData) setRequirements(reqData)
    
    setLoadingRecords(false)
  }

  const computeHours = (timeIn: string, timeOut: string) => {
    if (!timeIn || !timeOut) return 0;
    try {
      const t1 = timeIn.split(':').map(Number);
      const t2 = timeOut.split(':').map(Number);
      let seconds1 = (t1[0] * 3600) + (t1[1] * 60) + (t1[2] || 0);
      let seconds2 = (t2[0] * 3600) + (t2[1] * 60) + (t2[2] || 0);
      let diff = seconds2 - seconds1;
      if (diff < 0) diff += 24 * 3600;
      return (diff / 3600).toFixed(2);
    } catch (e) { return "0.00"; }
  }

  const calculateTotalHours = () => {
    let total = 0
    attendance.forEach(rec => { total += parseFloat(computeHours(rec.time_in, rec.time_out)) })
    return total.toFixed(2)
  }

  const handleExportDTR = () => {
    if (!selectedStudent || attendance.length === 0) return
    let csvContent = `DAILY TIME RECORD\nName: ${selectedStudent.last_name}, ${selectedStudent.first_name}\nSection: ${selectedStudent.section}\nField: ${selectedStudent.field}\nCourse: ${selectedStudent.course}\nArea: ${selectedStudent.deployment_area}\nLRN: ${selectedStudent.lrn}\n\n`
    csvContent += "Day,Date,AM Arrival,AM Departure,PM Arrival,PM Departure,Undertime (Hrs),Total Hours\n"
    let grandTotal = 0;

    attendance.forEach((rec, index) => {
      const dayNum = index + 1;
      const tIn = rec.time_in ? rec.time_in.split(':').map(Number) : null;
      const tOut = rec.time_out ? rec.time_out.split(':').map(Number) : null;
      let amArrival = "-", amDeparture = "-", pmArrival = "-", pmDeparture = "-";
      let totalHrs = 0;

      if (tIn && tOut) {
        const formatTime = (h: number, m: number) => {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
        };
        const formattedIn = formatTime(tIn[0], tIn[1]);
        const formattedOut = formatTime(tOut[0], tOut[1]);
        totalHrs = parseFloat(computeHours(rec.time_in, rec.time_out));
        
        if (tIn[0] < 12) {
          amArrival = formattedIn;
          if (tOut[0] < 13) amDeparture = formattedOut;
        }
        if (tIn[0] >= 12 || tOut[0] >= 13) {
          if (tIn[0] < 12 && tOut[0] >= 13) { amDeparture = "12:00 PM"; pmArrival = "01:00 PM"; } 
          else if (tIn[0] >= 12) { pmArrival = formattedIn; }
          pmDeparture = formattedOut;
        }
      }
      grandTotal += totalHrs;
      csvContent += `${dayNum},${rec.date},${amArrival},${amDeparture},${pmArrival},${pmDeparture},${totalHrs > 0 ? '0' : '-'},${totalHrs.toFixed(2)}\n`;
    })
    csvContent += `\n\nTOTAL HOURS:,${grandTotal.toFixed(2)}\n`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.setAttribute("href", URL.createObjectURL(blob))
    link.setAttribute("download", `DTR_DepEd48_${selectedStudent.last_name}_${selectedStudent.first_name}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-100 relative">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg">Teacher Dashboard</h1>
            <p className="text-blue-200 text-xs">{user?.role} | {user?.name}</p>
          </div>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        
        {/* TABS */}
        <div className="flex flex-wrap gap-2 border-b border-gray-300">
          <button onClick={() => setActiveTab('directory')} className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'directory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Users size={16} /> Student Directory</button>
          <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'approvals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><UserPlus size={16} /> Approvals {pendingStudents.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingStudents.length}</span>}</button>
          
          <button onClick={onOpenScores} className="px-4 py-2 font-medium text-sm flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors ml-auto border-b-2 border-transparent"><CalendarCheck size={16} /> Manage Scores</button>
          <button onClick={onOpenAnnouncements} className="px-4 py-2 font-medium text-sm flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors border-b-2 border-transparent"><BookOpen size={16} /> Announcements</button>
        </div>

        {/* DIRECTORY TAB */}
        {activeTab === 'directory' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4"><div className="bg-blue-100 text-blue-600 p-3 rounded-lg"><Users size={24} /></div><div><p className="text-sm text-gray-500">Approved Students</p><p className="text-2xl font-bold text-gray-800">{approvedStudents.length}</p></div></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4"><div className="bg-green-100 text-green-600 p-3 rounded-lg"><CalendarCheck size={24} /></div><div><p className="text-sm text-gray-500">Sections</p><p className="text-2xl font-bold text-gray-800">12 GAS & 12 HUMSS</p></div></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* TOOLBAR WITH FILTERS AND EXPORT */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Search name or LRN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64" />
                  </div>
                  
                  <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option value="All">All Sections</option>
                    <option value="12 GAS">12 GAS</option>
                    <option value="12 HUMSS">12 HUMSS</option>
                  </select>

                  <select value={filterSex} onChange={e => setFilterSex(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option value="All">All Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <button onClick={handleExportStudents} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                  <Download size={16} /> Export List
                </button>
              </div>
              
              {loading ? <div className="p-8 text-center text-gray-500">Loading students...</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white border-b border-gray-200 text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">LRN</th>
                        <th className="px-4 py-3 font-medium">Last Name</th>
                        <th className="px-4 py-3 font-medium">First Name</th>
                        <th className="px-4 py-3 font-medium">M.I.</th>
                        <th className="px-4 py-3 font-medium">Sex</th>
                        <th className="px-4 py-3 font-medium">Section</th>
                        <th className="px-4 py-3 font-medium">Course</th>
                        <th className="px-4 py-3 font-medium">Area</th>
                        <th className="px-4 py-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map(student => (
                        <tr key={student.lrn} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-gray-600">{student.lrn}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{student.last_name}</td>
                          <td className="px-4 py-3 text-gray-800">{student.first_name}</td>
                          <td className="px-4 py-3 text-gray-600">{student.middle_name ? student.middle_name.charAt(0) + '.' : '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{student.sex}</td>
                          <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{student.section}</span></td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{student.course}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{student.deployment_area}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleViewRecord(student)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">View Record</button>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Walang nahanap na estudyante base sa filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50"><h2 className="font-bold text-gray-800">Pending Student Registrations</h2></div>
            {pendingStudents.length === 0 ? <div className="p-8 text-center text-gray-500">Walang pending na estudyante.</div> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-gray-200 text-gray-500">
                  <tr><th className="px-6 py-3 font-medium">LRN</th><th className="px-6 py-3 font-medium">Name</th><th className="px-6 py-3 font-medium">Section</th><th className="px-6 py-3 font-medium">Field & Course</th><th className="px-6 py-3 font-medium text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingStudents.map(student => (
                    <tr key={student.lrn} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-600">{student.lrn}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">{student.last_name}, {student.first_name}</td>
                      <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{student.section}</span></td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{student.field} <br/> {student.course}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => handleApprove(student.lrn)} className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center gap-1 bg-green-50 px-3 py-1 rounded"><CheckCircle size={16} /> Approve</button>
                        <button onClick={() => handleReject(student.lrn)} className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center gap-1 bg-red-50 px-3 py-1 rounded"><XCircle size={16} /> Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Student Modal (Pareho pa rin, walang binago) */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Student Records</h3>
                <p className="text-sm text-gray-500">{selectedStudent.last_name}, {selectedStudent.first_name} ({selectedStudent.lrn})</p>
                <p className="text-xs text-blue-600 font-medium mt-1">{selectedStudent.field} | {selectedStudent.course} | {selectedStudent.deployment_area}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 p-2"><X size={24} /></button>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              <button onClick={() => setModalTab('attendance')} className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><CalendarCheck size={16} /> Attendance (DTR)</button>
              <button onClick={() => setModalTab('diary')} className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'diary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BookOpen size={16} /> Daily Diary</button>
              <button onClick={() => setModalTab('requirements')} className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'requirements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><FileText size={16} /> Requirements</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {loadingRecords ? <div className="text-center py-10 text-gray-500">Loading records...</div> : modalTab === 'attendance' ? (
                attendance.length === 0 ? <div className="text-center py-10 text-gray-500">Wala pang attendance record.</div> : (
                  <>
                    <div className="mb-4 bg-white p-4 rounded-lg flex justify-between items-center shadow-sm border border-gray-200">
                      <span className="font-medium text-gray-700">Total Rendered Hours:</span>
                      <span className="text-2xl font-bold text-blue-600">{calculateTotalHours()} hrs</span>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Time In</th><th className="px-4 py-3 font-medium">Time Out</th><th className="px-4 py-3 font-medium">Photos</th><th className="px-4 py-3 font-medium text-right">Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {attendance.map(rec => (
                            <tr key={rec.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-700">{rec.date}</td>
                              <td className="px-4 py-3 text-gray-600">{rec.time_in || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{rec.time_out || '-'}</td>
                              <td className="px-4 py-3 flex gap-2">
                                {rec.time_in_photo && <button onClick={() => setSelectedPhoto(rec.time_in_photo)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">In Photo</button>}
                                {rec.time_out_photo && <button onClick={() => setSelectedPhoto(rec.time_out_photo)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Out Photo</button>}
                              </td>
                              <td className="px-4 py-3 text-gray-800 font-bold text-right">{computeHours(rec.time_in, rec.time_out)} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              ) : modalTab === 'diary' ? (
                diary.length === 0 ? <div className="text-center py-10 text-gray-500">Wala pang diary entry.</div> : (
                  <div className="space-y-3">
                    {diary.map(entry => (
                      <div key={entry.id} onClick={() => setSelectedDiaryEntry(entry)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <div className="flex justify-between items-center mb-2"><span className="font-bold text-blue-600">Day {entry.day_number}</span><span className="text-xs text-gray-500">{entry.date}</span></div>
                        <p className="text-sm text-gray-700 line-clamp-2">{entry.entry_text}</p>
                        {entry.image_urls?.length > 0 && <div className="mt-3 flex items-center gap-2 text-xs text-gray-500"><ImageIcon size={14} /> {entry.image_urls.length} image(s)</div>}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                requirements.length === 0 ? <div className="text-center py-10 text-gray-500">Wala pang na-upload na requirements.</div> : (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {requirements.map(req => (
                        <div key={req.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <FileText className="text-blue-500" size={20} />
                            <div>
                              <p className="font-medium text-sm text-gray-800">{req.file_name}</p>
                              <p className="text-xs text-gray-500">{new Date(req.uploaded_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">View File</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setSelectedStudent(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Close</button>
              {modalTab === 'attendance' && (
                <button onClick={handleExportDTR} disabled={attendance.length === 0} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2"><Download size={16} /> Export DTR</button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Attendance" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
        </div>
      )}

      {selectedDiaryEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div><h3 className="font-bold text-gray-800">Day {selectedDiaryEntry.day_number} Diary</h3><p className="text-xs text-gray-500">{selectedDiaryEntry.date}</p></div>
              <button onClick={() => setSelectedDiaryEntry(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{selectedDiaryEntry.entry_text}</p>
              {selectedDiaryEntry.image_urls?.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-2">Attached Images:</p>
                  {selectedDiaryEntry.image_urls.map((url, i) => <img key={i} src={url} alt="Diary" className="w-full rounded-lg border border-gray-200" />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
