import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'COLE_SUA_URL_AQUI'
const supabaseKey = 'COLE_SUA_ANON_KEY_AQUI'

export const supabase = createClient(supabaseUrl, supabaseKey)

// deixar global (facilita)
window.supabase = supabase
