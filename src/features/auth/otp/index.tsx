import { Suspense } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

export function Otp() {
  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-base tracking-tight'>
            Two-factor Authentication
          </CardTitle>
          <CardDescription>
            Please enter the authentication code. <br /> We have sent the
            authentication code to your email or mobile device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className='py-6 text-center text-sm text-muted-foreground'>Loading verification form...</div>}>
            <OtpForm />
          </Suspense>
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            Haven't received it?{' '}
            <Link
              href='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              Resend a new code.
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
