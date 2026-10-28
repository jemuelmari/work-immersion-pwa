import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qiabbgqqgiukyvntisde.supabase.co'
const supabaseKey = 'sb_publishable_hf6mVyelO5GKrL9L6YYb9A_4yWgf1dF'

export const supabase = createClient(supabaseUrl, supabaseKey)
