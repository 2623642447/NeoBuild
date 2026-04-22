import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Username → fake email mapping for Supabase Auth (which requires email)
export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@neobuild.app`
}

export function emailToUsername(email: string): string {
  return email.replace('@neobuild.app', '')
}

// Sign up with username + password
export async function signUp(username: string, password: string) {
  const email = usernameToEmail(username)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  })
  if (error) throw error
  return data
}

// Sign in with username + password
export async function signIn(username: string, password: string) {
  const email = usernameToEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Get current session
export function getSession() {
  return supabase.auth.getSession()
}

// Get current user
export function getCurrentUser() {
  return supabase.auth.getUser()
}

// Listen to auth changes
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
