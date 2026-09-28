import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { sleep, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { handleAuthRedirect } from '@/services/auth-redirect.service'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password.')
    .min(7, 'Password must be at least 7 characters long.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { auth } = useAuthStore()

  // Persist the intended redirect in sessionStorage as a reliable fallback
  useEffect(() => {
    if (typeof window !== 'undefined' && redirectTo && redirectTo !== '/') {
      sessionStorage.setItem('post_login_redirect', redirectTo)
    }
  }, [redirectTo])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        throw error
      }

      const user = authData.user
      if (!user) throw new Error('No user returned from sign in.')

      const userObj = {
        id: user.id,
        accountNo: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.email!.split('@')[0],
        picture: user.user_metadata?.avatar_url || undefined,
        role: ['user'],
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      }

      auth.setUser(userObj)
      auth.setAccessToken(authData.session?.access_token || 'supabase-session')

      // Ensure profile exists in public.profiles table
      import('@/features/chattemplate/chat/repositories/profile-repository')
        .then(({ ensureProfileExists }) => ensureProfileExists(userObj))
        .catch(() => {})

      // Redirect: use prop first, then sessionStorage fallback, then home
      const storedRedirect =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('post_login_redirect')
          : null
      const destination = redirectTo || storedRedirect || undefined
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('post_login_redirect')
      }
      toast.success(`Welcome back, ${userObj.name || user.email}!`)
      handleAuthRedirect(router, destination)
    } catch (err: any) {
      console.error('[SignIn] Error:', err)
      let msg = err?.message || 'Sign in failed. Please check your credentials.'
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('enotfound')) {
        msg = 'Unable to connect to Supabase. Please verify your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
      }
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                href='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}