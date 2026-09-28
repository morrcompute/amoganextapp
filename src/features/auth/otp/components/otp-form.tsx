'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { handleAuthRedirect } from '@/services/auth-redirect.service'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Please enter the 6-digit code.')
    .max(6, 'Please enter the 6-digit code.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const { auth } = useAuthStore()

  const emailParam = searchParams.get('email') || (typeof window !== 'undefined' ? sessionStorage.getItem('otp_email') : null)
  const phoneParam = searchParams.get('phone') || (typeof window !== 'undefined' ? sessionStorage.getItem('otp_phone') : null)
  const typeParam = searchParams.get('type') || 'sms'

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const supabase = createClient()
      const token = data.otp.trim()

      let authResult: any = null

      if (phoneParam) {
        authResult = await supabase.auth.verifyOtp({
          phone: phoneParam,
          token,
          type: 'sms',
        })
      } else if (emailParam) {
        // Try email OTP / magic link verification
        const verifyType = typeParam === 'signup' ? 'signup' : typeParam === 'recovery' ? 'recovery' : 'email'
        authResult = await supabase.auth.verifyOtp({
          email: emailParam,
          token,
          type: verifyType as any,
        })
      } else {
        throw new Error('No email or phone number found to verify OTP. Please try signing in again.')
      }

      if (authResult.error) {
        throw authResult.error
      }

      const user = authResult.data?.user
      const session = authResult.data?.session

      if (!user) {
        throw new Error('Verification succeeded but no user session was returned.')
      }

      const userObj = {
        id: user.id,
        accountNo: user.id,
        email: user.email || user.phone || 'user@amogads.com',
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split('@')[0] || user.phone || 'User',
        picture: user.user_metadata?.avatar_url || undefined,
        role: ['user'],
        exp: Date.now() + 24 * 60 * 60 * 1000,
      }

      auth.setUser(userObj)
      if (session?.access_token) {
        auth.setAccessToken(session.access_token)
      }

      // Sync profile row
      import('@/features/chattemplate/chat/repositories/profile-repository')
        .then(({ ensureProfileExists }) => ensureProfileExists(userObj))
        .catch(() => {})

      // Cleanup stored session OTP keys
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_email')
        sessionStorage.removeItem('otp_phone')
      }

      toast.success('Verification successful!')
      handleAuthRedirect(router, '/')
    } catch (err: any) {
      console.error('[OtpForm] Verification error:', err)
      toast.error(err.message || 'Invalid or expired OTP code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (isResending) return
    setIsResending(true)

    try {
      const supabase = createClient()
      if (phoneParam) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneParam,
          options: { channel: 'sms' },
        })
        if (error) throw error
        toast.success(`New SMS code sent to ${phoneParam}`)
      } else if (emailParam) {
        const { error } = await supabase.auth.signInWithOtp({
          email: emailParam,
        })
        if (error) throw error
        toast.success(`New verification code sent to ${emailParam}`)
      } else {
        toast.error('No email or phone number found to resend code.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification code.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <div className='text-xs text-muted-foreground text-center'>
          {phoneParam && `Sent to ${phoneParam}`}
          {emailParam && !phoneParam && `Sent to ${emailParam}`}
        </div>

        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>One-Time Password</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Verify Code
        </Button>

        <div className='text-center'>
          <button
            type='button'
            onClick={handleResend}
            disabled={isResending}
            className='text-xs text-primary underline underline-offset-4 hover:opacity-80 disabled:opacity-50 cursor-pointer'
          >
            {isResending ? 'Resending code...' : "Didn't receive code? Resend"}
          </button>
        </div>
      </form>
    </Form>
  )
}
