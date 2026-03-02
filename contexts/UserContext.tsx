"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { getToken, removeToken, isAuthenticated } from "@/lib/auth"
import type { User } from "@/types"

// ── Public routes that do NOT need authentication ─────────────────────────────
// UserContext must NEVER redirect away from these
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/callback",
  "/auth/register",
]

function isPublicPath(pathname: string): boolean {
  // All /{slug}/* routes are public (store front + customer area)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
  // Dashboard requires auth — everything else is public
  if (pathname.startsWith("/dashboard")) return false
  // Root redirect page
  if (pathname === "/") return true
  // Any slug-based public store
  return true
}

interface UserContextValue {
  user: User | null
  loading: boolean
  setUser: (u: User | null) => void
  logout: () => void
  loadUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: () => {},
  loadUser: async () => {},
})

export function UserContextProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router   = useRouter()
  const pathname = usePathname()

  const loadUser = useCallback(async () => {
    const token = getToken()

    // No token — clear state, do NOT redirect (middleware/page handles that)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        // Token invalid/expired — clear it
        removeToken()
        setUser(null)
        // Only redirect to login if we're on a protected page
        if (!isPublicPath(pathname)) {
          router.replace("/auth/login")
        }
        return
      }

      const data = await res.json()
      setUser(data.user)
    } catch {
      // Network error — clear token silently
      removeToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [pathname, router])

  useEffect(() => {
    // Run once on mount — load user if token exists
    loadUser()
  }, []) // ← EMPTY DEPS — never re-runs automatically

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    router.push("/auth/login")
  }, [router])

  return (
    <UserContext.Provider value={{ user, loading, setUser, logout, loadUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}

export default UserContext