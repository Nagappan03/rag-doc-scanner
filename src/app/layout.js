import './globals.css'
import NextAuthSessionProvider from '@/components/SessionProvider'

export const metadata = {
  title: 'RAG Doc QA',
  description: 'Chat with your documents using AI',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  )
}