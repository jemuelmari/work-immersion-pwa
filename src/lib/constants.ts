// Iisang listahan para sa Register, Profile, at Teacher pages.

export const TOTAL_DAYS = 20

export const SECTIONS = ['12 GAS', '12 HUMSS']

export const COURSE_TO_FIELD: Record<string, string> = {
  'Nursing': 'Health', 'Medical Technology': 'Health', 'Caregiving': 'Health',
  'BS Agriculture': 'Agriculture', 'Agribusiness': 'Agriculture', 'Animal Science': 'Agriculture',
  'IT': 'Engineering/IT', 'Civil Engineering': 'Engineering/IT', 'Electrical Engineering': 'Engineering/IT', 'Computer Science': 'Engineering/IT', 'Geodetic Engineering': 'Engineering/IT',
  'Accountancy': 'Business', 'Business Admin': 'Business', 'Entrepreneurship': 'Business', 'Marketing': 'Business',
  'BEEd': 'Education', 'BSEd': 'Education', 'Early Childhood Education': 'Education'
}

export const FIELD_TO_AREAS: Record<string, string[]> = {
  'Health': ['RHU San Jose', 'Lying-In Clinic', 'Hospital'],
  'Agriculture': ['SHEBA', 'Department of Agriculture', 'Farm'],
  'Engineering/IT': ['LGU San Jose', 'Construction Site', 'IT Company'],
  'Business': ['LGU San Jose', "Papay's Bakeshop", 'Bank', 'Office'],
  'Education': []
}

export const SCHOOLS = ['Sta. Cruz Elementary School', 'Iba Elementary School', 'San Jose National High School', 'Other School']

export const REQUIRED_DOCS = [
  'Parental Consent',
  'Application Letter and Resume',
  'Barangay Clearance',
  'Medical Certificate',
  "Mayor's Clearance",
  'Certificate of Indigence',
  'Birth Certificate'
]

export const RUBRIC_CATEGORIES = [
  { id: 'content', name: 'Content & Substance', max: 30, description: 'Detalye ng karanasan, mga natutunan, at mga gawain sa araw na iyon.' },
  { id: 'organization', name: 'Organization & Clarity', max: 20, description: 'Maayos ba ang daloy ng kwento? Madaling maintindihan ang mga pangyayari?' },
  { id: 'reflection', name: 'Depth of Reflection', max: 30, description: 'May malalim bang pagninilay (realizations) sa mga nangyari? Ano ang natutunan mo?' },
  { id: 'mechanics', name: 'Grammar & Mechanics', max: 20, description: 'Wastong baybay, bantas, at paggamit ng salita.' },
]

// "juan DELA cruz" → "Juan Dela Cruz". Gumagana rin sa ñ at may gitling (Santos-Reyes).
export const normalizeName = (str: string | null | undefined) => {
  if (!str) return ''
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-PH')
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('en-PH'))
}

// Petsa sa Pilipinas (YYYY-MM-DD), kahit iba ang timezone ng device
export const manilaDate = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
