"use client"

import { useState, useRef } from "react"
import { Upload, X, ImageIcon, Loader2 } from "lucide-react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/** Upload via backend route POST /api/upload/service-image (multer + UTApi).
 *  Mesma abordagem que já funciona no upload do avatar do proprietário. */
async function uploadToBackend(file: File): Promise<string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("forbion_token")
    : null

  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API}/api/upload/service-image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? "Falha no upload.")
  }

  const { url } = await res.json() as { url: string }
  if (!url) throw new Error("Upload retornou URL vazia.")
  return url
}

/** Persiste imageUrl no backend via PUT /api/services/:id */
async function saveImageUrl(serviceId: string, imageUrl: string | null): Promise<void> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("forbion_token")
    : null

  const res = await fetch(`${API}/api/services/${serviceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ imageUrl }),
  })

  if (!res.ok) throw new Error("Erro ao salvar imagem no serviço.")
}

interface Props {
  serviceId: string       // passa "" (string vazia) no modo criar — sem PUT após upload
  currentImageUrl: string | null
  onUploadComplete: (url: string) => void
}

export default function ServiceImageUpload({
  serviceId,
  currentImageUrl,
  onUploadComplete,
}: Props) {
  const [preview,   setPreview]   = useState<string | null>(currentImageUrl)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [hovered,   setHovered]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 4MB.")
      return
    }

    setError(null)
    setUploading(true)

    // Preview local imediato (base64) enquanto o upload acontece
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      const url = await uploadToBackend(file)

      // Atualiza preview com URL real
      setPreview(url)

      // Persiste no backend apenas se já existe um serviceId (modo edição)
      if (serviceId) {
        await saveImageUrl(serviceId, url)
      }
      onUploadComplete(url)
    } catch (e) {
      console.error("[ServiceImageUpload] erro:", e)
      setError(e instanceof Error ? e.message : "Erro no upload. Tente novamente.")
      // Reverte preview para o original
      setPreview(currentImageUrl)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const prev = preview
    setPreview(null)
    try {
      // Apenas persiste a remoção no backend se existe um serviço salvo
      if (serviceId) {
        await saveImageUrl(serviceId, null)
      }
      onUploadComplete("")
    } catch {
      setError("Erro ao remover imagem.")
      setPreview(prev) // reverte
    }
  }

  return (
    <div>
      <style>{`@keyframes svc-spin { to { transform: rotate(360deg); } }`}</style>

      <label style={{
        fontSize: 12, fontWeight: 500, color: "#A1A1AA",
        marginBottom: 8, display: "block",
      }}>
        Imagem do serviço
      </label>

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative", width: "100%", height: 160,
          borderRadius: 12, overflow: "hidden",
          border: `1px solid ${error ? "rgba(239,68,68,0.4)" : hovered && !uploading ? "#3F3F46" : "#252525"}`,
          background: "#0A0A0A",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "border-color 0.2s ease",
        }}
      >
        {/* ── Preview ────────────────────────────────────────────────────── */}
        {preview && !uploading && (
          <>
            <img
              src={preview}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />

            {/* Overlay hover */}
            <div style={{
              position: "absolute", inset: 0,
              background: hovered ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 6,
              transition: "background 0.2s ease",
            }}>
              {hovered && (
                <>
                  <Upload size={20} color="#fff" />
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
                    Alterar imagem
                  </span>
                </>
              )}
            </div>

            {/* Botão remover */}
            <button
              onClick={handleRemove}
              style={{
                position: "absolute", top: 8, right: 8,
                width: 26, height: 26, borderRadius: "50%",
                background: "rgba(0,0,0,0.7)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#fff", zIndex: 10,
              }}
            >
              <X size={12} />
            </button>
          </>
        )}

        {/* ── Estado vazio ───────────────────────────────────────────────── */}
        {!preview && !uploading && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "100%", gap: 8,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: hovered ? "#1F1F1F" : "#161616",
              border: "1px solid #1F1F1F",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s ease",
            }}>
              <ImageIcon size={18} color="#3F3F46" />
            </div>
            <span style={{ fontSize: 13, color: "#52525B", fontWeight: 500 }}>
              Clique para adicionar imagem
            </span>
            <span style={{ fontSize: 11, color: "#3F3F46" }}>
              PNG, JPG, WEBP até 4MB
            </span>
          </div>
        )}

        {/* ── Uploading ──────────────────────────────────────────────────── */}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <Loader2
              size={24}
              color="#0066FF"
              style={{ animation: "svc-spin 0.7s linear infinite" }}
            />
            <span style={{ fontSize: 13, color: "#A1A1AA" }}>
              Enviando imagem...
            </span>
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "#EF4444", marginTop: 6 }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
