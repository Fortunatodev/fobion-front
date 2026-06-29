import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// connect-src precisa permitir o back. Em prod = só HTTPS (Railway + futuros
// api.forbion.digital). Em dev = QUALQUER porta localhost (back local 3000, e2e 3100,
// e futuros) — dev é local-only, então liberar localhost:* é seguro e evita o CSP
// bloquear o fetch quando NEXT_PUBLIC_API_URL aponta pra outra porta (era 3000 fixo).
// Sem isso, CSP bloqueia fetch e front mostra "Erro na autenticação".
const connectSrc = isDev
  ? "'self' https: wss: ws://localhost:* http://localhost:* http://127.0.0.1:*"
  : "'self' https: wss:";

const securityHeaders = [
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // CSP enxuto e funcional para o app atual. unsafe-inline em style é necessário
  // pelo Tailwind/JSX inline; unsafe-eval só em dev (Next dev tools).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-eval só em dev (Next dev tools). Em produção sai do CSP pra reduzir
      // superfície de XSS — o bundle de produção não precisa de eval().
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://utfs.io https://*.ufs.sh",
      "font-src 'self' https://fonts.gstatic.com data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Permite isolar o build da suíte e2e (NEXT_DIST_DIR=.next-e2e) do .next do dev/prod.
  // Sem isto o NEXT_DIST_DIR era IGNORADO → o front e2e usava .next e colidia com `next build`
  // (chunks 404/corrompidos). Agora a config Playwright realmente roda num dist separado.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      // UploadThing CDN (ufsUrl retornado pelo backend)
      { protocol: "https", hostname: "utfs.io" },
      // UploadThing US/EU CDN alternativo
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
