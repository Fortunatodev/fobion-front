"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, User, Car, Phone, Mail,
  ChevronRight, Edit3, X, AlertCircle, Calendar,
} from "lucide-react"
import { apiGet, apiPost, apiPut } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  color: string
  type: "CAR" | "MOTORCYCLE" | "TRUCK" | "SUV"
}

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  createdAt: string
  vehicles: Vehicle[]
  _count?: { schedules: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

// ── Input Component ───────────────────────────────────────────────────────────

function FieldInput({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 42, backgroundColor: "#0A0A0A",
          border: `1px solid ${focused ? "#0066FF" : "#252525"}`,
          borderRadius: 10, padding: "0 14px",
          fontSize: 14, color: "#ffffff",
          outline: "none", width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s ease",
          fontFamily: "inherit",
        }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────

  const [customers,         setCustomers]         = useState<Customer[]>([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [searchQuery,       setSearchQuery]       = useState("")
  const [showModal,         setShowModal]         = useState<"create" | "edit" | "vehicle" | null>(null)
  const [selectedCustomer,  setSelectedCustomer]  = useState<Customer | null>(null)
  const [actionLoading,     setActionLoading]     = useState(false)
  const [formError,         setFormError]         = useState<string | null>(null)
  const [hoveredId,         setHoveredId]         = useState<string | null>(null)
  const [isMobile,          setIsMobile]          = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Form — customer
  const [formName,  setFormName]  = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")

  // Form — vehicle
  const [vehiclePlate, setVehiclePlate] = useState("")
  const [vehicleBrand, setVehicleBrand] = useState("")
  const [vehicleModel, setVehicleModel] = useState("")
  const [vehicleColor, setVehicleColor] = useState("")
  const [vehicleType,  setVehicleType]  = useState("CAR")

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ customers: Customer[] }>("/customers")
      setCustomers(res.customers ?? [])
      setError(null)
    } catch {
      setError("Erro ao carregar clientes. Verifique sua conexão.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // ── Actions ────────────────────────────────────────────────────────────────

  function closeModal() {
    setShowModal(null); setSelectedCustomer(null)
    setFormName(""); setFormPhone(""); setFormEmail("")
    setVehiclePlate(""); setVehicleBrand(""); setVehicleModel("")
    setVehicleColor(""); setVehicleType("CAR"); setFormError(null)
  }

  function openEditModal(customer: Customer) {
    setSelectedCustomer(customer)
    setFormName(customer.name)
    setFormPhone(customer.phone)
    setFormEmail(customer.email ?? "")
    setShowModal("edit")
  }

  async function handleCreateCustomer() {
    // Apenas nome é obrigatório no fluxo manual. Telefone e e-mail são opcionais.
    if (!formName.trim()) { setFormError("Nome é obrigatório."); return }
    setActionLoading(true)
    try {
      await apiPost("/customers", {
        name:  formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
      })
      closeModal()
      await fetchCustomers()
    } catch (e: unknown) {
      // Mostra a mensagem retornada pelo backend (já tratada pelo axios interceptor)
      setFormError(e instanceof Error ? e.message : "Erro ao criar cliente. Verifique os dados.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEditCustomer() {
    if (!selectedCustomer) return
    if (!formName.trim()) { setFormError("Nome é obrigatório."); return }
    setActionLoading(true)
    try {
      await apiPut(`/customers/${selectedCustomer.id}`, {
        name:  formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
      })
      closeModal()
      await fetchCustomers()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro ao atualizar cliente.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddVehicle() {
    if (!selectedCustomer) return
    if (!vehiclePlate.trim() || !vehicleBrand.trim() || !vehicleModel.trim() || !vehicleColor.trim()) {
      setFormError("Preencha todos os campos do veículo."); return
    }
    setActionLoading(true)
    try {
      await apiPost(`/customers/${selectedCustomer.id}/vehicles`, {
        plate: vehiclePlate.trim().toUpperCase(),
        brand: vehicleBrand.trim(),
        model: vehicleModel.trim(),
        color: vehicleColor.trim(),
        type:  vehicleType,
      })
      closeModal()
      await fetchCustomers()
    } catch {
      setFormError("Erro ao adicionar veículo.")
    } finally {
      setActionLoading(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = customers.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email?.toLowerCase().includes(q)) ||
      c.vehicles.some((v) => v.plate.toLowerCase().includes(q))
    )
  })

  // ── Render helpers ─────────────────────────────────────────────────────────

  const withVehicles    = customers.filter((c) => c.vehicles.length > 0).length
  const withoutVehicles = customers.filter((c) => c.vehicles.length === 0).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes slideUpModal {
          from { opacity: 0; transform: translate(-50%, -44%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
        @keyframes fadePage {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        input::placeholder { color: #3F3F46; }
        select option { background: #111111; }
      `}</style>

      <div
        style={{
          maxWidth:   1280,
          margin:     "0 auto",
          padding:    isMobile ? "16px 14px" : undefined,
          animation:  "fadePage 0.35s ease both",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display:        "flex",
            justifyContent: "space-between",
            alignItems:     "flex-start",
            flexWrap:       "wrap",
            gap:            isMobile ? 12 : 16,
            marginBottom:   isMobile ? 20 : 32,
            flexDirection:  isMobile ? "column" : "row",
          }}
        >
          <div>
            <h1
              style={{
                fontSize:      isMobile ? 22 : 28,
                fontWeight:    800,
                color:         "#ffffff",
                margin:        0,
                letterSpacing: "-0.5px",
              }}
            >
              Clientes
            </h1>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
              {loading ? "Carregando..." : `${customers.length} cliente${customers.length !== 1 ? "s" : ""} cadastrado${customers.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <ButtonPrimary onClick={() => setShowModal("create")}>
            <Plus size={15} />
            Novo cliente
          </ButtonPrimary>
        </div>

        {/* ── SEARCH + STATS ──────────────────────────────────────────────── */}
        <div
          style={{
            display:     "flex",
            gap:         12,
            marginBottom: 20,
            flexWrap:    "wrap",
            alignItems:  "center",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          {/* Search */}
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 240, position: "relative", width: isMobile ? "100%" : undefined }}>
            <Search
              size={14}
              color="#52525B"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone, placa..."
              style={{
                width:           "100%",
                height:          40,
                backgroundColor: "#111111",
                border:          "1px solid #1F1F1F",
                borderRadius:    12,
                paddingLeft:     36,
                paddingRight:    14,
                fontSize:        13,
                color:           "#ffffff",
                outline:         "none",
                boxSizing:       "border-box",
                fontFamily:      "inherit",
              }}
              onFocus={(e)  => { e.target.style.borderColor = "rgba(0,102,255,0.4)" }}
              onBlur={(e)   => { e.target.style.borderColor = "#1F1F1F" }}
            />
          </div>

          {/* Stats badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatBadge value={customers.length} label="Total" color="#A1A1AA" bg="#111111" border="#1F1F1F" />
            <StatBadge value={withVehicles}    label="Com veículo" color="#0066FF" bg="rgba(0,102,255,0.06)" border="rgba(0,102,255,0.2)" />
            <StatBadge value={withoutVehicles} label="Sem veículo" color="#F59E0B" bg="rgba(245,158,11,0.06)" border="rgba(245,158,11,0.2)" />
          </div>
        </div>

        {/* ── ERROR BANNER ────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              backgroundColor: "rgba(239,68,68,0.08)",
              border:          "1px solid rgba(239,68,68,0.2)",
              borderRadius:    12,
              padding:         "12px 16px",
              marginBottom:    20,
              display:         "flex",
              alignItems:      "center",
              gap:             10,
            }}
          >
            <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#EF4444", flex: 1 }}>{error}</span>
            <button
              onClick={fetchCustomers}
              style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── LOADING SKELETONS ────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height:          80,
                  backgroundColor: "#111111",
                  border:          "1px solid #1F1F1F",
                  borderRadius:    16,
                  animation:       `skeletonPulse 1.5s ease-in-out infinite`,
                  animationDelay:  `${i * 0.07}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ─────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <User size={40} color="#1F1F1F" style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginTop: 16 }}>
              {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </p>
            {searchQuery ? (
              <p style={{ fontSize: 13, color: "#71717A", marginTop: 6 }}>
                Tente buscar por outro termo
              </p>
            ) : (
              <button
                onClick={() => setShowModal("create")}
                style={{
                  marginTop:    16,
                  padding:      "10px 20px",
                  background:   "linear-gradient(135deg, #0066FF, #7C3AED)",
                  border:       "none",
                  borderRadius: 12,
                  color:        "white",
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       "pointer",
                }}
              >
                Cadastrar primeiro cliente
              </button>
            )}
          </div>
        )}

        {/* ── CUSTOMER LIST ────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((customer) => {
              const hov = hoveredId === customer.id
              const visibleVehicles = customer.vehicles.slice(0, 2)
              const extraVehicles   = customer.vehicles.length - 2

              return (
                <div
                  key={customer.id}
                  onMouseEnter={() => setHoveredId(customer.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    backgroundColor: "#111111",
                    border:          `1px solid ${hov ? "#252525" : "#1F1F1F"}`,
                    borderRadius:    16,
                    padding:         isMobile ? "14px 14px" : "14px 18px",
                    display:         "flex",
                    alignItems:      isMobile ? "flex-start" : "center",
                    flexDirection:   isMobile ? "column" : "row",
                    gap:             isMobile ? 12 : 14,
                    cursor:          "default",
                    transform:       hov ? "translateY(-1px)" : "translateY(0)",
                    boxShadow:       hov ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
                    transition:      "all 0.18s ease",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width:           42,
                      height:          42,
                      borderRadius:    12,
                      background:      "linear-gradient(135deg,rgba(0,102,255,0.15),rgba(124,58,237,0.15))",
                      border:          "1px solid rgba(0,102,255,0.15)",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      fontSize:        15,
                      fontWeight:      700,
                      color:           "#0066FF",
                      flexShrink:      0,
                      userSelect:      "none",
                    }}
                  >
                    {getInitials(customer.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                        {customer.name}
                      </span>
                      {(customer._count?.schedules ?? 0) > 0 && (
                        <span
                          style={{
                            fontSize:        10,
                            fontWeight:      600,
                            color:           "#0066FF",
                            backgroundColor: "rgba(0,102,255,0.1)",
                            border:          "1px solid rgba(0,102,255,0.2)",
                            borderRadius:    99,
                            padding:         "1px 6px",
                          }}
                        >
                          {customer._count?.schedules} OS
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display:   "flex",
                        gap:       14,
                        marginTop: 5,
                        flexWrap:  "wrap",
                        alignItems:"center",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Phone size={11} color="#52525B" />
                        <span style={{ fontSize: 12, color: "#71717A" }}>{customer.phone}</span>
                      </span>

                      {customer.email && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                          <Mail size={11} color="#52525B" />
                          <span
                            style={{
                              fontSize:    12,
                              color:       "#71717A",
                              overflow:    "hidden",
                              textOverflow:"ellipsis",
                              whiteSpace:  "nowrap",
                              maxWidth:    180,
                            }}
                          >
                            {customer.email}
                          </span>
                        </span>
                      )}

                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={11} color="#52525B" />
                        <span style={{ fontSize: 12, color: "#52525B" }}>
                          desde {formatDate(customer.createdAt)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Vehicles */}
                  <div
                    style={{
                      display:    "flex",
                      gap:        6,
                      flexWrap:   "wrap",
                      flexShrink: 0,
                      alignItems: "center",
                    }}
                  >
                    {customer.vehicles.length === 0 ? (
                      <span
                        style={{
                          fontSize:        11,
                          color:           "#3F3F46",
                          backgroundColor: "#161616",
                          border:          "1px solid #1F1F1F",
                          borderRadius:    6,
                          padding:         "3px 8px",
                        }}
                      >
                        Sem veículo
                      </span>
                    ) : (
                      <>
                        {visibleVehicles.map((v) => (
                          <span
                            key={v.id}
                            style={{
                              fontSize:        11,
                              fontWeight:      500,
                              color:           "#A1A1AA",
                              backgroundColor: "#161616",
                              border:          "1px solid #1F1F1F",
                              borderRadius:    6,
                              padding:         "3px 8px",
                              display:         "flex",
                              alignItems:      "center",
                              gap:             5,
                            }}
                          >
                            <Car size={10} color="#52525B" />
                            {v.plate}
                          </span>
                        ))}
                        {extraVehicles > 0 && (
                          <span
                            style={{
                              fontSize:        11,
                              color:           "#52525B",
                              backgroundColor: "#161616",
                              border:          "1px solid #1F1F1F",
                              borderRadius:    6,
                              padding:         "3px 6px",
                            }}
                          >
                            +{extraVehicles}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, width: isMobile ? "100%" : undefined, justifyContent: isMobile ? "flex-end" : undefined }}>
                    <IconBtn
                      title="Adicionar veículo"
                      bg="rgba(0,102,255,0.08)"
                      border="rgba(0,102,255,0.2)"
                      color="#0066FF"
                      hoverBg="rgba(0,102,255,0.16)"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCustomer(customer)
                        setShowModal("vehicle")
                      }}
                    >
                      <Car size={14} />
                    </IconBtn>

                    <IconBtn
                      title="Editar cliente"
                      bg="#161616"
                      border="#252525"
                      color="#A1A1AA"
                      hoverBg="#1F1F1F"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(customer)
                      }}
                    >
                      <Edit3 size={14} />
                    </IconBtn>

                    <IconBtn
                      title="Ver detalhes"
                      bg="#161616"
                      border="#252525"
                      color="#A1A1AA"
                      hoverBg="#1F1F1F"
                      onClick={() => router.push(`/dashboard/clientes/${customer.id}`)}
                    >
                      <ChevronRight size={14} />
                    </IconBtn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {showModal !== null && (
        <>
          {/* Overlay */}
          <div
            onClick={closeModal}
            style={{
              position:            "fixed",
              inset:               0,
              background:          "rgba(0,0,0,0.8)",
              backdropFilter:      "blur(8px)",
              WebkitBackdropFilter:"blur(8px)",
              zIndex:              100,
            }}
          />

          {/* Modal panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position:        "fixed",
              top:             "50%",
              left:            "50%",
              transform:       "translate(-50%,-50%)",
              backgroundColor: "#111111",
              border:          "1px solid #1F1F1F",
              borderRadius:    isMobile ? 16 : 20,
              padding:         isMobile ? 20 : 28,
              width:           isMobile ? "calc(100% - 32px)" : "100%",
              maxWidth:        440,
              maxHeight:       "90vh",
              overflowY:       "auto",
              zIndex:          101,
              boxShadow:       "0 32px 64px rgba(0,0,0,0.7)",
              animation:       "slideUpModal 0.3s cubic-bezier(0.16,1,0.3,1)",
              boxSizing:       "border-box",
              fontFamily:      "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >

            {/* ── Modal: Create / Edit ─────────────────────────────────── */}
            {(showModal === "create" || showModal === "edit") && (
              <>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    {showModal === "create" ? "Novo cliente" : "Editar cliente"}
                  </h2>
                  <button onClick={closeModal} style={closeButtonStyle}>
                    <X size={16} />
                  </button>
                </div>

                {/* Form error */}
                {formError && <FormErrorBanner message={formError} />}

                {/* Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FieldInput label="Nome completo" value={formName} onChange={setFormName} placeholder="João da Silva" required />
                  <FieldInput label="Telefone" value={formPhone} onChange={setFormPhone} placeholder="(47) 99999-0000" />
                  <FieldInput label="E-mail" value={formEmail} onChange={setFormEmail} placeholder="cliente@email.com (opcional)" />
                </div>

                {/* Footer */}
                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <CancelBtn onClick={closeModal} />
                  <SubmitBtn
                    loading={actionLoading}
                    label={showModal === "create" ? "Criar cliente" : "Salvar alterações"}
                    loadingLabel={showModal === "create" ? "Criando..." : "Salvando..."}
                    onClick={showModal === "create" ? handleCreateCustomer : handleEditCustomer}
                    gradient="linear-gradient(135deg, #0066FF, #7C3AED)"
                  />
                </div>
              </>
            )}

            {/* ── Modal: Add Vehicle ───────────────────────────────────── */}
            {showModal === "vehicle" && (
              <>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                      Adicionar veículo
                    </h2>
                    {selectedCustomer && (
                      <p style={{ fontSize: 13, color: "#71717A", marginTop: 4 }}>
                        para {selectedCustomer.name}
                      </p>
                    )}
                  </div>
                  <button onClick={closeModal} style={closeButtonStyle}>
                    <X size={16} />
                  </button>
                </div>

                {/* Form error */}
                {formError && <FormErrorBanner message={formError} />}

                {/* Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <FieldInput
                    label="Placa"
                    value={vehiclePlate}
                    onChange={(v) => setVehiclePlate(v.toUpperCase())}
                    placeholder="ABC-1234"
                    required
                  />

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    <FieldInput label="Marca" value={vehicleBrand} onChange={setVehicleBrand} placeholder="Honda" required />
                    <FieldInput label="Modelo" value={vehicleModel} onChange={setVehicleModel} placeholder="Civic" required />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    <FieldInput label="Cor" value={vehicleColor} onChange={setVehicleColor} placeholder="Prata" required />

                    {/* Type select */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#A1A1AA", marginBottom: 6 }}>
                        Tipo
                      </label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        style={{
                          height:          42,
                          backgroundColor: "#0A0A0A",
                          border:          "1px solid #252525",
                          borderRadius:    10,
                          padding:         "0 14px",
                          fontSize:        14,
                          color:           "#ffffff",
                          outline:         "none",
                          cursor:          "pointer",
                          fontFamily:      "inherit",
                          appearance:      "none",
                          WebkitAppearance:"none",
                          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                          backgroundRepeat:"no-repeat",
                          backgroundPosition:"right 12px center",
                        }}
                      >
                        <option value="CAR">Carro</option>
                        <option value="MOTORCYCLE">Moto</option>
                        <option value="TRUCK">Caminhão</option>
                        <option value="SUV">SUV</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <CancelBtn onClick={closeModal} />
                  <SubmitBtn
                    loading={actionLoading}
                    label="Adicionar veículo"
                    loadingLabel="Adicionando..."
                    onClick={handleAddVehicle}
                    gradient="linear-gradient(135deg, #10B981, #059669)"
                  />
                </div>
              </>
            )}

          </div>
        </>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const closeButtonStyle: React.CSSProperties = {
  background:   "rgba(255,255,255,0.05)",
  border:       "1px solid #252525",
  borderRadius: 8,
  width:        32,
  height:       32,
  display:      "flex",
  alignItems:   "center",
  justifyContent:"center",
  cursor:       "pointer",
  color:        "#71717A",
  flexShrink:   0,
}

function FormErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        backgroundColor: "rgba(239,68,68,0.08)",
        border:          "1px solid rgba(239,68,68,0.2)",
        borderRadius:    10,
        padding:         "10px 14px",
        marginBottom:    16,
        display:         "flex",
        alignItems:      "center",
        gap:             8,
      }}
    >
      <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#EF4444" }}>{message}</span>
    </div>
  )
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height:          40,
        padding:         "0 18px",
        borderRadius:    10,
        fontSize:        13,
        fontWeight:      600,
        cursor:          "pointer",
        background:      "transparent",
        border:          "1px solid #252525",
        color:           hov ? "#ffffff" : "#A1A1AA",
        transition:      "color 0.15s ease",
        fontFamily:      "inherit",
      }}
    >
      Cancelar
    </button>
  )
}

function SubmitBtn({
  loading, label, loadingLabel, onClick, gradient,
}: {
  loading: boolean; label: string; loadingLabel: string
  onClick: () => void; gradient: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        height:       40,
        padding:      "0 18px",
        borderRadius: 10,
        fontSize:     13,
        fontWeight:   600,
        cursor:       loading ? "not-allowed" : "pointer",
        background:   gradient,
        border:       "none",
        color:        "white",
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        opacity:      loading ? 0.7 : 1,
        transition:   "opacity 0.15s ease",
        fontFamily:   "inherit",
      }}
    >
      {loading && (
        <span
          style={{
            width:           14,
            height:          14,
            borderRadius:    "50%",
            border:          "2px solid rgba(255,255,255,0.3)",
            borderTopColor:  "white",
            animation:       "spin 0.7s linear infinite",
            display:         "inline-block",
            flexShrink:      0,
          }}
        />
      )}
      {loading ? loadingLabel : label}
    </button>
  )
}

function ButtonPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           8,
        background:    "linear-gradient(135deg, #0066FF, #7C3AED)",
        border:        "none",
        borderRadius:  12,
        padding:       "10px 18px",
        color:         "white",
        fontSize:      14,
        fontWeight:    600,
        cursor:        "pointer",
        boxShadow:     hov ? "0 8px 30px rgba(0,102,255,0.5)" : "0 4px 20px rgba(0,102,255,0.3)",
        transform:     hov ? "scale(1.02)" : "scale(1)",
        transition:    "all 0.2s ease",
        fontFamily:    "inherit",
      }}
    >
      {children}
    </button>
  )
}

function StatBadge({
  value, label, color, bg, border,
}: {
  value: number; label: string; color: string; bg: string; border: string
}) {
  return (
    <div
      style={{
        fontSize:        12,
        fontWeight:      600,
        color,
        backgroundColor: bg,
        border:          `1px solid ${border}`,
        borderRadius:    8,
        padding:         "6px 12px",
        display:         "flex",
        gap:             6,
        alignItems:      "center",
        whiteSpace:      "nowrap",
      }}
    >
      <span>{value}</span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>{label}</span>
    </div>
  )
}

function IconBtn({
  children, title, bg, border, color, hoverBg, onClick,
}: {
  children: React.ReactNode; title: string
  bg: string; border: string; color: string; hoverBg: string
  onClick: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:           32,
        height:          32,
        borderRadius:    8,
        backgroundColor: hov ? hoverBg : bg,
        border:          `1px solid ${border}`,
        color,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        cursor:          "pointer",
        transition:      "background-color 0.15s ease",
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}