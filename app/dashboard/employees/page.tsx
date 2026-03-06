"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Users, Plus, Pencil, X, AlertCircle, Calendar, Check, Loader2 } from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

interface Employee {
  id:                string
  name:              string
  email:             string
  avatarUrl:         string | null
  active:            boolean
  calendarConnected: boolean
  createdAt:         string
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase()
}

function Field({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "#71717A", letterSpacing: "0.03em" }}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 40, padding: "0 12px", borderRadius: 10,
          border: "1px solid #2A2A2A", backgroundColor: "#161616",
          color: "#fff", fontSize: 14, outline: "none",
          fontFamily: "inherit", boxSizing: "border-box", width: "100%",
        }}
      />
    </div>
  )
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      </div>
    }>
      <EmployeesContent />
    </Suspense>
  )
}

function EmployeesContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [employees,     setEmployees]     = useState<Employee[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState<string | null>(null)
  const [showModal,     setShowModal]     = useState<"create" | "edit" | null>(null)
  const [selected,      setSelected]      = useState<Employee | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [formError,     setFormError]     = useState<string | null>(null)
  const [hoveredId,     setHoveredId]     = useState<string | null>(null)
  const [formName,      setFormName]      = useState("")
  const [formEmail,     setFormEmail]     = useState("")

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ employees: Employee[] }>("/employees")
      setEmployees(res.employees ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar funcionários.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  // ── Handle ?calendar=success|error from OAuth callback redirect ───────────
  useEffect(() => {
    const cal = searchParams.get("calendar")
    if (cal === "success") {
      setSuccess("Google Calendar conectado com sucesso!")
      setTimeout(() => setSuccess(null), 5000)
      fetchEmployees()
      router.replace("/dashboard/employees")
    } else if (cal === "error") {
      setError("Erro ao conectar Google Calendar. Tente novamente.")
      router.replace("/dashboard/employees")
    }
  }, [searchParams, router, fetchEmployees])

  function openCreate() {
    setFormName(""); setFormEmail(""); setFormError(null)
    setSelected(null); setShowModal("create")
  }

  function openEdit(emp: Employee) {
    setFormName(emp.name); setFormEmail(emp.email); setFormError(null)
    setSelected(emp); setShowModal("edit")
  }

  function closeModal() { setShowModal(null); setSelected(null); setFormError(null) }

  async function handleSave() {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Nome e e-mail são obrigatórios."); return
    }
    setActionLoading("save")
    setFormError(null)
    try {
      if (showModal === "create") {
        await apiPost("/employees", { name: formName.trim(), email: formEmail.trim() })
      } else if (selected) {
        await apiPut(`/employees/${selected.id}`, { name: formName.trim(), email: formEmail.trim() })
      }
      closeModal()
      await fetchEmployees()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeactivate(id: string) {
    setActionLoading(id)
    try {
      await apiDelete(`/employees/${id}`)
      await fetchEmployees()
    } catch {
      // silencioso
    } finally {
      setActionLoading(null)
    }
  }

  // ── Google Calendar per-employee ──────────────────────────────────────────
  function handleCalendarConnect(employeeId: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("forbion_token") : null
    if (!token) return
    window.location.href = `${API}/api/employees/${employeeId}/calendar/connect?token=${token}`
  }

  async function handleCalendarDisconnect(employeeId: string) {
    setActionLoading(`cal-${employeeId}`)
    try {
      await apiDelete(`/employees/${employeeId}/calendar`)
      await fetchEmployees()
      setSuccess("Google Calendar desconectado.")
      setTimeout(() => setSuccess(null), 4000)
    } catch {
      setError("Erro ao desconectar Google Calendar.")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinEmp { to{transform:rotate(360deg)} }
        @keyframes skelEmp { 0%,100%{opacity:.4} 50%{opacity:.8} }
      `}</style>

      <div style={{ animation: "fadeIn 0.25s ease" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>Equipe</h1>
            <p style={{ fontSize: 13, color: "#52525B", margin: "4px 0 0" }}>Gerencie os funcionários da sua loja</p>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "linear-gradient(135deg, #0066FF, #7C3AED)",
              border: "none", borderRadius: 12, padding: "10px 20px",
              color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={15} /> Adicionar funcionário
          </button>
        </div>

        {/* ── Success toast ── */}
        {success && (
          <div style={{ backgroundColor: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "11px 16px", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
            <Check size={14} color="#10B981" />
            <span style={{ fontSize: 13, color: "#10B981" }}>{success}</span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "11px 16px", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 140, backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 16, animation: `skelEmp 1.5s ease ${i * 0.1}s infinite` }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && employees.length === 0 && (
          <div style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 20, padding: "64px 20px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#161616", border: "1px solid #1F1F1F", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Users size={26} color="#2A2A2A" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>Nenhum funcionário cadastrado ainda</p>
            <p style={{ fontSize: 13, color: "#52525B", marginTop: 6 }}>Adicione sua equipe para que clientes possam escolher o profissional</p>
            <button
              onClick={openCreate}
              style={{ marginTop: 20, padding: "10px 22px", background: "linear-gradient(135deg, #0066FF, #7C3AED)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Adicionar primeiro funcionário
            </button>
          </div>
        )}

        {/* ── Grid de cards ── */}
        {!loading && employees.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {employees.map(emp => {
              const isHov = hoveredId === emp.id
              return (
                <div
                  key={emp.id}
                  onMouseEnter={() => setHoveredId(emp.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: "#111111",
                    border: `1px solid ${isHov ? "#2A2A2A" : "#1F1F1F"}`,
                    borderRadius: 16, padding: 20,
                    transition: "border-color 0.15s",
                  }}
                >
                  {/* ── Avatar + info + badges ── */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #0066FF, #7C3AED)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, color: "#fff",
                    }}>
                      {getInitials(emp.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name}</p>
                      <p style={{ fontSize: 12, color: "#52525B", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.email}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#10B981", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 99, padding: "3px 8px" }}>
                        Ativo
                      </span>
                      {/* ── Calendar status badge ── */}
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color:           emp.calendarConnected ? "#3B82F6" : "#52525B",
                        backgroundColor: emp.calendarConnected ? "rgba(59,130,246,0.1)" : "rgba(82,82,91,0.1)",
                        border:          emp.calendarConnected ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(82,82,91,0.2)",
                        borderRadius: 99, padding: "3px 8px",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Calendar size={9} />
                        {emp.calendarConnected ? "Agenda vinculada" : "Sem agenda"}
                      </span>
                    </div>
                  </div>

                  {/* ── Action buttons ── */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => openEdit(emp)}
                      style={{ flex: 1, minWidth: 70, height: 34, borderRadius: 8, border: "1px solid #2A2A2A", backgroundColor: "transparent", color: "#A1A1AA", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}
                    >
                      <Pencil size={12} /> Editar
                    </button>

                    {/* ── Google Calendar connect/disconnect ── */}
                    {emp.calendarConnected ? (
                      <button
                        onClick={() => handleCalendarDisconnect(emp.id)}
                        disabled={actionLoading === `cal-${emp.id}`}
                        style={{
                          flex: 1, minWidth: 90, height: 34, borderRadius: 8,
                          border: "1px solid rgba(59,130,246,0.2)", backgroundColor: "transparent",
                          color: "#3B82F6", fontSize: 12, fontWeight: 600,
                          cursor: actionLoading === `cal-${emp.id}` ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          opacity: actionLoading === `cal-${emp.id}` ? 0.5 : 1,
                          fontFamily: "inherit",
                        }}
                      >
                        {actionLoading === `cal-${emp.id}`
                          ? <Loader2 size={12} style={{ animation: "spinEmp 0.7s linear infinite" }} />
                          : <Calendar size={12} />}
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCalendarConnect(emp.id)}
                        style={{
                          flex: 1, minWidth: 90, height: 34, borderRadius: 8,
                          border: "1px solid rgba(16,185,129,0.2)", backgroundColor: "transparent",
                          color: "#10B981", fontSize: 12, fontWeight: 600,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          fontFamily: "inherit",
                        }}
                      >
                        <Calendar size={12} /> Vincular agenda
                      </button>
                    )}

                    <button
                      onClick={() => handleDeactivate(emp.id)}
                      disabled={actionLoading === emp.id}
                      style={{ flex: 1, minWidth: 70, height: 34, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "transparent", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: actionLoading === emp.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: actionLoading === emp.id ? 0.5 : 1, fontFamily: "inherit" }}
                    >
                      {actionLoading === emp.id
                        ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.3)", borderTopColor: "#EF4444", animation: "spinEmp 0.7s linear infinite", display: "inline-block" }} />
                        : <X size={12} />}
                      Desativar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal criar/editar ── */}
      {showModal && (
        <>
          <div onClick={closeModal} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 100 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            backgroundColor: "#111111", border: "1px solid #1F1F1F", borderRadius: 20,
            width: 440, padding: 28, zIndex: 101,
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                {showModal === "create" ? "Novo funcionário" : "Editar funcionário"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#52525B", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nome"   value={formName}  onChange={setFormName}  placeholder="Ex: João Silva"     required />
              <Field label="E-mail" value={formEmail} onChange={setFormEmail} placeholder="joao@exemplo.com" required type="email" />
            </div>

            {formError && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <AlertCircle size={13} color="#EF4444" />
                <span style={{ fontSize: 12, color: "#EF4444" }}>{formError}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #2A2A2A", backgroundColor: "transparent", color: "#A1A1AA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={actionLoading === "save"}
                style={{ flex: 2, height: 44, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #0066FF, #7C3AED)", color: "white", fontSize: 14, fontWeight: 600, cursor: actionLoading === "save" ? "not-allowed" : "pointer", opacity: actionLoading === "save" ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
              >
                {actionLoading === "save"
                  ? <><span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spinEmp 0.7s linear infinite", display: "inline-block" }} /> Salvando...</>
                  : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}