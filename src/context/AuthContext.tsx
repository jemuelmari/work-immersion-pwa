import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type UserRole = 'Student' | 'Teacher' | 'Admin'

export interface AuthUser {
  id: string
  role: UserRole
  name: string
  section?: string
  isFirstLogin?: boolean
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (id: string, password: string, isTeacher: boolean) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<AuthUser>) => void
}

const STORAGE_KEY = 'wi_user'
const AuthContext = createContext<AuthContextType | undefined>(undefined)

const readCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const friendlyAuthError = (message: string) => {
  if (/invalid login credentials/i.test(message)) return 'Mali ang ID o Password.'
  if (/email not confirmed/i.test(message)) return 'Hindi pa kumpirmado ang account. Ipaalam sa teacher/admin.'
  if (/failed to fetch|network|load failed/i.test(message)) return 'Walang internet. Kailangang online sa pag-login.'
  if (/rate limit|too many/i.test(message)) return 'Sobrang dami ng subok. Maghintay muna ng ilang minuto.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const saveUser = (u: AuthUser | null) => {
    setUser(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      const cached = readCachedUser()
      if (cached) {
        // Siguraduhing may totoong Supabase session pa. Kung offline, pagkatiwalaan muna ang cache.
        const { data } = await supabase.auth.getSession()
        if (!data.session && navigator.onLine) {
          localStorage.removeItem(STORAGE_KEY)
        } else if (active) {
          setUser(cached)
        }
      }
      if (active) setLoading(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const login = async (id: string, password: string, isTeacher: boolean) => {
    const cleanId = id.trim().toLowerCase()
    const email = isTeacher ? cleanId : `${cleanId}@student.local`
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error(friendlyAuthError(authError.message))

      if (isTeacher) {
        const { data: t, error } = await supabase
          .from('teachers')
          .select('email, role, status')
          .eq('email', cleanId)
          .maybeSingle()
        if (error || !t) throw new Error('Walang teacher record para sa email na ito.')
        if (t.status === 'Rejected') throw new Error('Na-reject ang registration mo. Kausapin ang admin.')
        if (t.status !== 'Approved') throw new Error('Pending pa ang approval mo. Hintayin ang admin.')

        saveUser({ id: t.email, role: (t.role === 'Admin' ? 'Admin' : 'Teacher'), name: t.email })
      } else {
        const { data: s, error } = await supabase
          .from('students')
          .select('lrn, first_name, last_name, section, status, is_first_login')
          .eq('lrn', cleanId)
          .maybeSingle()
        if (error || !s) throw new Error('Walang student record para sa LRN na ito.')
        if (s.status === 'Rejected') throw new Error('Na-reject ang registration mo. Kausapin ang iyong teacher.')
        if (s.status !== 'Approved') throw new Error('Hindi pa approved ng teacher ang account mo. Subukan ulit mamaya.')

        saveUser({
          id: s.lrn,
          role: 'Student',
          name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
          section: s.section,
          isFirstLogin: !!s.is_first_login,
        })
      }
      return { error: null }
    } catch (err: any) {
      // Huwag iwanang naka-login sa Supabase kung hindi natuloy
      await supabase.auth.signOut().catch(() => {})
      return { error: err.message }
    }
  }

  const logout = async () => {
    // Burahin ang naka-cache na data sa device (mahalaga sa shared na cellphone)
    try {
      if ('caches' in window) await caches.delete('supabase-api-cache')
    } catch { /* ok lang */ }
    await supabase.auth.signOut().catch(() => {})
    saveUser(null)
  }

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider')
  return context
}
