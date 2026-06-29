import { defineConfig, devices } from "@playwright/test";

/**
 * Suite E2E do auto-estética.
 *
 * Ambiente totalmente isolado:
 *  - Backend e2e na porta 3100 (lore-back, npm run dev:e2e → Postgres LOCAL forbion_e2e)
 *  - Front e2e na porta 3101 apontando pro backend 3100
 *  - Seed determinístico: lore-back `npm run seed:e2e` (roda no global-setup)
 *
 * Rodar: npm run test:e2e (sobe tudo sozinho) — NUNCA aponta pro Neon.
 */

const BACK_DIR = "../lore-back";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // banco compartilhado entre testes — ordem importa menos, mas evita corrida
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Artefatos FORA do projeto: o watcher do next dev vê escrita em
  // test-results/ e entra em loop de Fast Refresh, remontando os componentes
  // no meio dos testes (estado de form zerado, navegação abortada).
  outputDir: "/tmp/forbion-e2e/test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "/tmp/forbion-e2e/report" }],
  ],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `npm run dev:e2e --prefix ${BACK_DIR}`,
      url: "http://localhost:3100/api/live",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Env inline no comando: o objeto `env` do webServer nem sempre chega no
      // processo do next dev (e o .env.local apontaria pro backend 3000).
      command:
        "NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=http://localhost:3100 NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false npx next dev -p 3101",
      url: "http://localhost:3101",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
