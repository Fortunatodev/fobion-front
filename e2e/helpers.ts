import { Page, APIRequestContext, expect } from "@playwright/test";

export const API = "http://localhost:3100";

export const E2E = {
  slug: "e2e-detailing",
  businessName: "E2E Detailing",
  ownerEmail: "owner@e2e.forbion.test",
  ownerPassword: "E2e!Forbion123",
};

/** Login do dono via UI (email/senha) e espera o dashboard carregar. */
export async function loginAsOwner(page: Page) {
  await page.goto("/auth/login");
  // Espera a hidratação do React: interagir antes deixa o estado do form
  // vazio e o submit permanentemente disabled.
  await page.waitForLoadState("networkidle");

  // A tela abre no login Google; o form e-mail/senha fica atrás de um toggle.
  const toggle = page.getByRole("button", { name: /e-mail e senha/i });
  if (await toggle.count()) await toggle.first().click();

  const email = page.getByPlaceholder("seu@email.com");
  const password = page.locator('input[type="password"]');
  // Exato "Entrar" — senão casa também o toggle "Entrar com e-mail e senha".
  const submit = page.getByRole("button", { name: /^entrar$/i });

  await expect(async () => {
    await email.click();
    await email.fill("");
    await email.pressSequentially(E2E.ownerEmail);
    await password.click();
    await password.fill("");
    await password.pressSequentially(E2E.ownerPassword);
    await expect(submit).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  await submit.click();
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });
}

/** Login direto via API — retorna { token, user } pra testes de API. */
export async function apiLogin(request: APIRequestContext) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: E2E.ownerEmail, password: E2E.ownerPassword },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** Próximo dia útil (seg-sáb, business fecha domingo) no formato YYYY-MM-DD. */
export function nextOpenDay(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
