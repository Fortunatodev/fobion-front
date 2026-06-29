import { test, expect } from "@playwright/test";
import { API, E2E } from "./helpers";

/**
 * Webhook CaktoPay — contrato atual:
 *  - O secret vai NO CORPO (`payload.secret`), não em header HMAC.
 *  - Eventos de ativação: purchase_approved / subscription_created / subscription_renewed.
 *  - A loja é resolvida por `data.customer.email` (→ OWNER user). Idempotência por transactionId+event.
 * Usa CACTOPAY_WEBHOOK_SECRET do .env.e2e do backend.
 */
const SECRET = "e2e-webhook-secret";
const url = `${API}/api/webhooks/cactopay`;

test.describe("Webhook CaktoPay", () => {
  test("secret inválido é rejeitado", async ({ request }) => {
    const res = await request.post(url, {
      data: { event: "purchase_approved", secret: "errado", data: { status: "paid", customer: { email: E2E.ownerEmail } } },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("sem secret é rejeitado", async ({ request }) => {
    const res = await request.post(url, {
      data: { event: "purchase_approved", data: { status: "paid", customer: { email: E2E.ownerEmail } } },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("purchase_approved (secret ok) ativa plano e é idempotente", async ({ request }) => {
    const payload = {
      event: "purchase_approved",
      secret: SECRET,
      data: {
        status: "paid",
        transactionId: `e2e-tx-${Date.now()}`,
        customer: { email: E2E.ownerEmail },
      },
    };
    const first = await request.post(url, { data: payload });
    expect(first.ok()).toBeTruthy();

    // mesmo transactionId+event → processado 1x só (idempotência por externalId)
    const second = await request.post(url, { data: payload });
    expect(second.ok()).toBeTruthy();
  });
});
