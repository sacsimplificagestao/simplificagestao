import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://jtcwrrcozunjskuwswmq.supabase.co'
const supabaseKey = 'sb_publishable_m4XaI4R9Ixr6Kuka4Wz9Pw_jnsavoZU'

export const supabase = createClient(supabaseUrl, supabaseKey)

// deixa global
window.supabase = supabase
