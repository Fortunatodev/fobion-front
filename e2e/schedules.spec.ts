import { test, expect } from "@playwright/test";
import { API, E2E, apiLogin, nextOpenDay } from "./helpers";

/**
 * CRUD de agendamento via API + verificação na UI do dono.
 * Usa POST /api/schedules público (mesmo fluxo do link de agendamento).
 */
test.describe("Agendamentos", () => {
  let token: string;
  let businessId: string;
  let serviceId: string;
  let scheduleId: string;

  test.beforeAll(async ({ request }) => {
    const login = await apiLogin(request);
    token = login.token;
    businessId = login.user.businessId ?? login.business?.id;

    const services = await request.get(`${API}/api/services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(services.ok()).toBeTruthy();
    const list = (await services.json()).services ?? (await services.json());
    serviceId = (Array.isArray(list) ? list : list.services)[0].id;
  });

  test("cria agendamento público (cliente novo + veículo novo)", async ({ request }) => {
    const res = await request.post(`${API}/api/schedules`, {
      data: {
        businessId,
        scheduledAt: `${nextOpenDay(2)}T14:00:00.000Z`,
        serviceIds: [serviceId],
        customer: { name: "Maria E2E", phone: "11977776666" },
        vehicle: { model: "Onix", color: "Prata", type: "CAR", plate: "XYZ9A88" },
        notes: "criado pela suite e2e",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    scheduleId = body.schedule.id;
    expect(body.schedule.status).toBe("PENDING");
  });

  test("dono vê o agendamento na listagem autenticada", async ({ request }) => {
    const res = await request.get(`${API}/api/schedules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const all = JSON.stringify(body);
    expect(all).toContain("Maria E2E");
  });

  test("atualiza status PENDING → CONFIRMED", async ({ request }) => {
    const res = await request.put(`${API}/api/schedules/${scheduleId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "CONFIRMED" },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("listagem sem token é rejeitada", async ({ request }) => {
    const res = await request.get(`${API}/api/schedules`);
    expect([401, 403]).toContain(res.status());
  });

  test("cancela o agendamento", async ({ request }) => {
    const res = await request.delete(`${API}/api/schedules/${scheduleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});
