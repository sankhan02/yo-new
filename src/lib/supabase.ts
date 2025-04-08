import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export async function testConnection() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1)
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Supabase connection test failed:', error)
    return { success: false, error }
  }
} 