import { createClient } from '@supabase/supabase-js'

// Naka-set sa Vercel → Settings → Environment Variables.
// Ang fallback ay ang kasalukuyang project (public/publishable key lang ito, ligtas makita).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qiabbgqqgiukyvntisde.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hf6mVyelO5GKrL9L6YYb9A_4yWgf1dF'

export const supabase = createClient(supabaseUrl, supabaseKey)
