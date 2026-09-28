import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

/**
 * Converts any string (like a Google numeric ID or email) into a deterministic, valid UUID string.
 * Leaves string untouched if it is already a valid UUID v4 format.
 */
export function stringToUuid(str: string): string {
  if (!str) return crypto.randomUUID()
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRegex.test(str)) {
    return str
  }
  const hash = crypto.createHash('md5').update(str).digest('hex')
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
      checks: ['none'],
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || 'secret_next_auth_shadcn_admin_key_2026_super_secure',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }, 
  callbacks: {
    async redirect({ url, baseUrl }) {
      try {
        const { cookies } = await import('next/headers')
        const cookieStore = await cookies()
        const isMobileAuth = cookieStore.get('mobile_auth')?.value === 'true' || url.includes('is_mobile=true')
        if (isMobileAuth) {
          console.log('📱 [NextAuth Redirect Callback] Mobile auth detected. Redirecting to /auth/callback?is_mobile=true')
          return `${baseUrl}/auth/callback?is_mobile=true&next=/`
        }
      } catch (err) {
        console.error('❌ [NextAuth Redirect Callback] Error inspecting cookies:', err)
      }

      if (url.includes('/auth/callback')) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user }) {
      if (!user.email) return false

      try {
        if (SUPABASE_URL && SUPABASE_KEY) {
          const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY)
          const fallbackUuid = stringToUuid(user.id || user.email)

          // Check if profile exists by email first (to preserve existing UUID) or by ID
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, auth_user_id')
            .eq('email', user.email.toLowerCase())
            .maybeSingle()

          const profileId = existingProfile?.id || fallbackUuid

          const profileData: any = {
            id: profileId,
            name: user.name || user.email.split('@')[0],
            email: user.email.toLowerCase(),
            avatar: user.image || null,
            updated_at: new Date().toISOString(),
          }

          profileData.auth_user_id = existingProfile?.auth_user_id || profileId

          if (existingProfile) {
            await supabase
              .from('profiles')
              .update(profileData)
              .eq('id', existingProfile.id)
          } else {
            await supabase
              .from('profiles')
              .insert(profileData)
          }

          // Attach canonical valid UUID to user object
          user.id = profileId
        }
      } catch (err) {
        console.error('[NextAuth] Error syncing user to profiles table:', err)
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = stringToUuid(user.id || user.email!)
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      } else if (token.sub && !stringToUuid(token.sub)) {
        token.id = stringToUuid(token.sub)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const canonicalId = stringToUuid((token.id || token.sub || session.user.email) as string)
        ;(session.user as any).id = canonicalId
        ;(session.user as any).picture = token.picture || token.image
      }
      return session
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
}
