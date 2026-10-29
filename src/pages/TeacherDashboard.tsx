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
  requirement_name: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

export default function TeacherDashboard({ onOpenScores, onOpenAnnouncements }: { onOpenScores: () => void; onOpenAnnouncements: () => void }) {
  const { user, logout } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSection, setFilterSection] = useState('All')
  const [filterSex, setFilterSex] = useState('All')
  const [activeTab, setActiveTab] = useState<'directory' | 'approvals'>('directory')
  
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
    const { data, error } = await supabase.from('students').select('*').order('last_name', { ascending: true })
    if (!error && data) setStudents(data)
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [])

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

  const filteredStudents = approvedStudents.filter(s => {
    const matchesSearch = s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.lrn.includes(searchTerm);
    const matchesSection = filterSection === 'All' || s.section === filterSection;
    const matchesSex = filterSex === 'All' || s.sex === filterSex;
    return matchesSearch && matchesSection && matchesSex;
  }).sort((a, b) => {
    if (a.sex !== b.sex) return a.sex.localeCompare(b.sex);
    if (a.last_name !== b.last_name) return a.last_name.localeCompare(b.last_name);
    return a.first_name.localeCompare(b.first_name);
  })

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
    <div className="min-h-screen relative pb-10">
      {/* HEADER */}
      <div className="glass-panel p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg text-gray-800">Teacher Dashboard</h1>
            <p className="text-gray-500 text-xs font-medium">{user?.role} | {user?.name}</p>
          </div>
          <button onClick={logout} className="bg-white/60 hover:bg-white text-red-600 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold shadow-sm border border-white/50">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6 mt-2">
        
        {/* TABS */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 w-fit">
          <button onClick={() => setActiveTab('directory')} className={`px-5 py-2.5 font-bold text-sm flex items-center gap-2 rounded-xl transition-all ${activeTab === 'directory' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`}><Users size={16} /> Directory</button>
          <button onClick={() => setActiveTab('approvals')} className={`px-5 py-2.5 font-bold text-sm flex items-center gap-2 rounded-xl transition-all ${activeTab === 'approvals' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`}><UserPlus size={16} /> Approvals {pendingStudents.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingStudents.length}</span>}</button>
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex gap-3">
          <button onClick={onOpenScores} className="glass-card px-5 py-3 rounded-2xl flex items-center gap-2 font-bold text-gray-700 hover:bg-white/90 transition-colors"><CalendarCheck size={18} className="text-blue-600" /> Manage Scores</button>
          <button onClick={onOpenAnnouncements} className="glass-card px-5 py-3 rounded-2xl flex items-center gap-2 font-bold text-gray-700 hover:bg-white/90 transition-colors"><BookOpen size={18} className="text-blue-600" /> Announcements</button>
        </div>

        {/* DIRECTORY TAB */}
        {activeTab === 'directory' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-6 rounded-3xl flex items-center gap-5">
                <div className="bg-blue-100 text-blue-600 p-4 rounded-2xl"><Users size={28} /></div>
                <div><p className="text-sm text-gray-500 font-bold">Approved Students</p><p className="text-3xl font-extrabold text-gray-800">{approvedStudents.length}</p></div>
              </div>
              <div className="glass-card p-6 rounded-3xl flex items-center gap-5">
                <div className="bg-green-100 text-green-600 p-4 rounded-2xl"><CalendarCheck size={28} /></div>
                <div><p className="text-sm text-gray-500 font-bold">Sections</p><p className="text-3xl font-extrabold text-gray-800">12 GAS & 12 HUMSS</p></div>
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden">
              <div className="p-5 bg-white/40 border-b border-white/50 backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Search name or LRN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" />
                  </div>
                  <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="glass-input px-4 py-2.5 rounded-xl text-sm font-medium outline-none">
                    <option value="All">All Sections</option>
                    <option value="12 GAS">12 GAS</option>
                    <option value="12 HUMSS">12 HUMSS</option>
                  </select>
                  <select value={filterSex} onChange={e => setFilterSex(e.target.value)} className="glass-input px-4 py-2.5 rounded-xl text-sm font-medium outline-none">
                    <option value="All">All Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <button onClick={handleExportStudents} className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-green-200 transition-colors w-full md:w-auto justify-center">
                  <Download size={16} /> Export List
                </button>
              </div>
              
              {loading ? <div className="p-10 text-center text-gray-500 font-medium">Loading students...</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white/30 border-b border-white/50 text-gray-600">
                      <tr>
                        <th className="px-5 py-4 font-bold">LRN</th>
                        <th className="px-5 py-4 font-bold">Last Name</th>
                        <th className="px-5 py-4 font-bold">First Name</th>
                        <th className="px-5 py-4 font-bold">M.I.</th>
                        <th className="px-5 py-4 font-bold">Sex</th>
                        <th className="px-5 py-4 font-bold">Section</th>
                        <th className="px-5 py-4 font-bold">Course</th>
                        <th className="px-5 py-4 font-bold">Area</th>
                        <th className="px-5 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                      {filteredStudents.map(student => (
                        <tr key={student.lrn} className="hover:bg-white/40 transition-colors">
                          <td className="px-5 py-4 font-mono text-gray-700">{student.lrn}</td>
                          <td className="px-5 py-4 font-bold text-gray-800">{student.last_name}</td>
                          <td className="px-5 py-4 text-gray-800">{student.first_name}</td>
                          <td className="px-5 py-4 text-gray-600">{student.middle_name ? student.middle_name.charAt(0) + '.' : '-'}</td>
                          <td className="px-5 py-4 text-gray-600">{student.sex}</td>
                          <td className="px-5 py-4"><span className="bg-blue-100/80 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">{student.section}</span></td>
                          <td className="px-5 py-4 text-gray-600 text-xs font-medium">{student.course}</td>
                          <td className="px-5 py-4 text-gray-600 text-xs font-medium">{student.deployment_area}</td>
                          <td className="px-5 py-4 text-right">
                            <button onClick={() => handleViewRecord(student)} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50/50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">View Record</button>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500 font-medium">Walang nahanap na estudyante base sa filter.</td></tr>
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
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="p-5 bg-white/40 border-b border-white/50 backdrop-blur-sm"><h2 className="font-bold text-gray-800">Pending Student Registrations</h2></div>
            {pendingStudents.length === 0 ? <div className="p-10 text-center text-gray-500 font-medium">Walang pending na estudyante.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white/30 border-b border-white/50 text-gray-600">
                  <tr><th className="px-5 py-4 font-bold">LRN</th><th className="px-5 py-4 font-bold">Name</th><th className="px-5 py-4 font-bold">Section</th><th className="px-5 py-4 font-bold">Field & Course</th><th className="px-5 py-4 font-bold text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {pendingStudents.map(student => (
                    <tr key={student.lrn} className="hover:bg-white/40 transition-colors">
                      <td className="px-5 py-4 font-mono text-gray-700">{student.lrn}</td>
                      <td className="px-5 py-4 font-bold text-gray-800">{student.last_name}, {student.first_name}</td>
                      <td className="px-5 py-4"><span className="bg-blue-100/80 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">{student.section}</span></td>
                      <td className="px-5 py-4 text-gray-600 text-xs font-medium">{student.field} <br/> {student.course}</td>
                      <td className="px-5 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => handleApprove(student.lrn)} className="text-white bg-green-500 hover:bg-green-600 font-bold text-sm flex items-center gap-1 px-4 py-2 rounded-xl shadow-sm shadow-green-200 transition-colors"><CheckCircle size={16} /> Approve</button>
                        <button onClick={() => handleReject(student.lrn)} className="text-white bg-red-500 hover:bg-red-600 font-bold text-sm flex items-center gap-1 px-4 py-2 rounded-xl shadow-sm shadow-red-200 transition-colors"><XCircle size={16} /> Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* STUDENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/50 bg-white/40 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-extrabold text-gray-800">Student Records</h3>
                <p className="text-sm text-gray-600 font-medium mt-1">{selectedStudent.last_name}, {selectedStudent.first_name} ({selectedStudent.lrn})</p>
                <p className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 px-2 py-1 rounded w-fit">{selectedStudent.field} | {selectedStudent.course} | {selectedStudent.deployment_area}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-white/50 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="flex border-b border-white/50 px-6 bg-white/20">
              <button onClick={() => setModalTab('attendance')} className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${modalTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><CalendarCheck size={18} /> Attendance (DTR)</button>
              <button onClick={() => setModalTab('diary')} className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${modalTab === 'diary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><BookOpen size={18} /> Daily Diary</button>
              <button onClick={() => setModalTab('requirements')} className={`py-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${modalTab === 'requirements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}><FileText size={18} /> Requirements</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingRecords ? <div className="text-center py-10 text-gray-500 font-medium">Loading records...</div> : modalTab === 'attendance' ? (
                attendance.length === 0 ? <div className="text-center py-10 text-gray-500 font-medium">Wala pang attendance record.</div> : (
                  <>
                    <div className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-500 p-5 rounded-2xl flex justify-between items-center shadow-lg shadow-blue-200">
                      <span className="font-bold text-white/90">Total Rendered Hours:</span>
                      <span className="text-3xl font-extrabold text-white">{calculateTotalHours()} <span className="text-lg">hrs</span></span>
                    </div>
                    <div className="bg-white/60 rounded-2xl border border-white/50 overflow-hidden">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/80 border-b border-gray-100 text-gray-600">
                          <tr><th className="px-5 py-3 font-bold">Date</th><th className="px-5 py-3 font-bold">Time In</th><th className="px-5 py-3 font-bold">Time Out</th><th className="px-5 py-3 font-bold">Photos</th><th className="px-5 py-3 font-bold text-right">Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {attendance.map(rec => (
                            <tr key={rec.id} className="hover:bg-white transition-colors">
                              <td className="px-5 py-3 text-gray-800 font-medium">{rec.date}</td>
                              <td className="px-5 py-3 text-gray-600 font-mono text-xs">{rec.time_in || '-'}</td>
                              <td className="px-5 py-3 text-gray-600 font-mono text-xs">{rec.time_out || '-'}</td>
                              <td className="px-5 py-3 flex gap-2">
                                {rec.time_in_photo && <button onClick={() => setSelectedPhoto(rec.time_in_photo)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold hover:bg-blue-200 transition-colors">In Photo</button>}
                                {rec.time_out_photo && <button onClick={() => setSelectedPhoto(rec.time_out_photo)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors">Out Photo</button>}
                              </td>
                              <td className="px-5 py-3 text-blue-600 font-extrabold text-right">{computeHours(rec.time_in, rec.time_out)} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              ) : modalTab === 'diary' ? (
                diary.length === 0 ? <div className="text-center py-10 text-gray-500 font-medium">Wala pang diary entry.</div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {diary.map(entry => (
                      <div key={entry.id} onClick={() => setSelectedDiaryEntry(entry)} className="bg-white/80 p-5 rounded-2xl shadow-sm border border-white hover:border-blue-300 cursor-pointer transition-all hover:scale-[1.02]">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-sm">Day {entry.day_number}</span>
                          <span className="text-xs text-gray-500 font-medium">{entry.date}</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{entry.entry_text}</p>
                        {entry.image_urls?.length > 0 && <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 font-medium"><ImageIcon size={14} /> {entry.image_urls.length} image(s) attached</div>}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                requirements.length === 0 ? <div className="text-center py-10 text-gray-500 font-medium">Wala pang na-upload na requirements.</div> : (
                  <>
                    <div className="mb-4 flex justify-end">
                      <button onClick={() => {
                          requirements.forEach(req => {
                            const safeName = req.requirement_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Document'
                            const fileName = `${selectedStudent.lrn}_${selectedStudent.last_name}_${selectedStudent.first_name}_${safeName}.pdf`
                            const link = document.createElement('a')
                            link.href = req.file_url
                            link.download = fileName
                            link.target = '_blank'
                            link.click()
                          })
                        }}
                        className="text-sm bg-green-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-600 flex items-center gap-2 shadow-lg shadow-green-200 transition-colors">
                        <Download size={16} /> Download All Files
                      </button>
                    </div>
                    <div className="bg-white/60 rounded-2xl border border-white/50 overflow-hidden divide-y divide-gray-100">
                      {requirements.map(req => (
                        <div key={req.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><FileText size={20} /></div>
                            <div>
                              <p className="font-bold text-sm text-gray-800">{req.requirement_name}</p>
                              <p className="text-xs text-gray-500 font-medium">{req.file_name} • {new Date(req.uploaded_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">View</a>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </div>

            <div className="p-4 border-t border-white/50 bg-white/40 flex justify-end gap-3">
              <button onClick={() => setSelectedStudent(null)} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-white/80 rounded-xl transition-colors">Close</button>
              {modalTab === 'attendance' && (
                <button onClick={handleExportDTR} disabled={attendance.length === 0} className="px-5 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"><Download size={16} /> Export DTR</button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Attendance" className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" />
        </div>
      )}

      {selectedDiaryEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="glass-card rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-white/50 bg-white/40 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-gray-800 text-lg">Day {selectedDiaryEntry.day_number} Diary</h3>
                <p className="text-xs text-gray-500 font-medium">{selectedDiaryEntry.date}</p>
              </div>
              <button onClick={() => setSelectedDiaryEntry(null)} className="text-gray-400 hover:text-gray-600 bg-white/50 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-gray-700 whitespace-pre-wrap mb-6 leading-relaxed">{selectedDiaryEntry.entry_text}</p>
              {selectedDiaryEntry.image_urls?.length > 0 && (
                <div className="space-y-3 mt-4 pt-4 border-t border-white/50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attached Images</p>
                  {selectedDiaryEntry.image_urls.map((url, i) => <img key={i} src={url} alt="Diary" className="w-full rounded-xl border border-white shadow-sm" />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
