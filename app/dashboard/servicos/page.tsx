"use client"

import { useState, useEffect, useCallback, useMemo, Fragment, type ReactNode } from "react"
import { Plus, Pencil, Trash2, AlertCircle, ImageIcon, X, CheckCircle2, Search, Clock, ShieldCheck, Percent, Tag, Heart } from "lucide-react"
import { toast } from "sonner"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import ServiceImageUpload from "@/components/dashboard/ServiceImageUpload"
import ConfirmDialog from "@/components/shared/ConfirmDialog"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Service {
  id: string
  name: string
  description?: string
  category?: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  imageUrl?: string | null
  commissionPercent?: number | null
  warrantyDays?: number | null
  recallDays?: number | null
  priceByVehicleType?: Record<string, number> | null
  createdAt: string
}

// Sugestões de categoria de estética automotiva (input é livre via datalist).
const CATEGORY_SUGGESTIONS = [
  "Lavagem",
  "Polimento",
  "Vitrificação",
  "Higienização",
  "Proteção",
  "Estética geral",
  "Outros",
] as const

const NO_CATEGORY_LABEL = "Sem categoria"

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

// Faixa de preço por porte (CAR/MOTORCYCLE/TRUCK/SUV em centavos) — só dado já
// retornado pelo back. Retorna o menor preço entre o base e os portes, e se há
// variação (pra mostrar "a partir de"). Não inventa campo novo.
function priceRange(service: Service): { min: number; varies: boolean } {
  const porte = service.priceByVehicleType
  if (!porte) return { min: service.price, varies: false }
  const vals = Object.values(porte).filter((v): v is number => typeof v === "number" && v > 0)
  if (vals.length === 0) return { min: service.price, varies: false }
  const all = [service.price, ...vals]
  const min = Math.min(...all)
  const max = Math.max(...all)
  return { min, varies: max !== min }
}

type SortKey = "recent" | "name" | "priceAsc" | "priceDesc" | "duration"

const SORT_LABELS: Record<SortKey, string> = {
  recent:    "Mais recentes",
  name:      "Nome (A-Z)",
  priceAsc:  "Menor preço",
  priceDesc: "Maior preço",
  duration:  "Maior duração",
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
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>
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
          height: 42, backgroundColor: "var(--c-bg)",
          border: `1px solid ${focused ? "rgba(0,102,255,0.4)" : "var(--c-border-2)"}`,
          borderRadius: 10, padding: "0 14px", fontSize: 14,
          color: "var(--c-text)", outline: "none", width: "100%",
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
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)
  const [search,       setSearch]       = useState("")
  const [sortKey,      setSortKey]      = useState<SortKey>("recent")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")  // "all" | nome da categoria | NO_CATEGORY_LABEL

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Form
  const [formName,     setFormName]     = useState("")
  const [formDesc,        setFormDesc]        = useState("")
  const [formCategory,    setFormCategory]    = useState("")
  const [formPrice,       setFormPrice]       = useState("")
  const [formDuration,    setFormDuration]    = useState("")
  const [formActive,      setFormActive]      = useState(true)
  const [formImageUrl,    setFormImageUrl]    = useState("")
  const [formCommissionPct, setFormCommissionPct] = useState("")  // string vazia = sem repasse default
  const [formWarranty, setFormWarranty] = useState("")  // V2-B3: garantia (proteção) em dias (vazio = sem)
  const [formRecall, setFormRecall] = useState("")  // CRM: re-chamar o cliente a cada N dias (vazio = não lembrar)
  // V2-B4: preço por porte (R$, string vazia = usa preço base). CAR/MOTO/TRUCK/SUV
  const [formPorte, setFormPorte] = useState<Record<"CAR" | "MOTORCYCLE" | "TRUCK" | "SUV", string>>({ CAR: "", MOTORCYCLE: "", TRUCK: "", SUV: "" })

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

  // ── Busca + ordenação (front-puro, sobre os dados já carregados) ─────────────
  const activeCount   = useMemo(() => services.filter(s => s.isActive).length, [services])
  const inactiveCount = services.length - activeCount

  // Categorias presentes no catálogo (pro dropdown de filtro). Ordem alfabética;
  // "Sem categoria" entra no fim se houver algum serviço sem categoria.
  const availableCategories = useMemo(() => {
    const named = new Set<string>()
    let hasUncategorized = false
    for (const s of services) {
      const c = (s.category ?? "").trim()
      if (c) named.add(c); else hasUncategorized = true
    }
    const list = [...named].sort((a, b) => a.localeCompare(b, "pt-BR"))
    if (hasUncategorized) list.push(NO_CATEGORY_LABEL)
    return list
  }, [services])

  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filtered = q
      ? services.filter(s =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.category ?? "").toLowerCase().includes(q))
      : services
    if (categoryFilter !== "all") {
      filtered = filtered.filter(s => {
        const c = (s.category ?? "").trim()
        return categoryFilter === NO_CATEGORY_LABEL ? !c : c === categoryFilter
      })
    }
    const sorted = [...filtered]
    switch (sortKey) {
      case "name":      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); break
      case "priceAsc":  sorted.sort((a, b) => a.price - b.price); break
      case "priceDesc": sorted.sort((a, b) => b.price - a.price); break
      case "duration":  sorted.sort((a, b) => b.durationMinutes - a.durationMinutes); break
      default:          sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    return sorted
  }, [services, search, sortKey, categoryFilter])

  // Agrupa os serviços visíveis por categoria (mantém a ordenação interna já
  // aplicada). "Sem categoria" sempre por último. Headers de seção no render.
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>()
    for (const s of visibleServices) {
      const key = (s.category ?? "").trim() || NO_CATEGORY_LABEL
      const arr = groups.get(key)
      if (arr) arr.push(s); else groups.set(key, [s])
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === NO_CATEGORY_LABEL) return 1
      if (b === NO_CATEGORY_LABEL) return -1
      return a.localeCompare(b, "pt-BR")
    })
  }, [visibleServices])

  // ── V2-B1: pré-seed de ~30 serviços de estética (conta deixa de nascer vazia) ──
  const [seeding, setSeeding] = useState(false)
  const handleSeedDefaults = useCallback(async () => {
    setSeeding(true)
    try {
      await apiPost<{ created: number }>("/services/seed-defaults", {})
      await fetchServices()
    } catch {
      setError("Não foi possível adicionar os serviços prontos.")
    } finally {
      setSeeding(false)
    }
  }, [fetchServices])

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelected(null)
    setFormName(""); setFormDesc(""); setFormCategory("")
    setFormPrice(""); setFormDuration("")
    setFormActive(true); setFormImageUrl("")
    setFormCommissionPct("")
    setFormWarranty("")
    setFormRecall("")
    setFormPorte({ CAR: "", MOTORCYCLE: "", TRUCK: "", SUV: "" })
    setFormError(null)
    setShowModal("create")
  }

  // Deep-link de ativação: /dashboard/servicos?novo=1 abre direto o modal de
  // criação (CTA "Cadastrar serviço" do onboarding). Lê window.location direto
  // (sem useSearchParams → sem Suspense boundary) e limpa o param via
  // replaceState pra F5/voltar não reabrir o modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") {
      openCreate()
      window.history.replaceState(null, "", window.location.pathname)
    }
    // mount-only de propósito: openCreate só zera o form e abre o modal
  }, [])

  const openEdit = (s: Service) => {
    setSelected(s)
    setFormName(s.name)
    setFormDesc(s.description || "")
    setFormCategory(s.category || "")
    setFormPrice(String(s.price / 100))
    setFormDuration(String(s.durationMinutes))
    setFormActive(s.isActive)
    setFormImageUrl(s.imageUrl || "")
    setFormCommissionPct(s.commissionPercent != null ? String(s.commissionPercent) : "")
    setFormWarranty(s.warrantyDays != null ? String(s.warrantyDays) : "")
    setFormRecall(s.recallDays != null ? String(s.recallDays) : "")
    {
      const p = s.priceByVehicleType || {}
      const c = (v: number | undefined) => (v != null ? String(v / 100) : "")
      setFormPorte({ CAR: c(p.CAR), MOTORCYCLE: c(p.MOTORCYCLE), TRUCK: c(p.TRUCK), SUV: c(p.SUV) })
    }
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
    if (!formName.trim()) { setFormError("Nome é obrigatório."); toast.error("Preencha o nome do serviço."); return }
    if (!formPrice || isNaN(Number(formPrice))) { setFormError("Preço inválido."); toast.error("Preencha um preço válido (R$)."); return }
    if (!formDuration || isNaN(Number(formDuration))) { setFormError("Duração inválida."); toast.error("Preencha uma duração válida (minutos)."); return }

    setSaving(true)
    setFormError(null)
    try {
      // Repasse: vazio → null (sem default). Senão valida 0-100.
      let commissionPercent: number | null = null
      if (formCommissionPct.trim()) {
        const pct = Number(formCommissionPct)
        if (isNaN(pct) || pct < 0 || pct > 100) {
          setFormError("Repasse deve estar entre 0 e 100.")
          toast.error("Repasse ao funcionário deve estar entre 0 e 100%.")
          setSaving(false)
          return
        }
        commissionPercent = Math.round(pct)
      }

      const body = {
        name:            formName.trim(),
        description:     formDesc.trim() || undefined,
        category:        formCategory.trim() || null,
        price:           Math.round(Number(formPrice) * 100),
        durationMinutes: Number(formDuration),
        isActive:        formActive,
        imageUrl:        formImageUrl || null,
        commissionPercent,
        // V2-B3: garantia (proteção) em dias (vazio = sem garantia)
        warrantyDays:    formWarranty.trim() ? Math.max(0, Math.round(Number(formWarranty))) : null,
        // CRM: re-chamar o cliente a cada N dias (vazio = não lembrar)
        recallDays:      formRecall.trim() ? Math.max(0, Math.round(Number(formRecall))) : null,
        // V2-B4: preço por porte (só os preenchidos, em centavos). null se nenhum.
        priceByVehicleType: (() => {
          const out: Record<string, number> = {}
          for (const k of ["CAR", "MOTORCYCLE", "TRUCK", "SUV"] as const) {
            const v = formPorte[k].trim()
            if (v && !isNaN(Number(v)) && Number(v) > 0) out[k] = Math.round(Number(v) * 100)
          }
          return Object.keys(out).length ? out : null
        })(),
      }

      if (showModal === "create") {
        const res = await apiPost<{ service: Service }>("/services", body)
        setServices(prev => [res.service, ...prev])
        showSuccess("Serviço criado com sucesso!")
        toast.success("Serviço criado com sucesso!")
      } else if (selected) {
        const res = await apiPut<{ service: Service }>(`/services/${selected.id}`, body)
        setServices(prev => prev.map(s => s.id === selected.id ? res.service : s))
        showSuccess("Serviço atualizado com sucesso!")
        toast.success("Serviço atualizado com sucesso!")
      }
      closeModal()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar serviço. Tente novamente."
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (s: Service) => {
    setDeleteTarget(s)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleting(id)
    try {
      await apiDelete(`/services/${id}`)
      setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s))
      showSuccess("Serviço desativado.")
    } catch {
      toast.error("Erro ao desativar serviço.")
    } finally {
      setDeleting(null)
      setConfirmOpen(false)
      setDeleteTarget(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::placeholder { color:var(--c-text-4); }
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
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: "var(--c-text)", margin: 0, letterSpacing: "-0.4px" }}>
              Serviços
            </h1>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>
              {services.length} serviço{services.length !== 1 ? "s" : ""} cadastrado{services.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "flex", gap: 8, alignItems: "center",
              background: "linear-gradient(135deg,#0066FF,#7C3AED)",
              border: "none", color: "var(--c-on-primary)", height: 40, padding: "0 18px",
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

        {/* ── Toolbar: busca + ordenação + stats (só com lista carregada) ── */}
        {!loading && services.length > 0 && (
          <div style={{
            display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
            alignItems: "center", flexDirection: isMobile ? "column" : "row",
          }}>
            {/* Busca */}
            <div style={{ flex: 1, minWidth: isMobile ? "100%" : 220, position: "relative", width: isMobile ? "100%" : undefined }}>
              <Search size={14} color="var(--c-text-4)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar serviço por nome ou descrição..."
                style={{
                  width: "100%", height: 40, backgroundColor: "var(--c-surface)",
                  border: "1px solid var(--c-border)", borderRadius: 12,
                  paddingLeft: 36, paddingRight: 14, fontSize: 13,
                  color: "var(--c-text)", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
                onBlur={e  => { e.target.style.borderColor = "var(--c-border)" }}
              />
            </div>

            {/* Ordenação */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{
                height: 40, backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
                borderRadius: 12, padding: "0 12px", fontSize: 13, color: "var(--c-text-2)",
                outline: "none", fontFamily: "inherit", cursor: "pointer",
                width: isMobile ? "100%" : undefined,
              }}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <option key={k} value={k} style={{ backgroundColor: "var(--c-surface)", color: "var(--c-text)" }}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>

            {/* Filtro por categoria (só se houver alguma categoria no catálogo) */}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{
                  height: 40, backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: 12, padding: "0 12px", fontSize: 13, color: "var(--c-text-2)",
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                  width: isMobile ? "100%" : undefined,
                }}
              >
                <option value="all" style={{ backgroundColor: "var(--c-surface)", color: "var(--c-text)" }}>
                  Todas as categorias
                </option>
                {availableCategories.map(c => (
                  <option key={c} value={c} style={{ backgroundColor: "var(--c-surface)", color: "var(--c-text)" }}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Stats */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatBadge value={services.length} label="Total" color="var(--c-text-2)" bg="var(--c-surface)" border="var(--c-border)" />
              <StatBadge value={activeCount}     label="Ativos"   color="#10B981" bg="rgba(16,185,129,0.06)" border="rgba(16,185,129,0.2)" />
              {inactiveCount > 0 && (
                <StatBadge value={inactiveCount} label="Inativos" color="var(--c-text-3)" bg="var(--c-surface)" border="var(--c-border)" />
              )}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <style>{`@keyframes sp { to { transform:rotate(360deg); } }`}</style>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--c-border)", borderTopColor: "#0066FF", animation: "sp 0.7s linear infinite" }} />
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && services.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 20px", maxWidth: 460, margin: "0 auto" }}>
            <div style={{
              width: 64, height: 64, backgroundColor: "var(--c-surface)",
              border: "1px solid var(--c-border)", borderRadius: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>
              <ImageIcon size={28} color="var(--c-border-2)" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", marginTop: 16, letterSpacing: "-0.2px" }}>
              Nenhum serviço ainda
            </p>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 8, lineHeight: 1.55 }}>
              Cadastre o primeiro (ex.: <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>&ldquo;Lavagem completa — R$50 carro / R$80 SUV&rdquo;</span>) pra montar seu catálogo e a sua loja pública.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
              <button
                onClick={openCreate}
                style={{
                  display: "flex", gap: 8, alignItems: "center",
                  height: 40, padding: "0 20px", borderRadius: 12,
                  background: "linear-gradient(135deg,#0066FF,#7C3AED)",
                  color: "var(--c-on-primary)", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Plus size={15} />
                Novo serviço
              </button>
              {/* V2-B1: catálogo pronto (referência CERA) — fricção zero de setup */}
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                style={{
                  height: 40, padding: "0 20px", borderRadius: 12,
                  background: "transparent", color: seeding ? "var(--c-text-4)" : "var(--c-text-2)",
                  fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--c-border)", cursor: seeding ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { if (!seeding) e.currentTarget.style.borderColor = "#0066FF" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--c-border)" }}
              >
                {seeding ? "Adicionando…" : "Adicionar 30 serviços prontos"}
              </button>
            </div>
          </div>
        )}

        {/* ── Sem resultados de busca ── */}
        {!loading && services.length > 0 && visibleServices.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Search size={26} color="var(--c-border-2)" style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginTop: 14 }}>
              Nenhum serviço encontrado
            </p>
            <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 6 }}>
              Nada combina com “{search.trim()}”. Tente outro termo.
            </p>
            <button
              onClick={() => setSearch("")}
              style={{
                marginTop: 16, height: 36, padding: "0 16px", borderRadius: 10,
                background: "transparent", color: "var(--c-text-2)", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--c-border)", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* ── Grid de serviços ──────────────────────────────────────────────
            Grade contínua única (3-4 cards por linha). A categoria entra como
            divisória leve que ocupa a linha inteira (gridColumn 1/-1), então os
            cards de cada categoria fluem na mesma grade em vez de cada categoria
            ocupar uma seção de largura total com a linha quase vazia. */}
        {!loading && visibleServices.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}>
            {groupedServices.map(([categoryName, items], gi) => (
              <Fragment key={categoryName}>
                {/* Divisória de categoria (linha inteira da grade) */}
                <div style={{
                  gridColumn: "1 / -1",
                  display: "flex", alignItems: "center", gap: 8,
                  marginTop: gi === 0 ? 0 : 12,
                }}>
                  <Tag size={13} color="var(--c-text-4)" />
                  <h2 style={{
                    fontSize: 13, fontWeight: 700, color: "var(--c-text-2)",
                    margin: 0, letterSpacing: "-0.2px",
                  }}>
                    {categoryName}
                  </h2>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "var(--c-text-3)",
                    backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
                    borderRadius: 100, padding: "1px 8px",
                  }}>
                    {items.length}
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: "var(--c-border)" }} />
                </div>

                {items.map(s => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    deleting={deleting === s.id}
                  />
                ))}
              </Fragment>
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
            backgroundColor: "var(--c-surface)", border: "1px solid var(--c-border)",
            borderRadius: isMobile ? 16 : 20, padding: isMobile ? 20 : 28,
            width: "100%", maxWidth: 480,
            maxHeight: "90vh", overflowY: "auto",
            animation: "fadeIn 0.2s ease",
          }}>
            {/* Header do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--c-text)", margin: 0 }}>
                {showModal === "create" ? "Novo serviço" : "Editar serviço"}
              </h2>
              <button
                onClick={closeModal}
                style={{ background: "transparent", border: "none", color: "var(--c-text-3)", cursor: "pointer", padding: 4 }}
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

              {/* Categoria — sugestões via datalist + digitação livre */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>
                  Categoria
                </label>
                <input
                  list="service-category-suggestions"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  placeholder="Ex: Polimento (ou escolha uma sugestão)"
                  maxLength={40}
                  style={{
                    height: 42, backgroundColor: "var(--c-bg)",
                    border: "1px solid var(--c-border-2)",
                    borderRadius: 10, padding: "0 14px", fontSize: 14,
                    color: "var(--c-text)", outline: "none", width: "100%",
                    boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s ease",
                  }}
                  onFocus={e => { e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
                  onBlur={e  => { e.target.style.borderColor = "var(--c-border-2)" }}
                />
                <datalist id="service-category-suggestions">
                  {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

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

              {/* Repasse default ao funcionário ─────────────────────────── */}
              <div style={{
                background: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                      Repasse ao funcionário
                    </p>
                    <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                      % padrão que o funcionário recebe ao executar este serviço.
                      Pode ser sobrescrito por exceção individual em cada funcionário.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formCommissionPct}
                    onChange={(e) => setFormCommissionPct(e.target.value)}
                    placeholder="0"
                    style={{
                      width: 80, height: 36, padding: "0 10px",
                      background: "var(--c-surface)", border: "1px solid var(--c-border-2)",
                      borderRadius: 8, color: "var(--c-text)", fontSize: 13,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <span style={{ color: "var(--c-text-3)", fontSize: 13 }}>%</span>
                  {formPrice && formCommissionPct && Number(formCommissionPct) > 0 && !isNaN(Number(formPrice)) && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#10B981" }}>
                      = {formatCurrency(Math.floor(Number(formPrice) * 100 * Number(formCommissionPct) / 100))} por execução
                    </span>
                  )}
                  {!formCommissionPct && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--c-text-4)", fontStyle: "italic" }}>
                      sem repasse
                    </span>
                  )}
                </div>
              </div>

              {/* Garantia (proteção/legal) ──────────────────────────────── */}
              <div style={{
                background: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                    Garantia do serviço
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                    Dias de garantia/proteção (ex.: vitrificação 180). Vazio = sem garantia.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={formWarranty}
                    onChange={(e) => setFormWarranty(e.target.value)}
                    placeholder="0"
                    style={{
                      width: 80, height: 36, padding: "0 10px",
                      background: "var(--c-surface)", border: "1px solid var(--c-border-2)",
                      borderRadius: 8, color: "var(--c-text)", fontSize: 13,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <span style={{ color: "var(--c-text-3)", fontSize: 13 }}>dias</span>
                </div>
              </div>

              {/* CRM: Re-chamar o cliente (lembrete comercial de retorno) ──── */}
              <div style={{
                background: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                    Lembrar o cliente de voltar
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                    Re-chamar o cliente a cada quantos dias (ex.: lavagem 30, vitrificação 90).
                    Ao fechar a comanda, ele entra na sua aba Relacionamento perto da data. Vazio = não lembrar.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--c-text-3)", fontSize: 13 }}>a cada</span>
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={formRecall}
                    onChange={(e) => setFormRecall(e.target.value)}
                    placeholder="0"
                    style={{
                      width: 80, height: 36, padding: "0 10px",
                      background: "var(--c-surface)", border: "1px solid var(--c-border-2)",
                      borderRadius: 8, color: "var(--c-text)", fontSize: 13,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <span style={{ color: "var(--c-text-3)", fontSize: 13 }}>dias</span>
                  {formRecall && Number(formRecall) > 0 && (
                    <span style={{ fontSize: 12, color: "#10B981" }}>
                      entra na fila de relacionamento ~{Number(formRecall)} dias após o serviço
                    </span>
                  )}
                </div>
              </div>

              {/* V2-B4: Preço por porte de veículo ─────────────────────────── */}
              <div style={{
                background: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                borderRadius: 10, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>
                    Preço por porte <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>(opcional)</span>
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                    SUV/caminhonete costuma custar mais. Deixe vazio pra usar o preço base.
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {([["CAR", "Carro"], ["MOTORCYCLE", "Moto"], ["TRUCK", "Caminhonete"], ["SUV", "SUV"]] as const).map(([key, label]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--c-text-2)", width: 88, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 12, color: "var(--c-text-4)" }}>R$</span>
                      <input
                        type="number" min={0} step="0.01"
                        value={formPorte[key]}
                        onChange={(e) => setFormPorte(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={formPrice || "base"}
                        style={{
                          flex: 1, minWidth: 0, height: 34, padding: "0 10px",
                          background: "var(--c-surface)", border: "1px solid var(--c-border-2)",
                          borderRadius: 8, color: "var(--c-text)", fontSize: 13,
                          outline: "none", fontFamily: "inherit",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggle ativo */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-2)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text)", margin: 0 }}>Serviço ativo</p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                    {formActive ? "Aparece na loja pública" : "Oculto da loja pública"}
                  </p>
                </div>
                <div
                  onClick={() => setFormActive(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 100,
                    backgroundColor: formActive ? "#0066FF" : "var(--c-border-2)",
                    cursor: "pointer", position: "relative",
                    transition: "background 0.2s ease", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: formActive ? 22 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    backgroundColor: "var(--c-text)",
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
                  background: "transparent", border: "1px solid var(--c-border-2)",
                  color: "var(--c-text-2)", height: 40, padding: "0 16px",
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
                  color: "var(--c-on-primary)", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: saving ? 0.7 : 1,
                  display: "flex", gap: 8, alignItems: "center",
                  transition: "opacity 0.15s ease",
                }}
              >
                {saving ? (
                  <>
                    <style>{`@keyframes sp2 { to { transform:rotate(360deg); } }`}</style>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "var(--c-text)", animation: "sp2 0.6s linear infinite" }} />
                    Salvando...
                  </>
                ) : showModal === "create" ? "Criar serviço" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Confirmação de desativação ══════════════════════════════════════ */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setDeleteTarget(null) }}
        onConfirm={confirmDelete}
        title="Desativar serviço"
        description={deleteTarget ? `Desativar "${deleteTarget.name}"? Ele deixa de aparecer na loja pública.` : "Desativar este serviço?"}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting !== null}
      />
    </>
  )
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({
  service, onEdit, onDelete, deleting,
}: {
  service: Service
  onEdit: (s: Service) => void
  onDelete: (s: Service) => void
  deleting: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const range = priceRange(service)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "var(--c-surface)",
        border: `1px solid ${hovered ? "var(--c-border-2)" : "var(--c-border)"}`,
        borderRadius: 16, overflow: "hidden",
        transition: "border-color 0.15s ease",
        animation: "fadeIn 0.3s ease",
        opacity: service.isActive ? 1 : 0.55,
      }}
    >
      {/* Imagem do serviço — só renderiza quando há foto. Sem imagem, o card
          fica compacto (sem o bloco cinza grande que parecia quebrado quando
          todos os serviços nascem sem foto). */}
      {service.imageUrl && (
        <div style={{ height: 120, overflow: "hidden", borderBottom: "1px solid var(--c-surface-2)" }}>
          <img
            src={service.imageUrl}
            alt={service.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Conteúdo */}
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 700, color: "var(--c-text)", margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {service.name}
            </p>
            {service.description && (
              <p style={{
                fontSize: 12, color: "var(--c-text-3)", marginTop: 4,
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
            color: service.isActive ? "#10B981" : "var(--c-text-3)",
          }}>
            {service.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>

        {/* Preço + duração */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "baseline", flexWrap: "wrap" }}>
          {range.varies && (
            <span style={{ fontSize: 11, color: "var(--c-text-4)", alignSelf: "center" }}>a partir de</span>
          )}
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--c-text)" }}>
            {formatCurrency(range.min)}
          </span>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12, color: "var(--c-text-3)" }}>
            <Clock size={12} color="var(--c-text-4)" />
            {formatDuration(service.durationMinutes)}
          </span>
        </div>

        {/* Badges: categoria · porte variável · garantia · re-chamar · repasse (só dado que o back retorna) */}
        {((service.category ?? "").trim() || range.varies || (service.warrantyDays ?? 0) > 0 || (service.recallDays ?? 0) > 0 || (service.commissionPercent ?? 0) > 0) && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {(service.category ?? "").trim() && (
              <CardChip color="var(--c-text-2)" bg="var(--c-surface-2)" border="var(--c-border)" icon={<Tag size={11} />}>
                {(service.category ?? "").trim()}
              </CardChip>
            )}
            {range.varies && (
              <CardChip color="#0066FF" bg="rgba(0,102,255,0.08)" border="rgba(0,102,255,0.2)">
                Preço por porte
              </CardChip>
            )}
            {(service.warrantyDays ?? 0) > 0 && (
              <CardChip color="#10B981" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)" icon={<ShieldCheck size={11} />}>
                Garantia {service.warrantyDays}d
              </CardChip>
            )}
            {(service.recallDays ?? 0) > 0 && (
              <CardChip color="#EC4899" bg="rgba(236,72,153,0.08)" border="rgba(236,72,153,0.22)" icon={<Heart size={11} />}>
                Re-chamar {service.recallDays}d
              </CardChip>
            )}
            {(service.commissionPercent ?? 0) > 0 && (
              <CardChip color="#A78BFA" bg="rgba(124,58,237,0.08)" border="rgba(124,58,237,0.22)" icon={<Percent size={11} />}>
                Repasse {service.commissionPercent}%
              </CardChip>
            )}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          <button
            onClick={() => onEdit(service)}
            style={{
              flex: 1, height: 34, borderRadius: 10,
              backgroundColor: "var(--c-surface-2)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-2)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.15s ease", fontFamily: "inherit",
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.backgroundColor = "rgba(255,255,255,0.08)"
              b.style.color = "var(--c-text)"
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.backgroundColor = "rgba(255,255,255,0.04)"
              b.style.color = "var(--c-text-2)"
            }}
          >
            <Pencil size={12} />
            Editar
          </button>

          <button
            onClick={() => onDelete(service)}
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
// ─── StatBadge (espelha o padrão da tela de Clientes) ──────────────────────────

function StatBadge({
  value, label, color, bg, border,
}: {
  value: number; label: string; color: string; bg: string; border: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 6,
      backgroundColor: bg, border: `1px solid ${border}`,
      borderRadius: 10, padding: "7px 12px",
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{label}</span>
    </div>
  )
}

// ─── CardChip (badge compacto no card de serviço) ──────────────────────────────

function CardChip({
  children, color, bg, border, icon,
}: {
  children: ReactNode; color: string; bg: string; border: string; icon?: ReactNode
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
      backgroundColor: bg, border: `1px solid ${border}`, color,
    }}>
      {icon}{children}
    </span>
  )
}
