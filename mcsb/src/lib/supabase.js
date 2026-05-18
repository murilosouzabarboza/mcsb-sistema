import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vxegcikxmhienbncyju.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4ZWdjaXpreG1oaWVuYm5jeWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzAwMDksImV4cCI6MjA5NDYwNjAwOX0.YiEd_f5PgMFPYUgUdNmKgVogsItk9-jQ8UoczDI2CFU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
