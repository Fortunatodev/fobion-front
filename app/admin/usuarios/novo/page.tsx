"use client"

import { useState } from "react"
import Link from "next/link"

// ── Config ────────────────────────────────────────────────────────────────────

const API          = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.forbion.digital"

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAdminToken(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|;\s*)admin-token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ""
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!"
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("")
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2)  return `(${digits}`
  if (digits.length <= 7)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`
  if (digits.length <= 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
  return value
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateResult {
  message:  string
  business: { id: string; name: string; slug: string }
  user:     { id: string; name: string; email: string; role: string }
}

interface FormState {
  businessName:  string
  ownerName:     string
  ownerEmail:    string
  businessPhone: string
  password:      string
}

const EMPTY_FORM: FormState = {
  businessName:  "",
  ownerName:     "",
  ownerEmail:    "",
  businessPhone: "",
  password:      "",
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NovoUsuarioPage() {
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [result,     setResult]     = useState<(CreateResult & { plainPassword: string }) | null>(null)
  const [showPass,   setShowPass]   = useState(false)
  const [copied,     setCopied]     = useState(false)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleChange(field: keyof FormState, value: string) {
    if (field === "businessPhone") {
      setForm(prev => ({ ...prev, businessPhone: formatPhone(value) }))
    } else {
      setForm(prev => ({ ...prev, [field]: value }))
    }
  }

  function handleGeneratePassword() {
    const pwd = generatePassword()
    setForm(prev => ({ ...prev, password: pwd }))
    setShowPass(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Remove máscara do telefone antes de enviar
    const phoneDigits = form.businessPhone.replace(/\D/g, "")

    try {
      const res = await fetch(`${API}/api/auth/register-business`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "x-admin-token": getAdminToken(),
        },
        body: JSON.stringify({
          businessName:  form.businessName.trim(),
          ownerName:     form.ownerName.trim(),
          ownerEmail:    form.ownerEmail.trim().toLowerCase(),
          businessEmail: form.ownerEmail.trim().toLowerCase(),
          businessPhone: phoneDigits,
          password:      form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`)
        return
      }

      setResult({ ...data, plainPassword: form.password })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }

  function handleCopyCredentials() {
    if (!result) return
    const text = [
      `✅ Negócio criado com sucesso!`,
      ``,
      `🏪 ${result.business.name}`,
      `👤 ${result.user.name}`,
      `📧 ${result.user.email}`,
      `🔑 Senha: ${result.plainPassword}`,
      `🔗 Acesso: ${FRONTEND_URL}/auth/login`,
    ].join("\n")

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handleReset() {
    setForm(EMPTY_FORM)
    setResult(null)
    setError(null)
    setCopied(false)
  }

  // ── Render: Sucesso ───────────────────────────────────────────────────────────

  if (result) {
    return (
      <div style={styles.pageWrap}>
        <div style={styles.card}>

          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <Link href="/admin" style={styles.backBtn}>← Voltar</Link>
            <h1 style={styles.title}>Novo Usuário</h1>
          </div>

          {/* Card de sucesso */}
          <div style={styles.successCard}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#10B981", marginBottom: 20 }}>
              Negócio criado com sucesso!
            </h2>

            <div style={styles.credentialGrid}>
              <CredentialRow icon="🏪" label="Negócio"  value={result.business.name} />
              <CredentialRow icon="🐌" label="Slug"     value={result.business.slug} />
              <CredentialRow icon="👤" label="Dono"     value={result.user.name} />
              <CredentialRow icon="📧" label="E-mail"   value={result.user.email} />
              <CredentialRow icon="🔑" label="Senha"    value={result.plainPassword} mono />
              <CredentialRow icon="🔗" label="Acesso"   value={`${FRONTEND_URL}/auth/login`} />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
              <button
                onClick={handleCopyCredentials}
                style={{ ...styles.btn, background: copied ? "#059669" : "#0066FF" }}
              >
                {copied ? "✅ Copiado!" : "📋 Copiar credenciais"}
              </button>
              <button onClick={handleReset} style={{ ...styles.btn, background: "#27272A" }}>
                ➕ Criar outro negócio
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Formulário ────────────────────────────────────────────────────────

  return (
    <div style={styles.pageWrap}>
      <div style={styles.card}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Link href="/admin" style={styles.backBtn}>← Voltar</Link>
          <h1 style={styles.title}>Novo Usuário / Negócio</h1>
        </div>

        {/* Erro */}
        {error && (
          <div style={styles.errorBox}>
            <strong>❌ Erro:</strong> {error}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          <Field
            label="Nome do negócio *"
            placeholder="Ex: Estética do João"
            value={form.businessName}
            onChange={v => handleChange("businessName", v)}
            required
          />

          <Field
            label="Nome do responsável *"
            placeholder="Ex: João Silva"
            value={form.ownerName}
            onChange={v => handleChange("ownerName", v)}
            required
          />

          <Field
            label="E-mail do responsável *"
            type="email"
            placeholder="joao@email.com"
            value={form.ownerEmail}
            onChange={v => handleChange("ownerEmail", v)}
            required
          />

          <Field
            label="Telefone *"
            placeholder="(47) 99999-0001"
            value={form.businessPhone}
            onChange={v => handleChange("businessPhone", v)}
            required
          />

          {/* Senha com botão gerar */}
          <div>
            <label style={styles.label}>Senha provisória * (mín. 8 caracteres)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => handleChange("password", e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  style={{ ...styles.input, paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={styles.showPassBtn}
                >
                  {showPass ? "ocultar" : "ver"}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGeneratePassword}
                title="Gerar senha segura aleatória"
                style={styles.generateBtn}
              >
                🎲 Gerar
              </button>
            </div>
            {form.password && form.password.length < 8 && (
              <p style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>
                A senha precisa ter pelo menos 8 caracteres.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn,
              background:    loading ? "#1A1A2E" : "#0066FF",
              color:         loading ? "#3F3F46" : "#fff",
              cursor:        loading ? "not-allowed" : "pointer",
              marginTop:     8,
            }}
          >
            {loading ? "Criando conta..." : "✅ Criar negócio"}
          </button>
        </form>

        {/* Nota */}
        <p style={{ fontSize: 11, color: "#52525B", marginTop: 20, lineHeight: 1.6 }}>
          Após a criação, envie o e-mail e a senha para o cliente.
          O cliente pode alterar a senha após o primeiro login em{" "}
          <strong style={{ color: "#71717A" }}>{FRONTEND_URL}/auth/login</strong>.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={styles.input}
        onFocus={e => { e.currentTarget.style.borderColor = "#0066FF" }}
        onBlur={e  => { e.currentTarget.style.borderColor = "#27272A" }}
      />
    </div>
  )
}

function CredentialRow({
  icon, label, value, mono = false,
}: {
  icon: string
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div style={styles.credRow}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ color: "#71717A", fontSize: 13, minWidth: 60 }}>{label}</span>
      <span style={{
        color:      "#FAFAFA",
        fontSize:   13,
        fontFamily: mono ? "'Courier New', monospace" : "inherit",
        fontWeight: mono ? 700 : 400,
        wordBreak:  "break-all",
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  pageWrap: {
    minHeight:   "100vh",
    background:  "#09090B",
    display:     "flex",
    alignItems:  "flex-start",
    justifyContent: "center",
    padding:     "40px 16px",
    fontFamily:  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width:        "100%",
    maxWidth:     520,
    background:   "#111",
    border:       "1px solid #1F1F1F",
    borderRadius: 20,
    padding:      "36px 32px",
    color:        "#FAFAFA",
  },
  title: {
    fontSize:   20,
    fontWeight: 700,
    color:      "#FAFAFA",
    margin:     0,
  },
  backBtn: {
    fontSize:     13,
    color:        "#71717A",
    textDecoration: "none",
    padding:      "4px 10px",
    border:       "1px solid #27272A",
    borderRadius: 8,
    background:   "transparent",
    cursor:       "pointer",
    whiteSpace:   "nowrap",
  },
  label: {
    display:      "block",
    fontSize:     12,
    color:        "#A1A1AA",
    marginBottom: 6,
    fontWeight:   500,
  },
  input: {
    width:        "100%",
    height:       44,
    background:   "#0A0A0A",
    border:       "1px solid #27272A",
    borderRadius: 10,
    padding:      "0 14px",
    fontSize:     14,
    color:        "#FAFAFA",
    outline:      "none",
    fontFamily:   "inherit",
    boxSizing:    "border-box",
    transition:   "border-color 0.2s",
  },
  showPassBtn: {
    position:   "absolute",
    right:      10,
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    color:      "#71717A",
    fontSize:   12,
    padding:    "4px 6px",
  },
  generateBtn: {
    height:       44,
    padding:      "0 16px",
    background:   "#1A1A2E",
    border:       "1px solid #2D2D5E",
    borderRadius: 10,
    color:        "#818CF8",
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    fontFamily:   "inherit",
    transition:   "background 0.2s",
  },
  btn: {
    height:       46,
    padding:      "0 20px",
    border:       "none",
    borderRadius: 12,
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   "inherit",
    transition:   "all 0.2s",
    color:        "#fff",
    display:      "inline-flex",
    alignItems:   "center",
    gap:          8,
  },
  errorBox: {
    background:   "rgba(239,68,68,0.08)",
    border:       "1px solid rgba(239,68,68,0.25)",
    borderRadius: 12,
    padding:      "12px 16px",
    fontSize:     13,
    color:        "#EF4444",
    marginBottom: 20,
    lineHeight:   1.5,
  },
  successCard: {
    background:   "rgba(16,185,129,0.05)",
    border:       "1px solid rgba(16,185,129,0.2)",
    borderRadius: 16,
    padding:      "28px 24px",
    textAlign:    "center",
  },
  credentialGrid: {
    background:   "#0A0A0A",
    border:       "1px solid #1F1F1F",
    borderRadius: 12,
    padding:      "16px",
    display:      "flex",
    flexDirection: "column",
    gap:          12,
    textAlign:    "left",
  },
  credRow: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        12,
  },
}
