"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, AlertCircle, ImageIcon, X, CheckCircle2 } from "lucide-react"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import ServiceImageUpload from "@/components/dashboard/ServiceImageUpload"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Service {
  id: string
  name: string
  description?: string
  price: number
  durationMinutes: number
  isActive: boolean
  imageUrl?: string | null
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDuration(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ─── Componente de input reutilizável ─────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 42, backgroundColor: "#0A0A0A",
          border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "#252525"}`,
          borderRadius: 10, padding: "0 14px", fontSize: 14,
          color: "#fff", outline: "none", width: "100%",
          fontFamily: "inherit", transition: "border-color 0.15s ease",
        }}
      />
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ServicosPage() {
  const [services,     setServices]     = useState<Service[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showModal,    setShowModal]    = useState<"create" | "edit" | null>(null)
  const [selected,     setSelected]     = useState<Service | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Form
  const [formName,     setFormName]     = useState("")
  const [formDesc,     setFormDesc]     = useState("")
  const [formPrice,    setFormPrice]    = useState("")
  const [formDuration, setFormDuration] = useState("")
  const [formActive,   setFormActive]   = useState(true)
  const [formImageUrl, setFormImageUrl] = useState("")

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ services: Service[] }>("/services")
      setServices(res.services || [])
      setError(null)
    } catch {
      setError("Erro ao carregar serviços.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchServices() }, [fetchServices])

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelected(null)
    setFormName(""); setFormDesc("")
    setFormPrice(""); setFormDuration("")
    setFormActive(true); setFormImageUrl("")
    setFormError(null)
    setShowModal("create")
  }

  const openEdit = (s: Service) => {
    setSelected(s)
    setFormName(s.name)
    setFormDesc(s.description || "")
    setFormPrice(String(s.price / 100))
    setFormDuration(String(s.durationMinutes))
    setFormActive(s.isActive)
    setFormImageUrl(s.imageUrl || "")
    setFormError(null)
    setShowModal("edit")
  }

  const closeModal = () => {
    setShowModal(null)
    setSelected(null)
    setFormError(null)
    setFormImageUrl("")
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formName.trim()) { setFormError("Nome é obrigatório."); return }
    if (!formPrice || isNaN(Number(formPrice))) { setFormError("Preço inválido."); return }
    if (!formDuration || isNaN(Number(formDuration))) { setFormError("Duração inválida."); return }

    setSaving(true)
    setFormError(null)
    try {
      const body = {
        name:            formName.trim(),
        description:     formDesc.trim() || undefined,
        price:           Math.round(Number(formPrice) * 100),
        durationMinutes: Number(formDuration),
        isActive:        formActive,
        imageUrl:        formImageUrl || null,
      }

      if (showModal === "create") {
        const res = await apiPost<{ service: Service }>("/services", body)
        setServices(prev => [res.service, ...prev])
        showSuccess("Serviço criado com sucesso!")
      } else if (selected) {
        const res = await apiPut<{ service: Service }>(`/services/${selected.id}`, body)
        setServices(prev => prev.map(s => s.id === selected.id ? res.service : s))
        showSuccess("Serviço atualizado com sucesso!")
      }
      closeModal()
    } catch {
      setFormError("Erro ao salvar serviço. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Desativar este serviço?")) return
    setDeleting(id)
    try {
      await apiDelete(`/services/${id}`)
      setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s))
      showSuccess("Serviço desativado.")
    } catch {
      alert("Erro ao desativar serviço.")
    } finally {
      setDeleting(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::placeholder { color:#3F3F46; }
      `}</style>

      <div style={{ padding: isMobile ? "16px 14px" : "28px 32px", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>

        {/* ── Toast de sucesso ── */}
        {successMsg && (
          <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 100,
            backgroundColor: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 12, padding: "12px 18px",
            display: "flex", gap: 8, alignItems: "center",
            animation: "toastIn 0.25s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <CheckCircle2 size={15} color="#10B981" />
            <span style={{ fontSize: 13, color: "#10B981", fontWeight: 500 }}>{successMsg}</span>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 20 : 28, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.4px" }}>
              Serviços
            </h1>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>
              {services.length} serviço{services.length !== 1 ? "s" : ""} cadastrado{services.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "flex", gap: 8, alignItems: "center",
              background: "linear-gradient(135deg,#0066FF,#7C3AED)",
              border: "none", color: "#fff", height: 40, padding: "0 18px",
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(0,102,255,0.25)",
            }}
          >
            <Plus size={15} />
            Novo serviço
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <AlertCircle size={14} color="#EF4444" />
            <span style={{ fontSize: 13, color: "#EF4444" }}>{error}</span>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <style>{`@keyframes sp { to { transform:rotate(360deg); } }`}</style>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1F1F1F", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && services.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{
              width: 64, height: 64, backgroundColor: "#111111",
              border: "1px solid #1F1F1F", borderRadius: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>
              <ImageIcon size={28} color="#2A2A2A" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 16 }}>
              Nenhum serviço cadastrado
            </p>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>
              Crie o primeiro serviço para começar a receber agendamentos.
            </p>
            <button
              onClick={openCreate}
              style={{
                marginTop: 20, height: 40, padding: "0 20px", borderRadius: 12,
                background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                color: "#fff", fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + Criar primeiro serviço
            </button>
          </div>
        )}

        {/* ── Grid de serviços ── */}
        {!loading && services.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {services.map(s => (
              <ServiceCard
                key={s.id}
                service={s}
                onEdit={openEdit}
                onDelete={handleDelete}
                deleting={deleting === s.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ MODAL ════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: isMobile ? 16 : 24,
          }}
        >
          <div style={{
            backgroundColor: "#111111", border: "1px solid #1F1F1F",
            borderRadius: isMobile ? 16 : 20, padding: isMobile ? 20 : 28,
            width: "100%", maxWidth: 480,
            maxHeight: "90vh", overflowY: "auto",
            animation: "fadeIn 0.2s ease",
          }}>
            {/* Header do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                {showModal === "create" ? "Novo serviço" : "Editar serviço"}
              </h2>
              <button
                onClick={closeModal}
                style={{ background: "transparent", border: "none", color: "#71717A", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload de imagem */}
            <div style={{ marginBottom: 20 }}>
              <ServiceImageUpload
                serviceId={showModal === "edit" && selected ? selected.id : ""}
                currentImageUrl={formImageUrl || null}
                onUploadComplete={url => {
                  setFormImageUrl(url)
                  if (showModal === "edit" && selected) {
                    setServices(prev => prev.map(sv =>
                      sv.id === selected.id ? { ...sv, imageUrl: url || null } : sv
                    ))
                  }
                }}
              />
            </div>

            {/* Campos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Nome" required value={formName} onChange={setFormName} placeholder="Ex: Polimento Espelhado" />
              <Field label="Descrição" value={formDesc} onChange={setFormDesc} placeholder="Descreva o serviço..." />

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <Field
                  label="Preço (R$)" required type="number"
                  value={formPrice} onChange={setFormPrice}
                  placeholder="0,00"
                />
                <Field
                  label="Duração (min)" required type="number"
                  value={formDuration} onChange={setFormDuration}
                  placeholder="60"
                />
              </div>

              {/* Toggle ativo */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                backgroundColor: "#0A0A0A", border: "1px solid #252525",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>Serviço ativo</p>
                  <p style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                    {formActive ? "Aparece na loja pública" : "Oculto da loja pública"}
                  </p>
                </div>
                <div
                  onClick={() => setFormActive(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 100,
                    backgroundColor: formActive ? "#0066FF" : "#252525",
                    cursor: "pointer", position: "relative",
                    transition: "background 0.2s ease", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: formActive ? 22 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    backgroundColor: "#fff",
                    transition: "left 0.2s ease",
                  }} />
                </div>
              </div>
            </div>

            {/* Erro do form */}
            {formError && (
              <div style={{
                backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, padding: "10px 14px", marginTop: 16,
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <AlertCircle size={13} color="#EF4444" />
                <span style={{ fontSize: 13, color: "#EF4444" }}>{formError}</span>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                style={{
                  background: "transparent", border: "1px solid #252525",
                  color: "#A1A1AA", height: 40, padding: "0 16px",
                  borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                  height: 40, padding: "0 20px", borderRadius: 10,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: saving ? 0.7 : 1,
                  display: "flex", gap: 8, alignItems: "center",
                  transition: "opacity 0.15s ease",
                }}
              >
                {saving ? (
                  <>
                    <style>{`@keyframes sp2 { to { transform:rotate(360deg); } }`}</style>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "sp2 0.6s linear infinite" }} />
                    Salvando...
                  </>
                ) : showModal === "create" ? "Criar serviço" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({
  service, onEdit, onDelete, deleting,
}: {
  service: Service
  onEdit: (s: Service) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#111111",
        border: `1px solid ${hovered ? "#252525" : "#1F1F1F"}`,
        borderRadius: 16, overflow: "hidden",
        transition: "border-color 0.15s ease",
        animation: "fadeIn 0.3s ease",
        opacity: service.isActive ? 1 : 0.55,
      }}
    >
      {/* Imagem do serviço */}
      {service.imageUrl ? (
        <div style={{ height: 120, overflow: "hidden", borderBottom: "1px solid #161616" }}>
          <img
            src={service.imageUrl}
            alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      ) : (
        <div style={{
          height: 80, borderBottom: "1px solid #161616",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "#0D0D0D",
        }}>
          <ImageIcon size={24} color="#2A2A2A" />
        </div>
      )}

      {/* Conteúdo */}
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 700, color: "#fff", margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {service.name}
            </p>
            {service.description && (
              <p style={{
                fontSize: 12, color: "#71717A", marginTop: 4,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}>
                {service.description}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            flexShrink: 0,
            backgroundColor: service.isActive ? "rgba(16,185,129,0.08)" : "rgba(113,113,122,0.08)",
            border: `1px solid ${service.isActive ? "rgba(16,185,129,0.2)" : "rgba(113,113,122,0.2)"}`,
            color: service.isActive ? "#10B981" : "#71717A",
          }}>
            {service.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>

        {/* Preço + duração */}
        <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {formatCurrency(service.price)}
          </span>
          <span style={{ fontSize: 12, color: "#52525B" }}>·</span>
          <span style={{ fontSize: 12, color: "#71717A" }}>
            {formatDuration(service.durationMinutes)}
          </span>
        </div>

        {/* Ações */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          <button
            onClick={() => onEdit(service)}
            style={{
              flex: 1, height: 34, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#A1A1AA", fontSize: 12, fontWeight: 500,
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.15s ease", fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.backgroundColor = "rgba(255,255,255,0.08)"
              b.style.color = "#fff"
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.backgroundColor = "rgba(255,255,255,0.04)"
              b.style.color = "#A1A1AA"
            }}
          >
            <Pencil size={12} />
            Editar
          </button>

          <button
            onClick={() => onDelete(service.id)}
            disabled={deleting}
            style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.12)",
              color: "#EF4444", cursor: deleting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease", opacity: deleting ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (!deleting) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.12)"
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.06)"
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}