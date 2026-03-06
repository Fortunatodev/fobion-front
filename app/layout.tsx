import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import { UserContextProvider } from "@/contexts/UserContext"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Forbion | Gestão de Estéticas",
  description: "Plataforma completa para gestão da sua estética automotiva",
  icons: {
    icon: "/logo.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0A0A0A" />
      </head>
      <body suppressHydrationWarning>
        <UserContextProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
          />
        </UserContextProvider>
      </body>
    </html>
  )
}