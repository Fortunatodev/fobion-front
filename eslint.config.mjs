import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // O harness e2e (Playwright) é não-rastreado e só roda local; não entra no build do Vercel.
  globalIgnores(["e2e/**", "playwright.config.ts"]),
  {
    rules: {
      // Desabilitado — usamos <img> em vários lugares com URLs externas (Google, etc.)
      // Migrar para next/image exigiria configurar remotePatterns para cada domínio.
      "@next/next/no-img-element": "off",

      // ── Bump do Next 15.3.9 → 15.5.19 (segurança: bypass de middleware) trouxe um
      // eslint-config-next mais rígido que passou a tratar estas regras de hooks como
      // ERRO. No 15.3.9 elas não barravam o build (são pré-existentes no código). Pra
      // não acoplar o fix de segurança a um refactor grande de ~50 effects, ficam em
      // "warn" AGORA. A ONDA 1 (boas práticas React) corrige as violações e religa como
      // "error". NÃO adicionar código novo que as viole. (Hardening Onda 0.)
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps":     "warn",
      "react-hooks/immutability":        "warn",
    },
  },
]);

export default eslintConfig;
