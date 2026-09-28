'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { useAuthStore } from '@/stores/auth-store'
import { createClient } from '@/lib/client'

const formSchema = z
  .object({
    email: z.string().email('Please enter a valid email.'),
    password: z
      .string()
      .min(1, 'Please enter your password.')
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams ? searchParams.get('email') || '' : ''
  const { setUser, setAccessToken } = useAuthStore((state) => state.auth)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: emailParam,
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (emailParam) {
      form.setValue('email', emailParam)
    }
  }, [emailParam, form])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      // Sign up the user
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.email.split('@')[0],
          }
        }
      })

      if (error) {
        // Handle "User already registered" error
        if (error.message?.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.')
          router.push(`/sign-in?email=${encodeURIComponent(data.email)}`)
          return
        }
        throw error
      }

      const user = authData.user
      if (!user) throw new Error('Registration failed.')

      // ✅ The trigger will handle profile creation automatically
      // But we'll wait a moment to ensure it's created
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check if user needs to confirm email
      if (!authData.session) {
        toast.info('Verification link sent! Please check your email.')
        router.replace('/auth/sign-in')
        return
      }

      // ✅ FIXED: Set user data in store with id field
      setUser({
        id: user.id,  // ✅ ADD THIS - the auth UUID
        accountNo: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email!.split('@')[0],
        picture: user.user_metadata?.avatar_url || undefined,
        role: ['user'],
        exp: Date.now() + 24 * 60 * 60 * 1000,
      })

      setAccessToken(authData.session.access_token)

      router.replace('/')
      toast.success(`Account created for ${data.email}!`)
    } catch (err: any) {
      console.error('Signup error:', err)
      toast.error(err.message || 'Registration failed. Please try again.')
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
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <UserPlus />}
          Create Account
        </Button>
      </form>
    </Form>
  )
}