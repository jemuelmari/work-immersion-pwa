import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, Users, CalendarCheck, Search, X, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Student {
  lrn: string;
  first_name: string;
  last_name: string;
  section: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  time_in: string;
  time_out: string;
  total_hours: number;
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('lrn, first_name, last_name, section')
        .order('last_name', { ascending: true })
      
      if (!error && data) {
        setStudents(data)
      }
      setLoading(false)
    }
    fetchStudents()
  }, [])

  const filteredStudents = students.filter(s => 
    s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.lrn.includes(searchTerm)
  )

  // Function para tingnan ang attendance
  const handleViewRecord = async (student: Student) => {
    setSelectedStudent(student)
    setLoadingAttendance(true)
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('lrn', student.lrn)
      .order('date', { ascending: true })
      
    if (!error && data) {
      setAttendance(data)
    }
    setLoadingAttendance(false)
  }

  // Function para mag-export ng CSV (Para sa Excel / DepEd Form 48)
  const handleExportDTR = () => {
    if (!selectedStudent || attendance.length === 0) return

    // Header ng CSV
    let csvContent = "LRN,Name,Section,Date,Time In,Time Out,Total Hours\n"
    
    // Data rows
    attendance.forEach(rec => {
      csvContent += `${selectedStudent.lrn},"${selectedStudent.last_name}, ${selectedStudent.first_name}",${selectedStudent.section},${rec.date},${rec.time_in || ''},${rec.time_out || ''},${rec.total_hours || 0}\n`
    })

    // Pag-download ng file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `DTR_${selectedStudent.last_name}_${selectedStudent.first_name}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* Top Navbar */}
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-bold text-gray-800">{students.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <CalendarCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sections</p>
              <p className="text-2xl font-bold text-gray-800">12 GAS & 12 HUMSS</p>
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="font-bold text-gray-800">Student Directory</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name or LRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading students...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">LRN</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Section</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map(student => (
                  <tr key={student.lrn} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-600">{student.lrn}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{student.last_name}, {student.first_name}</td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{student.section}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleViewRecord(student)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View Record
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: Student Attendance Record */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Attendance Record</h3>
                <p className="text-sm text-gray-500">{selectedStudent.last_name}, {selectedStudent.first_name} ({selectedStudent.lrn})</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 p-2">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingAttendance ? (
                <div className="text-center py-10 text-gray-500">Loading records...</div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Wala pang record si {selectedStudent.first_name}.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-l-lg">Date</th>
                      <th className="px-4 py-3 font-medium">Time In</th>
                      <th className="px-4 py-3 font-medium">Time Out</th>
                      <th className="px-4 py-3 font-medium text-right rounded-r-lg">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendance.map(rec => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-medium">{rec.date}</td>
                        <td className="px-4 py-3 text-gray-600">{rec.time_in || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{rec.time_out || '-'}</td>
                        <td className="px-4 py-3 text-gray-800 font-bold text-right">{rec.total_hours || 0} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button 
                onClick={handleExportDTR}
                disabled={attendance.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Download size={16} /> Export DTR (CSV)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
