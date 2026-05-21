import type { Metadata, Viewport } from 'next'
import { Rubik } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const rubik = Rubik({ subsets: ['latin'] })

const specialGothic = localFont({
  src: '../public/fonts/SpecialGothicExpandedOne-Regular.ttf',
  variable: '--font-special-gothic',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
}

export const metadata: Metadata = {
  title: 'Synchrio - YouTube Audio Downloader',
  description: 'Self-hosted YouTube audio downloader with automatic metadata tagging',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Synchrio',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${rubik.className} ${specialGothic.variable}`}>
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
