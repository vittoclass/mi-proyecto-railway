import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'   // 👈 agregado

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <NavBar />                         {/* 👈 agregado */}
        <div className="max-w-5xl mx-auto p-6">
          {children}                       {/* 👈 tu contenido como siempre */}
        </div>
      </body>
    </html>
  )
}
