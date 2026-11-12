import { createClient } from '@supabase/supabase-js'

const url = (import.meta as any).env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key && !url.includes('TU-PROYECTO'))
export const supabase = configured ? createClient(url!, key!) : null
