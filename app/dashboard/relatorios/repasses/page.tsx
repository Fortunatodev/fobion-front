"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Wallet, CheckCircle, XCircle, Clock, Download,
  AlertCircle, ArrowLeft, ChevronDown, ChevronUp, Receipt,
  CalendarClock, History, X, BadgeDollarSign,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api"
import TabTutorial from "@/components/shared/TabTutorial"

type Period = "7d" | "30d" | "90d" | "12m"
type Status = "PENDING" | "PAID" | "REFUNDED"
type SalaryMode = "COMMISSION_ONLY" | "SALARY_ONLY" | "SALARY_PLUS_COMMISSION"
type PayCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM"

interface EmployeeAgg {
  employeeId:       string
  employeeName:     string
  employeeActive:   boolean
  totalPending:     number
  totalPaid:        number
  totalRefunded:    number
  transactionCount: number
}

interface Transaction {
  id:                string
  employeeId:        string
  scheduleId:        string
  serviceId:         string
  basePrice:         number
  commissionPercent: number
  commissionAmount:  number
  status:            Status
  createdAt:         string
  paidAt:            string | null
  paymentMethod:     string | null
  notes:             string | null
  employee: { id: string; name: string; active: boolean } | null
  service:  { id: string; name: string } | null
  schedule: { id: string; scheduledAt: string; status: string } | null
}

interface ReportData {
  period:    { startDate: string; endDate: string }
  totals:    { pending: number; paid: number; refunded: number }
  employees: EmployeeAgg[]
  transactions: Transaction[]
}

interface PayrollLine {
  employeeId:             string
  name:                   string
  salaryMode:             SalaryMode
  salaryCents:            number | null
  payCadence:             PayCadence
  payDueDay:              number | null
  pendingCommissionCents: number
  lastPaidAt:             string | null
  nextDueDate:            string | null
  totalOwedNowCents:      number
}

interface PayrollSummary {
  geradoEm:         string
  totalAPagarCents: number
  funcionarios:     PayrollLine[]
}

interface Payout {
  id:               string
  employeeId:       string
  periodStart:      string
  periodEnd:        string
  salaryAmount:     number
  commissionAmount: number
  totalAmount:      number
  paymentMethod:    string | null
  notes:            string | null
  paidAt:           string
  transactionIds:   string[]
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 dias"   },
  { value: "30d", label: "30 dias"  },
  { value: "90d", label: "90 dias"  },
  { value: "12m", label: "12 meses" },
]

const STATUS_LABEL: Record<Status, string> = {
  PENDING:  "Pendente",
  PAID:     "Pago",
  REFUNDED: "Estornado",
}

const STATUS_COLOR: Record<Status, string> = {
  PENDING:  "#F59E0B",
  PAID:     "#10B981",
  REFUNDED: "var(--c-text-3)",
}

const SALARY_MODE_LABEL: Record<SalaryMode, string> = {
  COMMISSION_ONLY:        "Só comissão",
  SALARY_ONLY:            "Só salário",
  SALARY_PLUS_COMMISSION: "Salário + comissão",
}

const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão", "Transferência", "Outro"]

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

function reaisToCents(value: string): number | null {
  const clean = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  if (!clean) return null
  const n = Number(clean)
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToReais(cents: number | null): string {
  if (cents == null) return ""
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Quanto falta (ou faz) até o vencimento — em dias inteiros, em UTC.
function daysUntil(iso: string): number {
  const target = new Date(iso)
  const now = new Date()
  const ms = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
           - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round(ms / 86_400_000)
}

// Texto + cor do vencimento (didático: vencido vermelho, perto amarelo, ok cinza).
function dueInfo(iso: string | null): { text: string; color: string } | null {
  if (!iso) return null
  const d = daysUntil(iso)
  if (d < 0)  return { text: `Venceu há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`, color: "#EF4444" }
  if (d === 0) return { text: "Vence hoje", color: "#F59E0B" }
  if (d === 1) return { text: "Vence amanhã", color: "#F59E0B" }
  if (d <= 5)  return { text: `Vence em ${d} dias`, color: "#F59E0B" }
  return { text: `Vence em ${fmtDate(iso)}`, color: "var(--c-text-3)" }
}

export default function RepassesReportPage() {
  const [data, setData]       = useState<ReportData | null>(null)
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [period, setPeriod]   = useState<Period>("30d")
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)

  // Modal "Pagar agora"
  const [payLine, setPayLine] = useState<PayrollLine | null>(null)
  const [paySalary, setPaySalary] = useState("")
  const [payIncludeSalary, setPayIncludeSalary] = useState(true)
  const [payMethod, setPayMethod] = useState("PIX")
  const [payNotes, setPayNotes] = useState("")
  const [paySaving, setPaySaving] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchAll = useCallback(async (p: Period) => {
    setLoading(true)
    setError("")
    try {
      const [report, sum, pay] = await Promise.all([
        apiGet<ReportData>(`/commissions/report?period=${p}`),
        apiGet<PayrollSummary>("/commissions/summary"),
        apiGet<{ payouts: Payout[] }>("/commissions/payouts"),
      ])
      setData(report)
      setSummary(sum)
      setPayouts(pay.payouts ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar repasses.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll(period) }, [period, fetchAll])

  function toggleExpand(employeeId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  function openPay(line: PayrollLine) {
    setPayLine(line)
    const hasSalary = line.salaryMode === "SALARY_ONLY" || line.salaryMode === "SALARY_PLUS_COMMISSION"
    setPayIncludeSalary(hasSalary && (line.salaryCents ?? 0) > 0)
    setPaySalary(centsToReais(line.salaryCents))
    setPayMethod("PIX")
    setPayNotes("")
  }

  function closePay() {
    if (paySaving) return
    setPayLine(null)
  }

  // Total que o modal vai pagar = comissão pendente + (salário, se marcado).
  const payCommissionCents = payLine?.pendingCommissionCents ?? 0
  const paySalaryCents = payIncludeSalary ? (reaisToCents(paySalary) ?? 0) : 0
  const payTotalCents = payCommissionCents + paySalaryCents

  async function confirmPay() {
    if (!payLine) return
    if (payTotalCents <= 0) {
      toast.error("Nada a pagar: marque o salário ou aguarde comissões pendentes.")
      return
    }
    setPaySaving(true)
    try {
      const now = new Date()
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
      const periodEnd = now.toISOString()
      const result = await apiPost<{ comissoesPagas: number; payout: Payout }>("/commissions/payouts", {
        employeeId:  payLine.employeeId,
        periodStart,
        periodEnd,
        payAllPending: payCommissionCents > 0,
        salaryAmountCents: payIncludeSalary ? paySalaryCents : 0,
        paymentMethod: payMethod,
        notes: payNotes.trim() || undefined,
      })
      toast.success(`Pagamento de ${fmt(result.payout.totalAmount)} registrado para ${payLine.name}.`)
      setPayLine(null)
      await fetchAll(period)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar pagamento.")
    } finally {
      setPaySaving(false)
    }
  }

  function employeeName(employeeId: string): string {
    return summary?.funcionarios.find(f => f.employeeId === employeeId)?.name
      ?? data?.employees.find(e => e.employeeId === employeeId)?.employeeName
      ?? "Funcionário"
  }

  function exportCSV() {
    if (!data) return
    const header = [
      "Funcionário", "Status", "Serviço", "Data agendamento",
      "Preço base", "Repasse %", "Valor repasse", "Pago em", "Método",
    ]
    const rows = data.transactions.map(tx => [
      tx.employee?.name ?? "",
      STATUS_LABEL[tx.status],
      tx.service?.name ?? "",
      tx.schedule ? fmtDate(tx.schedule.scheduledAt) : "",
      (tx.basePrice / 100).toFixed(2).replace(".", ","),
      `${tx.commissionPercent}%`,
      (tx.commissionAmount / 100).toFixed(2).replace(".", ","),
      tx.paidAt ? fmtDate(tx.paidAt) : "",
      tx.paymentMethod ?? "",
    ])
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n")
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `repasses-${period}-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const owedLines = (summary?.funcionarios ?? []).filter(f => f.totalOwedNowCents > 0)
  const okLines   = (summary?.funcionarios ?? []).filter(f => f.totalOwedNowCents <= 0)

  return (
    <>
      <style>{`
        @keyframes skR{0%,100%{opacity:.4}50%{opacity:.8}}
        @keyframes slideIn{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: isMobile ? "16px 14px" : "24px 24px 48px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        {/* HEADER */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: isMobile ? 18 : 24 }}>
          <Link href="/dashboard/relatorios" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--c-text-3)", fontSize: 12, textDecoration: "none", width: "fit-content",
          }}>
            <ArrowLeft size={12} /> Relatórios
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={20} color="#0066FF" />
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: "var(--c-text)", letterSpacing: "-0.5px", margin: 0 }}>
                Repasses e salários
              </h1>
            </div>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "4px 0 0 30px" }}>
              Quem você precisa pagar, quanto e quando — e o histórico de tudo que já pagou.
            </p>
          </div>
        </div>

        <TabTutorial
          tabKey="repasses"
          title="Como pagar a equipe"
          subtitle="Salários e comissões sem se perder"
          steps={[
            { icon: BadgeDollarSign, title: "1. Veja quanto deve", text: "No topo aparece quanto pagar a cada funcionário agora: salário do período + comissões ainda não pagas." },
            { icon: CalendarClock, title: "2. Fique de olho no vencimento", text: "Quem tem salário mensal mostra o próximo vencimento. Vermelho = atrasado, amarelo = está chegando." },
            { icon: CheckCircle, title: "3. Pague num toque", text: "Clique em \"Pagar agora\": registra salário + comissões num lote só e guarda no histórico." },
            { icon: History, title: "4. Histórico completo", text: "Tudo que você já pagou fica salvo — com data, forma de pagamento e valor. Bom pra conferir depois." },
          ]}
        />

        {/* ERROR */}
        {error && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
            <button
              onClick={() => fetchAll(period)}
              style={{ marginLeft: "auto", fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 16, marginBottom: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 16, height: 120, animation: "skR 1.4s ease infinite" }} />
            ))}
          </div>
        )}

        {!loading && summary && (
          <>
            {/* ── FOLHA — o que você precisa pagar (HERO) ── */}
            <div style={{
              background: "linear-gradient(135deg, rgba(0,102,255,0.10), rgba(124,58,237,0.06))",
              border: "1px solid var(--c-border)", borderRadius: 18,
              padding: isMobile ? "18px 14px" : "22px 24px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>
                    A pagar agora
                  </p>
                  <p style={{ fontSize: isMobile ? 30 : 36, fontWeight: 800, color: "var(--c-text)", margin: "4px 0 0", letterSpacing: "-1px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(summary.totalAPagarCents)}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: "6px 0 0" }}>
                    Salários do período + comissões ainda não pagas.
                  </p>
                </div>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,102,255,0.15)", border: "1px solid rgba(0,102,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" }}>
                  <BadgeDollarSign size={26} />
                </div>
              </div>

              {summary.funcionarios.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: "18px 0 0" }}>
                  Cadastre funcionários e defina como cada um recebe na aba <strong style={{ color: "var(--c-text-3)" }}>Equipe</strong>.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
                  {[...owedLines, ...okLines].map(line => {
                    const due = dueInfo(line.nextDueDate)
                    const hasSalary = (line.salaryCents ?? 0) > 0
                    const nothingOwed = line.totalOwedNowCents <= 0
                    return (
                      <div key={line.employeeId} style={{
                        display: "flex", flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 14,
                        padding: isMobile ? "12px" : "12px 16px", borderRadius: 12,
                        backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)" }}>{line.name}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, borderRadius: 99, padding: "2px 8px",
                              color: "#34D399", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
                            }}>
                              {SALARY_MODE_LABEL[line.salaryMode]}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap", fontSize: 12, color: "var(--c-text-3)", fontVariantNumeric: "tabular-nums" }}>
                            {hasSalary && <span>Salário {fmt(line.salaryCents ?? 0)}</span>}
                            {line.pendingCommissionCents > 0 && <span style={{ color: "#F59E0B" }}>Comissão {fmt(line.pendingCommissionCents)}</span>}
                            {due && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: due.color }}>
                                <CalendarClock size={11} /> {due.text}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: isMobile ? "space-between" : "flex-end" }}>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 9, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>Total</p>
                            <p style={{ fontSize: 16, fontWeight: 800, color: nothingOwed ? "var(--c-text-3)" : "var(--c-text)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                              {fmt(line.totalOwedNowCents)}
                            </p>
                          </div>
                          <button
                            onClick={() => openPay(line)}
                            disabled={nothingOwed && !hasSalary}
                            style={{
                              height: 38, padding: "0 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                              cursor: nothingOwed && !hasSalary ? "not-allowed" : "pointer", border: "none", fontFamily: "inherit",
                              whiteSpace: "nowrap",
                              background: nothingOwed && !hasSalary ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #10B981, #059669)",
                              color: nothingOwed && !hasSalary ? "var(--c-text-4)" : "#fff",
                            }}
                          >
                            Pagar agora
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── HISTÓRICO DE PAGAMENTOS ── */}
            <div style={{ backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
              <button
                onClick={() => setShowHistory(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: isMobile ? "16px 14px" : "16px 24px", background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit", color: "inherit", textAlign: "left",
                }}
              >
                <History size={15} color="#A78BFA" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)" }}>
                  Histórico de pagamentos
                </span>
                <span style={{ fontSize: 11, color: "var(--c-text-3)", backgroundColor: "var(--c-surface-2)", borderRadius: 99, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>
                  {payouts.length}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  {showHistory ? <ChevronUp size={16} color="var(--c-text-3)" /> : <ChevronDown size={16} color="var(--c-text-3)" />}
                </span>
              </button>

              {showHistory && (
                <div style={{ borderTop: "1px solid var(--c-border)", padding: isMobile ? "8px 12px 14px" : "8px 24px 18px" }}>
                  {payouts.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--c-text-4)", padding: "16px 0", textAlign: "center" }}>
                      Nenhum pagamento registrado ainda. Use “Pagar agora” acima para registrar o primeiro.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {payouts.map(p => (
                        <div key={p.id} style={{
                          display: "flex", flexDirection: isMobile ? "column" : "row",
                          alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 6 : 14,
                          padding: "12px 14px", borderRadius: 10,
                          backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", margin: 0 }}>
                              {employeeName(p.employeeId)}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                              Pago em {fmtDate(p.paidAt)}
                              {p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                              {p.notes ? ` · ${p.notes}` : ""}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 14, alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
                            {p.salaryAmount > 0 && (
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: 9, color: "var(--c-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Salário</p>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", margin: "1px 0 0" }}>{fmt(p.salaryAmount)}</p>
                              </div>
                            )}
                            {p.commissionAmount > 0 && (
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: 9, color: "var(--c-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Comissão</p>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", margin: "1px 0 0" }}>{fmt(p.commissionAmount)}</p>
                              </div>
                            )}
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 9, color: "var(--c-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: "#10B981", margin: "1px 0 0" }}>{fmt(p.totalAmount)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── EXTRATO DETALHADO (comissões por execução) ── */}
        {!loading && data && (
          <div style={{ backgroundColor: "var(--c-elevated)", border: "1px solid var(--c-border)", borderRadius: 16, padding: isMobile ? "18px 14px" : "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 12, flexDirection: isMobile ? "column" : "row", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Receipt size={14} color="#0066FF" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  Extrato de comissões
                </h3>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 3, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 3 }}>
                  {PERIODS.map(opt => {
                    const active = period === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setPeriod(opt.value)}
                        style={{
                          height: 30, padding: "0 12px", borderRadius: 9, fontSize: 12, fontWeight: 500,
                          cursor: "pointer", border: "none", fontFamily: "inherit",
                          backgroundColor: active ? "#0066FF" : "transparent",
                          color: active ? "#fff" : "var(--c-text-3)",
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={exportCSV}
                  disabled={!data || data.transactions.length === 0}
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    cursor: !data || data.transactions.length === 0 ? "not-allowed" : "pointer",
                    border: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)",
                    color: !data || data.transactions.length === 0 ? "var(--c-text-4)" : "var(--c-text)",
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                    opacity: !data || data.transactions.length === 0 ? 0.55 : 1,
                  }}
                >
                  <Download size={13} /> CSV
                </button>
              </div>
            </div>

            {/* TOTAIS do período */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 16, marginBottom: 18 }}>
              <TotalCard label="A pagar (pendente)"     value={data.totals.pending}  icon={<Clock size={18} />}       color="#F59E0B" />
              <TotalCard label="Pago no período"        value={data.totals.paid}     icon={<CheckCircle size={18} />} color="#10B981" />
              <TotalCard label="Estornado (cancelados)" value={data.totals.refunded} icon={<XCircle size={18} />}     color="var(--c-text-3)" />
            </div>

            {data.employees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Receipt size={28} color="var(--c-border)" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>Nenhum repasse no período.</p>
                <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "4px 0 0" }}>
                  Repasses são gerados quando um agendamento com funcionário é concluído.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.employees.map(emp => {
                  const isExpanded = expanded.has(emp.employeeId)
                  const txs = data.transactions.filter(t => t.employeeId === emp.employeeId)
                  return (
                    <div key={emp.employeeId} style={{ border: "1px solid var(--c-border)", borderRadius: 12, backgroundColor: "var(--c-surface-2)", overflow: "hidden" }}>
                      <button
                        onClick={() => toggleExpand(emp.employeeId)}
                        style={{
                          width: "100%", padding: isMobile ? "14px 12px" : "14px 16px",
                          display: "flex", gap: 12, alignItems: "center",
                          background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "inherit",
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} color="var(--c-text-3)" /> : <ChevronDown size={14} color="var(--c-text-3)" />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {emp.employeeName}
                            {!emp.employeeActive && (
                              <span style={{ fontSize: 10, color: "var(--c-text-3)", marginLeft: 8, border: "1px solid var(--c-border)", borderRadius: 4, padding: "1px 6px" }}>inativo</span>
                            )}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                            {emp.transactionCount} repasse{emp.transactionCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: isMobile ? 8 : 16, alignItems: "center", flexWrap: "wrap" }}>
                          <Pill label="Pendente" value={emp.totalPending} color="#F59E0B" />
                          <Pill label="Pago"     value={emp.totalPaid}    color="#10B981" />
                          {emp.totalRefunded > 0 && <Pill label="Estornado" value={emp.totalRefunded} color="var(--c-text-3)" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={{ borderTop: "1px solid var(--c-border)", backgroundColor: "rgba(0,0,0,0.2)", padding: isMobile ? "10px" : "8px 16px 12px" }}>
                          {txs.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--c-text-4)", padding: "8px 0" }}>Sem transações.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {txs.map(tx => (
                                <div key={tx.id} style={{
                                  display: "grid",
                                  gridTemplateColumns: isMobile ? "1fr auto" : "1.5fr 1fr 80px 100px 90px",
                                  gap: 8, alignItems: "center", padding: "8px 0",
                                  borderBottom: "1px dashed var(--c-border)", fontSize: 12,
                                }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, color: "var(--c-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {tx.service?.name ?? "(serviço removido)"}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--c-text-3)", fontVariantNumeric: "tabular-nums" }}>
                                      {tx.schedule ? fmtDate(tx.schedule.scheduledAt) : fmtDate(tx.createdAt)}
                                    </p>
                                  </div>
                                  {!isMobile && (
                                    <div style={{ color: "var(--c-text-2)", fontVariantNumeric: "tabular-nums" }}>
                                      {fmt(tx.basePrice)} × {tx.commissionPercent}%
                                    </div>
                                  )}
                                  {!isMobile && (
                                    <div style={{ textAlign: "right", color: "var(--c-text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                      {fmt(tx.commissionAmount)}
                                    </div>
                                  )}
                                  {!isMobile && (
                                    <div style={{ textAlign: "right" }}>
                                      <StatusBadge status={tx.status} />
                                    </div>
                                  )}
                                  {isMobile && (
                                    <div style={{ textAlign: "right" }}>
                                      <p style={{ margin: 0, color: "var(--c-text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                        {fmt(tx.commissionAmount)}
                                      </p>
                                      <div style={{ marginTop: 4 }}>
                                        <StatusBadge status={tx.status} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: "16px 0 0", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              Período: {fmtDate(data.period.startDate)} até {fmtDate(data.period.endDate)}
            </p>
          </div>
        )}

        {/* ── MODAL: Pagar agora ── */}
        {payLine && (
          <>
            <div onClick={closePay} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 100 }} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18,
              width: "min(440px, calc(100vw - 28px))", padding: 24, zIndex: 101,
              maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>Pagar {payLine.name}</h2>
                <button onClick={closePay} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-4)", padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Resumo do que será pago */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {payCommissionCents > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--c-text-2)" }}>Comissões pendentes</span>
                    <span style={{ color: "#F59E0B", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(payCommissionCents)}</span>
                  </div>
                )}

                {/* Incluir salário */}
                {(payLine.salaryMode === "SALARY_ONLY" || payLine.salaryMode === "SALARY_PLUS_COMMISSION") && (
                  <div style={{ borderTop: payCommissionCents > 0 ? "1px dashed var(--c-border)" : "none", paddingTop: payCommissionCents > 0 ? 10 : 0 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--c-text-2)", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={payIncludeSalary}
                        onChange={e => setPayIncludeSalary(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#10B981", cursor: "pointer" }}
                      />
                      Incluir o salário neste pagamento
                    </label>
                    {payIncludeSalary && (
                      <div style={{ position: "relative", marginTop: 8 }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--c-text-4)", pointerEvents: "none" }}>R$</span>
                        <input
                          inputMode="decimal"
                          value={paySalary}
                          onChange={e => setPaySalary(e.target.value)}
                          placeholder="1.800,00"
                          style={{
                            height: 40, padding: "0 12px 0 36px", borderRadius: 10, width: "100%",
                            border: "1px solid var(--c-border-2)", backgroundColor: "var(--c-surface-2)",
                            color: "var(--c-text)", fontSize: 14, outline: "none", fontFamily: "inherit",
                            boxSizing: "border-box", fontVariantNumeric: "tabular-nums",
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {payCommissionCents <= 0 && payLine.salaryMode === "COMMISSION_ONLY" && (
                  <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: 0 }}>
                    Sem comissões pendentes para pagar agora.
                  </p>
                )}
              </div>

              {/* Método */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", display: "block", marginBottom: 6 }}>Forma de pagamento</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PAYMENT_METHODS.map(m => {
                    const on = payMethod === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        style={{
                          height: 32, padding: "0 12px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
                          fontSize: 12, fontWeight: 600,
                          border: on ? "1px solid rgba(16,185,129,0.45)" : "1px solid var(--c-border-2)",
                          backgroundColor: on ? "rgba(16,185,129,0.12)" : "transparent",
                          color: on ? "#34D399" : "var(--c-text-2)",
                        }}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Observação */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", display: "block", marginBottom: 6 }}>Observação (opcional)</label>
                <input
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ex: folha de junho"
                  maxLength={200}
                  style={{
                    height: 40, padding: "0 12px", borderRadius: 10, width: "100%",
                    border: "1px solid var(--c-border-2)", backgroundColor: "var(--c-surface-2)",
                    color: "var(--c-text)", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2)" }}>Total a pagar</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{fmt(payTotalCents)}</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={closePay}
                  disabled={paySaving}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid var(--c-border-2)", backgroundColor: "transparent", color: "var(--c-text-2)", fontSize: 14, fontWeight: 600, cursor: paySaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPay}
                  disabled={paySaving || payTotalCents <= 0}
                  style={{
                    flex: 2, height: 44, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                    cursor: paySaving || payTotalCents <= 0 ? "not-allowed" : "pointer",
                    background: payTotalCents <= 0 ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #10B981, #059669)",
                    color: payTotalCents <= 0 ? "var(--c-text-4)" : "#fff",
                    opacity: paySaving ? 0.7 : 1,
                  }}
                >
                  {paySaving ? "Registrando..." : `Confirmar ${fmt(payTotalCents)}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function TotalCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <div style={{ backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 16, padding: "18px 16px" }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center",
        color, marginBottom: 12,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: "var(--c-text)", margin: "4px 0 0", letterSpacing: "-0.5px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</p>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 76 }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const color = STATUS_COLOR[status]
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 6,
      backgroundColor: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {STATUS_LABEL[status]}
    </span>
  )
}
