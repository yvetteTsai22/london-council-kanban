import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Sidebar } from '@/components/sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'London Council Issue Tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body suppressHydrationWarning>
        <div className="app-shell" suppressHydrationWarning>
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  )
}
