import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

const PROFILE_COLUMNS = [
  'id',
  'email',
  'full_name',
  'role',
  'username',
  'can_access_personalworkschedule',
  'can_access_workschedule',
  'can_access_bookingportalmanager',
].join(', ')

/** Look up the shared profile by username (before Supabase Auth sign-in). */
export async function findProfileByUsername(
  username: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', username.trim())
    .maybeSingle()

  if (error) throw error
  return (data as UserProfile | null) ?? null
}

/**
 * Sign in with username + password.
 * The username is resolved to an email from `profiles`, then Supabase Auth
 * verifies the password. Access to this app is checked before returning.
 */
export async function loginWithUsername(
  username: string,
  password: string,
): Promise<UserProfile> {
  const profile = await findProfileByUsername(username)
  if (!profile) throw new Error('ไม่พบชื่อผู้ใช้นี้ในระบบ')

  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error) {
    if (error.message === 'Invalid login credentials') {
      throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    }
    throw error
  }

  if (!data.user) throw new Error('ไม่สามารถเข้าสู่ระบบได้')

  if (!profile.can_access_bookingportalmanager) {
    await supabase.auth.signOut().catch(() => undefined)
    throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบจัดการการจอง')
  }

  return profile
}

/** Restore the current session and re-check the app permission from DB. */
export async function getSessionProfile(): Promise<UserProfile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', session.user.id)
    .maybeSingle()

  if (error) throw error
  return (data as UserProfile | null) ?? null
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
