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
import { ACCOUNT_LOCK_EVENT } from "@/lib/api"
import type { User, PlanStatus, AccountLock } from "@/types"

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
  planStatus: PlanStatus | null
  accountLock: AccountLock | null
  loading: boolean
  setUser: (u: User | null) => void
  setAccountLock: (lock: AccountLock | null) => void
  logout: () => void
  loadUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  planStatus: null,
  accountLock: null,
  loading: true,
  setUser: () => {},
  setAccountLock: () => {},
  logout: () => {},
  loadUser: async () => {},
})

export function UserContextProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [planStatus,  setPlanStatus]  = useState<PlanStatus | null>(null)
  const [accountLock, setAccountLock] = useState<AccountLock | null>(null)
  const [loading,     setLoading]     = useState(true)
  const router   = useRouter()
  const pathname = usePathname()

  const loadUser = useCallback(async () => {
    const token = getToken()

    // No token — clear state, do NOT redirect (middleware/page handles that)
    if (!token) {
      setUser(null)
      setAccountLock(null)
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
        setAccountLock(null)
        // Only redirect to login if we're on a protected page
        if (!isPublicPath(pathname)) {
          router.replace("/auth/login")
        }
        return
      }

      const data = await res.json()
      setUser(data.user)

      const ps: PlanStatus = data.planStatus ?? null
      setPlanStatus(ps)

      // ── Derive accountLock from planStatus ────────────────────────────
      if (ps?.isExpired) {
        setAccountLock({
          code:          ps.lockCode === "NO_PLAN"
                           ? "NO_PLAN"
                           : ps.lockCode === "BUSINESS_INACTIVE"
                             ? "BUSINESS_INACTIVE"
                             : "PLAN_EXPIRED",
          plan:          ps.plan,
          isTrial:       ps.isTrial,
          expiredAt:     ps.planExpiresAt,
          scheduleCount: ps.scheduleCount ?? 0,
          customerCount: ps.customerCount ?? 0,
        })
      } else {
        setAccountLock(null)
      }
    } catch {
      // Network error — clear token silently
      removeToken()
      setUser(null)
      setPlanStatus(null)
      setAccountLock(null)
    } finally {
      setLoading(false)
    }
  }, [pathname, router])

  useEffect(() => {
    // Run once on mount — load user if token exists
    loadUser()

    // ── Listen for account lock events from the API interceptor ─────────
    function handleAccountLockEvent(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail?.code) {
        setAccountLock({
          code:          detail.code,
          plan:          detail.plan ?? "BASIC",
          isTrial:       detail.isTrial ?? false,
          expiredAt:     detail.expiredAt ?? null,
          scheduleCount: detail.scheduleCount ?? 0,
          customerCount: detail.customerCount ?? 0,
        })
      }
    }
    window.addEventListener(ACCOUNT_LOCK_EVENT, handleAccountLockEvent)
    return () => window.removeEventListener(ACCOUNT_LOCK_EVENT, handleAccountLockEvent)
  }, []) // ← EMPTY DEPS — never re-runs automatically

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    setPlanStatus(null)
    setAccountLock(null)
    router.push("/auth/login")
  }, [router])

  return (
    <UserContext.Provider value={{
      user, planStatus, accountLock, loading,
      setUser, setAccountLock, logout, loadUser,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}

export default UserContext