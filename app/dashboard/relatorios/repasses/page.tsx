"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Wallet, CheckCircle, XCircle, Clock, Download,
  AlertCircle, ArrowLeft, Users, ChevronDown, ChevronUp, Receipt,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api"
import ConfirmDialog from "@/components/shared/ConfirmDialog"

type Period = "7d" | "30d" | "90d" | "12m"

type Status = "PENDING" | "PAID" | "REFUNDED"

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

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

export default function RepassesReportPage() {
  const [data, setData]       = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [period, setPeriod]   = useState<Period>("30d")
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<EmployeeAgg | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    setError("")
    try {
      const res = await apiGet<ReportData>(`/commissions/report?period=${p}`)
      setData(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar relatório.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  function toggleExpand(employeeId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  function handleMarkPaid(emp: EmployeeAgg) {
    if (emp.totalPending <= 0) return
    setPayTarget(emp)
    setConfirmOpen(true)
  }

  async function confirmMarkPaid() {
    const emp = payTarget
    if (!emp || emp.totalPending <= 0) { setConfirmOpen(false); return }

    setMarkingPaid(emp.employeeId)
    try {
      // V2-B0: envia os IDs EXATOS das transações PENDENTES deste funcionário
      // (não um intervalo de datas) — paga exatamente o que está na tela, sem
      // risco de pagar um conjunto diferente se o período mudar entre o load e o
      // clique. O backend ainda revalida businessId+employeeId+PENDING.
      const transactionIds = (data?.transactions ?? [])
        .filter(t => t.employeeId === emp.employeeId && t.status === "PENDING")
        .map(t => t.id)
      if (transactionIds.length === 0) { setMarkingPaid(null); setConfirmOpen(false); return }
      const result = await apiPost<{ count: number; totalAmount: number }>(
        `/commissions/employees/${emp.employeeId}/mark-paid`,
        { transactionIds }
      )
      toast.success(`${result.count} repasse(s) — ${fmt(result.totalAmount)} marcados como pago.`)
      await fetchData(period)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como pago.")
    } finally {
      setMarkingPaid(null)
      setConfirmOpen(false)
    }
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
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          marginBottom: isMobile ? 18 : 24,
        }}>
          <Link href="/dashboard/relatorios" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--c-text-3)", fontSize: 12, textDecoration: "none",
            width: "fit-content",
          }}>
            <ArrowLeft size={12} /> Relatórios
          </Link>
          <div style={{
            display: "flex", flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 12 : 0,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wallet size={20} color="#0066FF" />
                <h1 style={{
                  fontSize: isMobile ? 20 : 24, fontWeight: 800,
                  color: "var(--c-text)", letterSpacing: "-0.5px", margin: 0,
                }}>
                  Repasses
                </h1>
              </div>
              <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "4px 0 0 30px" }}>
                Comissões dos funcionários por execução de serviço
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{
                display: "flex", gap: 3,
                backgroundColor: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                borderRadius: 12, padding: 3,
              }}>
                {PERIODS.map(opt => {
                  const active = period === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPeriod(opt.value)}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 9,
                        fontSize: 12, fontWeight: 500,
                        cursor: "pointer", transition: "all 0.15s",
                        border: "none", fontFamily: "inherit",
                        backgroundColor: active ? "#0066FF" : "transparent",
                        color: active ? "var(--c-text)" : "var(--c-text-3)",
                        boxShadow: active ? "0 2px 8px rgba(0,102,255,0.25)" : "none",
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
                  height: 36, padding: "0 14px", borderRadius: 10,
                  fontSize: 12, fontWeight: 600,
                  cursor: !data || data.transactions.length === 0 ? "not-allowed" : "pointer",
                  border: "1px solid var(--c-border)",
                  backgroundColor: "var(--c-elevated)",
                  color: !data || data.transactions.length === 0 ? "var(--c-text-4)" : "var(--c-text)",
                  fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: !data || data.transactions.length === 0 ? 0.55 : 1,
                }}
              >
                <Download size={13} /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            backgroundColor: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
            <button
              onClick={() => fetchData(period)}
              style={{
                marginLeft: "auto", fontSize: 12, color: "#EF4444",
                background: "none", border: "none", cursor: "pointer",
                textDecoration: "underline", fontFamily: "inherit",
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
            gap: isMobile ? 10 : 16,
            marginBottom: 16,
          }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                backgroundColor: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                borderRadius: 16, height: 110,
                animation: "skR 1.4s ease infinite",
              }} />
            ))}
          </div>
        )}

        {/* CONTENT */}
        {!loading && data && (
          <>
            {/* TOTAIS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
              gap: isMobile ? 10 : 16,
              marginBottom: isMobile ? 16 : 24,
            }}>
              <TotalCard
                label="A pagar (pendente)"
                value={data.totals.pending}
                icon={<Clock size={18} />}
                color="#F59E0B"
              />
              <TotalCard
                label="Pago no período"
                value={data.totals.paid}
                icon={<CheckCircle size={18} />}
                color="#10B981"
              />
              <TotalCard
                label="Estornado (cancelados)"
                value={data.totals.refunded}
                icon={<XCircle size={18} />}
                color="var(--c-text-3)"
              />
            </div>

            {/* POR FUNCIONÁRIO */}
            <div style={{
              backgroundColor: "var(--c-elevated)",
              border: "1px solid var(--c-border)",
              borderRadius: 16, padding: isMobile ? "18px 14px" : "20px 24px",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Users size={14} color="#0066FF" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                  Por funcionário
                </h3>
              </div>

              {data.employees.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <Receipt size={28} color="var(--c-border)" style={{ margin: "0 auto 8px", display: "block" }} />
                  <p style={{ fontSize: 13, color: "var(--c-text-4)", margin: 0 }}>
                    Nenhum repasse no período.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--c-text-4)", margin: "4px 0 0" }}>
                    Repasses são gerados quando um agendamento com funcionário é concluído.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.employees.map(emp => {
                    const isExpanded = expanded.has(emp.employeeId)
                    const txs = data.transactions.filter(t => t.employeeId === emp.employeeId)
                    const isMarking = markingPaid === emp.employeeId

                    return (
                      <div key={emp.employeeId} style={{
                        border: "1px solid var(--c-border)",
                        borderRadius: 12,
                        backgroundColor: "var(--c-surface-2)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          padding: isMobile ? "14px 12px" : "14px 16px",
                          display: "flex", flexDirection: isMobile ? "column" : "row",
                          gap: isMobile ? 12 : 16,
                          alignItems: isMobile ? "stretch" : "center",
                        }}>
                          <button
                            onClick={() => toggleExpand(emp.employeeId)}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", gap: 10,
                              background: "none", border: "none", padding: 0,
                              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                              color: "inherit",
                            }}
                          >
                            {isExpanded
                              ? <ChevronUp   size={14} color="var(--c-text-3)" />
                              : <ChevronDown size={14} color="var(--c-text-3)" />}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{
                                fontSize: 14, fontWeight: 600, color: "var(--c-text)",
                                margin: 0, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {emp.employeeName}
                                {!emp.employeeActive && (
                                  <span style={{
                                    fontSize: 10, color: "var(--c-text-3)", marginLeft: 8,
                                    border: "1px solid var(--c-border)",
                                    borderRadius: 4, padding: "1px 6px",
                                  }}>
                                    inativo
                                  </span>
                                )}
                              </p>
                              <p style={{ fontSize: 11, color: "var(--c-text-3)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                                {emp.transactionCount} repasse{emp.transactionCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </button>

                          <div style={{
                            display: "flex", gap: isMobile ? 8 : 16,
                            alignItems: "center", flexWrap: "wrap",
                          }}>
                            <Pill label="Pendente"  value={emp.totalPending}  color="#F59E0B" />
                            <Pill label="Pago"      value={emp.totalPaid}     color="#10B981" />
                            {emp.totalRefunded > 0 && (
                              <Pill label="Estornado" value={emp.totalRefunded} color="var(--c-text-3)" />
                            )}
                            <button
                              onClick={() => handleMarkPaid(emp)}
                              disabled={emp.totalPending <= 0 || isMarking}
                              style={{
                                height: 32, padding: "0 12px", borderRadius: 8,
                                fontSize: 12, fontWeight: 600,
                                cursor: emp.totalPending <= 0 || isMarking ? "not-allowed" : "pointer",
                                border: "none", fontFamily: "inherit",
                                background: emp.totalPending > 0 && !isMarking
                                  ? "linear-gradient(90deg, #10B981, #059669)"
                                  : "rgba(255,255,255,0.04)",
                                color: emp.totalPending > 0 && !isMarking ? "var(--c-text)" : "var(--c-text-4)",
                                opacity: isMarking ? 0.6 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isMarking ? "Pagando..." : "Marcar pago"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{
                            borderTop: "1px solid var(--c-border)",
                            backgroundColor: "rgba(0,0,0,0.2)",
                            padding: isMobile ? "10px" : "8px 16px 12px",
                          }}>
                            {txs.length === 0 ? (
                              <p style={{ fontSize: 12, color: "var(--c-text-4)", padding: "8px 0" }}>
                                Sem transações.
                              </p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {txs.map(tx => (
                                  <div key={tx.id} style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile
                                      ? "1fr auto"
                                      : "1.5fr 1fr 80px 100px 90px",
                                    gap: 8, alignItems: "center",
                                    padding: "8px 0",
                                    borderBottom: "1px dashed var(--c-border)",
                                    fontSize: 12,
                                  }}>
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{
                                        margin: 0, color: "var(--c-text)", fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                                      }}>
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
                                      <div style={{
                                        textAlign: "right", color: "var(--c-text)", fontWeight: 600,
                                        fontVariantNumeric: "tabular-nums",
                                      }}>
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
            </div>

            <p style={{ fontSize: 11, color: "var(--c-text-4)", margin: 0, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              Período: {fmtDate(data.period.startDate)} até {fmtDate(data.period.endDate)}
            </p>
          </>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => { if (!markingPaid) { setConfirmOpen(false); setPayTarget(null) } }}
          onConfirm={confirmMarkPaid}
          title={payTarget
            ? `Marcar ${fmt(payTarget.totalPending)} como pago para ${payTarget.employeeName}?`
            : "Marcar como pago?"}
          description="Essa ação registra o pagamento e não pode ser desfeita em massa."
          confirmLabel="Marcar pago"
          variant="danger"
          loading={!!markingPaid}
        />
      </div>
    </>
  )
}

function TotalCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <div style={{
      backgroundColor: "var(--c-elevated)",
      border: "1px solid var(--c-border)",
      borderRadius: 16,
      padding: "20px 18px",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color, marginBottom: 12,
      }}>
        {icon}
      </div>
      <p style={{
        fontSize: 11, fontWeight: 500, color: "var(--c-text-3)", margin: 0,
        textTransform: "uppercase", letterSpacing: "0.6px",
      }}>{label}</p>
      <p style={{
        fontSize: 26, fontWeight: 800, color: "var(--c-text)",
        margin: "4px 0 0", letterSpacing: "-0.5px", lineHeight: 1.1,
        fontVariantNumeric: "tabular-nums",
      }}>{fmt(value)}</p>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      minWidth: 80,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 600, color: "var(--c-text-3)",
        textTransform: "uppercase", letterSpacing: "0.6px",
      }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {fmt(value)}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const color = STATUS_COLOR[status]
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 600,
      padding: "3px 7px", borderRadius: 6,
      backgroundColor: `${color}18`, color,
      border: `1px solid ${color}30`,
    }}>
      {STATUS_LABEL[status]}
    </span>
  )
}
