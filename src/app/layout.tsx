import type { Metadata } from 'next'
import { Inter, Space_Mono } from 'next/font/google'
import './globals.css'

// Clean neutral grotesque for everything (matches the Uniswap reference); a mono
// only for hex addresses / hashes.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono-ui',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VeilPay — Private Payroll on Starknet',
  description: 'Pay a payroll privately on Starknet using STRK20. Built by OpenDagri.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
