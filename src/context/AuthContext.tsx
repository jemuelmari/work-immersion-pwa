import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type UserRole = 'Student' | 'Teacher' | 'Admin'

interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  section?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (id: string, password: string, isTeacher: boolean) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('wi_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (id: string, password: string, isTeacher: boolean) => {
    try {
      const email = isTeacher ? id : `${id}@student.local`

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw new Error('Mali ang ID o Password.')

      if (isTeacher) {
        const { data: teacherData, error: tError } = await supabase
          .from('teachers')
          .select('*')
          .eq('email', id)
          .single()
        
        if (tError || !teacherData) throw new Error('Teacher record not found.')
        if (teacherData.status !== 'Approved') throw new Error('Pending pa ang approval mo.')

        const newUser = { 
          id: teacherData.email, 
          role: teacherData.role as UserRole, 
          name: teacherData.email 
        }
        setUser(newUser)
        localStorage.setItem('wi_user', JSON.stringify(newUser))

      } else {
        const { data: studentData, error: sError } = await supabase
          .from('students')
          .select('*')
          .eq('lrn', id)
          .single()

        if (sError || !studentData) throw new Error('Student record not found.')

        const newUser = { 
          id: studentData.lrn, 
          role: 'Student' as UserRole, 
          name: `${studentData.first_name} ${studentData.last_name}`,
          section: studentData.section
        }
        setUser(newUser)
        localStorage.setItem('wi_user', JSON.stringify(newUser))
      }

      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    localStorage.removeItem('wi_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider')
  return context
}
