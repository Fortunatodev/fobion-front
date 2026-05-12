"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Percent, AlertCircle, CheckCircle2, X } from "lucide-react"
import { apiGet, apiPost, apiDelete } from "@/lib/api"

interface Service {
  id: string
  name: string
  price: number
  commissionPercent: number | null
}

interface CommissionRule {
  id: string
  employeeId: string | null
  serviceId: string
  commissionPercent: number
  isActive: boolean
  service: { id: string; name: string; price: number; commissionPercent: number | null }
}

interface Employee {
  id: string
  name: string
  email: string
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function EmployeeRepassesPage() {
  const { id: employeeId } = useParams() as { id: string }
  const router = useRouter()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [rules,    setRules]    = useState<CommissionRule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal de adicionar exceção
  const [showAdd, setShowAdd] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [formPercent, setFormPercent] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, svcRes, rulesRes] = await Promise.all([
        apiGet<{ employees: Employee[] }>("/employees"),
        apiGet<{ services: Service[] }>("/services"),
        apiGet<{ rules: CommissionRule[] }>(`/commissions/rules?employeeId=${employeeId}`),
      ])
      const emp = empRes.employees.find(e => e.id === employeeId)
      if (!emp) {
        setError("Funcionário não encontrado.")
        return
      }
      setEmployee(emp)
      setServices(svcRes.services || [])
      setRules(rulesRes.rules || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.")
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { fetchData() }, [fetchData])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleAdd() {
    if (!selectedServiceId) {
      setFormError("Selecione um serviço.")
      return
    }
    const pct = Number(formPercent)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setFormError("Repasse deve estar entre 0 e 100.")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await apiPost("/commissions/rules", {
        employeeId,
        serviceId: selectedServiceId,
        commissionPercent: Math.round(pct),
      })
      await fetchData()
      setShowAdd(false)
      setSelectedServiceId("")
      setFormPercent("")
      showSuccess("Exceção salva!")
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("Remover esta exceção? O funcionário voltará a receber o repasse padrão do serviço.")) return
    try {
      await apiDelete(`/commissions/rules/${ruleId}`)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      showSuccess("Exceção removida.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover.")
    }
  }

  // Serviços disponíveis pra criar nova exceção (que ainda não têm rule)
  const availableServices = services.filter(s => !rules.some(r => r.serviceId === s.id))

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push("/dashboard/employees")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#71717A", fontSize: 13, cursor: "pointer", marginBottom: 12, padding: 0, fontFamily: "inherit" }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#FAFAFA", margin: 0, letterSpacing: "-0.02em" }}>
          Repasses · {employee?.name}
        </h1>
        <p style={{ fontSize: 13, color: "#A1A1AA", marginTop: 6, lineHeight: 1.6 }}>
          Exceções específicas deste funcionário. Quando não há exceção pra um serviço,
          ele recebe o <strong style={{ color: "#FAFAFA" }}>repasse padrão</strong> definido em cada serviço.
        </p>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span style={{ fontSize: 13, color: "#10B981" }}>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
        </div>
      )}

      {/* Default geral (informativo) */}
      <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid #1F1F1F", borderRadius: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
          Repasse padrão por serviço (configurável em cada serviço)
        </p>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {services.length === 0 ? (
            <p style={{ fontSize: 13, color: "#52525B" }}>Nenhum serviço cadastrado.</p>
          ) : services.map(s => {
            const hasException = rules.some(r => r.serviceId === s.id)
            return (
              <div key={s.id} style={{ padding: "8px 10px", background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: hasException ? "#52525B" : "#A1A1AA", textDecoration: hasException ? "line-through" : "none" }}>
                  {s.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.commissionPercent != null ? "#A78BFA" : "#52525B" }}>
                  {s.commissionPercent != null ? `${s.commissionPercent}%` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Exceções (rules deste funcionário) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#FAFAFA", margin: 0, letterSpacing: "-0.01em" }}>
          Exceções deste funcionário ({rules.length})
        </h2>
        {availableServices.length > 0 && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, background: "linear-gradient(135deg, #0066FF, #7C3AED)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}
          >
            <Plus size={14} /> Adicionar exceção
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div style={{ padding: "32px 20px", border: "1px dashed #1F1F1F", borderRadius: 12, textAlign: "center" }}>
          <Percent size={28} color="#3F3F46" style={{ margin: "0 auto 8px" }} />
          <p style={{ fontSize: 13, color: "#A1A1AA", margin: 0 }}>
            Nenhuma exceção. Este funcionário recebe o repasse padrão de cada serviço.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map(rule => {
            const defaultPct = rule.service.commissionPercent
            const diff = defaultPct != null ? rule.commissionPercent - defaultPct : null
            return (
              <div key={rule.id} style={{ padding: "12px 16px", background: "#111", border: "1px solid #1F1F1F", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(124,58,237,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Percent size={16} color="#A78BFA" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", margin: 0 }}>
                    {rule.service.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>
                    {rule.commissionPercent}% de {formatCurrency(rule.service.price)} ={" "}
                    <strong style={{ color: "#10B981" }}>{formatCurrency(Math.floor(rule.service.price * rule.commissionPercent / 100))}</strong>
                    {defaultPct != null && diff != null && diff !== 0 && (
                      <span style={{ color: diff > 0 ? "#10B981" : "#EF4444", marginLeft: 8 }}>
                        ({diff > 0 ? "+" : ""}{diff}pp vs padrão {defaultPct}%)
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Remover exceção"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal adicionar */}
      {showAdd && (
        <>
          <div onClick={() => setShowAdd(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#111", border: "1px solid #1F1F1F", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, zIndex: 101, boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FAFAFA", margin: 0 }}>Nova exceção</h3>
              <button onClick={() => setShowAdd(false)} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A2A", color: "#71717A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#EF4444" }}>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", display: "block", marginBottom: 6 }}>Serviço</label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  style={{ width: "100%", height: 38, padding: "0 10px", background: "#0A0A0A", border: "1px solid #252525", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                >
                  <option value="">Selecione um serviço</option>
                  {availableServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.commissionPercent != null ? `(padrão ${s.commissionPercent}%)` : "(sem padrão)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", display: "block", marginBottom: 6 }}>% deste funcionário neste serviço</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formPercent}
                    onChange={(e) => setFormPercent(e.target.value)}
                    placeholder="50"
                    style={{ width: 100, height: 38, padding: "0 10px", background: "#0A0A0A", border: "1px solid #252525", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <span style={{ color: "#71717A", fontSize: 13 }}>%</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "transparent", border: "1px solid #2A2A2A", color: "#A1A1AA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{ height: 36, padding: "0 16px", borderRadius: 8, background: saving ? "#27272A" : "linear-gradient(135deg, #0066FF, #7C3AED)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
