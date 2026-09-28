'use client'

import { useState, useEffect, useRef } from 'react'
import { AxiosError } from 'axios'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/context/theme-provider'
import { ColorThemeProvider } from '@/context/color-theme-provider'
import { FontProvider } from '@/context/font-provider'
import { DirectionProvider } from '@/context/direction-provider'
import { SearchProvider } from '@/context/search-provider'
import { NavigationProgress } from '@/components/navigation-progress'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/client'
import { ensureProfileExists } from '@/features/chattemplate/chat/repositories/profile-repository'
import { handleAuthRedirect } from '@/services/auth-redirect.service'
import { initializeCapacitorHandlers } from '@/lib/capacitor-init'
import { OfflineScreen, useIsOffline } from '@/components/offline-screen'

function QueryProviderWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (process.env.NODE_ENV === 'development') console.log({ failureCount, error })
              if (failureCount >= 0 && process.env.NODE_ENV === 'development') return false
              if (failureCount > 3 && process.env.NODE_ENV === 'production') return false
              return !(
                error instanceof AxiosError &&
                [401, 403].includes(error.response?.status ?? 0)
              )
            },
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            staleTime: 60 * 1000, // 60s - reduces refetch churn during navigation
          },
          mutations: {
            onError: (error) => {
              handleServerError(error)
              if (error instanceof AxiosError) {
                if (error.response?.status === 304) {
                  toast.error('Content not modified!')
                }
              }
            },
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof AxiosError) {
              if (error.response?.status === 401) {
                toast.error('Session expired!')
                useAuthStore.getState().auth.reset()
                router.push('/sign-in')
              }
              if (error.response?.status === 500) {
                toast.error('Internal Server Error!')
                if (process.env.NODE_ENV === 'production') {
                  router.push('/500-error')
                }
              }
            }
          },
        }),
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

import { SessionProvider, useSession } from 'next-auth/react'
import { stringToUuid } from '@/lib/auth'

function NextAuthSync() {
  const { data: session, status } = useSession()
  const { auth } = useAuthStore()

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return

    const user = session.user as any
    const userEmail = (user.email || '').toLowerCase()
    const fallbackId = stringToUuid(user.id || user.email)

    // Always re-sync — never skip because the account may have switched.
    // The old guard `if (auth.user?.email === userEmail && auth.accessToken) return`
    // caused the previous account to bleed through after an account switch.

    // Resolve the actual profile UUID from Supabase by email
    // This ensures accountNo matches owner_user_id / user_id stored in all DB rows
    import('@/lib/supabase/client')
      .then(({ createClient }) => {
        const supabase = createClient()
        return supabase
          .from('profiles')
          .select('id')
          .eq('email', userEmail)
          .maybeSingle()
      })
      .then(({ data: profileRow }: any) => {
        const resolvedId = profileRow?.id || fallbackId
        const userObj = {
          id: resolvedId,
          accountNo: resolvedId,
          email: userEmail,
          name: user.name || userEmail.split('@')[0],
          picture: user.picture || user.image || undefined,
          role: ['user'] as string[],
          exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
        }
        auth.setUser(userObj)
        auth.setAccessToken(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'next-auth-session')
        ensureProfileExists(userObj).catch((err: any) => {
          console.error('Failed to sync profile on NextAuth session:', err)
        })
      })
      .catch((err: any) => {
        console.error('[NextAuthSync] Profile resolution error, using fallback UUID:', err)
        const userObj = {
          id: fallbackId,
          accountNo: fallbackId,
          email: userEmail,
          name: user.name || userEmail.split('@')[0],
          picture: user.picture || user.image || undefined,
          role: ['user'] as string[],
          exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
        }
        auth.setUser(userObj)
        auth.setAccessToken(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'next-auth-session')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status])

  return null
}


export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { auth } = useAuthStore()
  const oauthRedirectHandled = useRef(false)
  const isOffline = useIsOffline()

  useEffect(() => {
    initializeCapacitorHandlers(router)
    import('@/services/push-notification.service').then(({ requestNativeAppPermissions }) => {
      requestNativeAppPermissions()
    }).catch(() => {})
  }, [router])

  useEffect(() => {
    if (auth?.user?.id) {
      import('@/services/push-notification.service').then(({ initPushNotifications }) => {
        initPushNotifications(auth.user!.id)
      }).catch((err) => {
        console.error('Failed to load push notification service:', err)
      })
    }
  }, [auth?.user?.id])

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log(`[DEBUG client] onAuthStateChange event: ${event}. Session user ID: ${session?.user?.id || 'none'}`)
      if (session) {
        const user = session.user

        const searchParams = new URLSearchParams(window.location.search)
        const targetRedirect = searchParams.get('redirect')
        console.log('[DEBUG client] Determined targetRedirect from search params:', targetRedirect)

        if (!auth.user || auth.user.accountNo !== user.id) {
          console.log('[DEBUG client] Setting user object in store and syncing profile...')
          const userObj = {
            id: user.id,
            accountNo: user.id,
            email: user.email!,
            name: user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.email!.split('@')[0],
            picture: user.user_metadata?.avatar_url || undefined,
            role: ['user'],
            exp: Date.now() + 24 * 60 * 60 * 1000,
          }
          auth.setUser(userObj)
          auth.setAccessToken(session.access_token)
          
          ensureProfileExists(userObj).catch(err => {
            console.error('Failed to sync profile on auth state change:', err)
          })
        }

        if (authAction === 'signin') {
          if (oauthRedirectHandled.current) {
            return
          }
          oauthRedirectHandled.current = true

          let destination = targetRedirect
          if (!destination || destination === '/') {
            const fallback = typeof window !== 'undefined' ? sessionStorage.getItem('post_login_redirect') : null
            destination = fallback || '/'
          }
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('post_login_redirect')
          }
          handleAuthRedirect(router, destination)
          return
        } else {
          oauthRedirectHandled.current = false
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [auth, router])

  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      let errorMessage = ''
      if ('message' in event) {
        errorMessage = event.message
      } else if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
        errorMessage = (event.reason as { message: string }).message
      }

      if (
        errorMessage.includes('ChunkLoadError') ||
        errorMessage.includes('Loading chunk') ||
        /Loading chunk [\d]+ failed/.test(errorMessage)
      ) {
        console.warn('ChunkLoadError detected, reloading page...', errorMessage)
        const lastReload = sessionStorage.getItem('chunk_load_last_reload')
        const now = Date.now()

        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('chunk_load_last_reload', now.toString())
          window.location.reload()
        }
      }
    }

    window.addEventListener('error', handleChunkError as EventListener, true)
    window.addEventListener('unhandledrejection', handleChunkError as EventListener, true)

    return () => {
      window.removeEventListener('error', handleChunkError as EventListener, true)
      window.removeEventListener('unhandledrejection', handleChunkError as EventListener, true)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          registration.update()
        })
        .catch((err) => console.error('[SW] registration failed:', err))
    }
  }, [])

  return (
    <SessionProvider>
      <NextAuthSync />
      {isOffline && <OfflineScreen />}
      <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}>
        <QueryProviderWrapper>
          <ThemeProvider>
            <ColorThemeProvider>
              <FontProvider>
                <DirectionProvider>
                  <SearchProvider>
                    <NavigationProgress />
                    {children}
                    <Toaster duration={5000} />
                  </SearchProvider>
                </DirectionProvider>
              </FontProvider>
            </ColorThemeProvider>
          </ThemeProvider>
        </QueryProviderWrapper>
      </GoogleOAuthProvider>
    </SessionProvider>
  )
}
