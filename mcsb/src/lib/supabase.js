import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vxegcizkxmhienbncyju.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_lTJueXRSO34YPSu1cBZ4kg_FAq8S9GH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
