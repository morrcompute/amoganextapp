'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'
import { MobileAuthForm } from '../components/mobile-auth-form'

export function SignUp() {
  const searchParams = useSearchParams()
  const redirect = searchParams?.get('redirect') ?? undefined

  return (
    <AuthLayout>
      <Card className='w-full max-w-md gap-3 sm:gap-4 shadow-lg border-border/80 bg-card/95 backdrop-blur-sm overflow-hidden rounded-xl'>
        <CardHeader className='p-4 sm:p-6 pb-2 sm:pb-3 space-y-1.5'>
          <CardTitle className='text-base sm:text-lg font-bold tracking-tight'>
            Create an account
          </CardTitle>
          <CardDescription className='text-xs sm:text-sm text-muted-foreground'>
            Enter your details below to create an account. <br />
            Already have an account?{' '}
            <Link
              href='/sign-in'
              className='underline underline-offset-4 hover:text-primary font-medium text-foreground'
            >
              Sign In
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className='p-4 sm:p-6 pt-0'>
          <Tabs defaultValue='mobile' className='w-full'>
            <TabsList className='grid w-full grid-cols-2 h-auto border-b border-border bg-transparent p-0 shadow-none rounded-none mb-4'>
              <TabsTrigger
                value='mobile'
                className='h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pt-0 pb-2.5 shadow-none hover:bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors'
              >
                Mobile
              </TabsTrigger>
              <TabsTrigger
                value='login'
                className='h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pt-0 pb-2.5 shadow-none hover:bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors'
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            <TabsContent value='mobile' className='mt-0 focus-visible:outline-none w-full'>
              <MobileAuthForm redirectTo={redirect} />
            </TabsContent>
            <TabsContent value='login' className='mt-0 focus-visible:outline-none w-full'>
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className='p-4 sm:p-6 pt-0 border-t border-border/40 bg-muted/20'>
          <p className='w-full text-center text-[11px] sm:text-xs text-muted-foreground leading-normal pt-3'>
            By creating an account, you agree to our{' '}
            <a
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
