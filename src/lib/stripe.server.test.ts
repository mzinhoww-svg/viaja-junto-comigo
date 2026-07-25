/**
 * Testes de `stripe.server.ts` relevantes ao VJT-012: o kill switch
 * `PAYMENTS_ENABLED` (checkout Premium) e a verificação de assinatura do
 * webhook (`verifyWebhook`), que cobre o cenário "assinatura inválida"
 * pedido para este ticket — o mesmo `verifyWebhook` protege o webhook de
 * checkout do Premium adicionado nesta rota.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paymentsEnabled, verifyWebhook } from "./stripe.server";

const SECRET = "whsec_test_secret";

async function signBody(body: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Buffer.from(new Uint8Array(signed)).toString("hex");
}

function makeRequest(body: string, signatureHeader: string | null): Request {
  return new Request("https://viajaly.app/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body,
    headers: signatureHeader ? { "stripe-signature": signatureHeader } : {},
  });
}

describe("paymentsEnabled (kill switch PAYMENTS_ENABLED)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falha fechado quando a variável não está definida", () => {
    vi.stubEnv("PAYMENTS_ENABLED", undefined as unknown as string);
    expect(paymentsEnabled()).toBe(false);
  });

  it('falha fechado para qualquer valor diferente de "true"', () => {
    vi.stubEnv("PAYMENTS_ENABLED", "1");
    expect(paymentsEnabled()).toBe(false);
  });

  it('libera o checkout apenas com "true" exato', () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(paymentsEnabled()).toBe(true);
  });
});

describe("verifyWebhook (assinatura do checkout Stripe, incluindo o Premium do VJT-012)", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("aceita e retorna o evento quando a assinatura é válida", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signBody(payload, timestamp, SECRET);

    const event = await verifyWebhook(
      makeRequest(payload, `t=${timestamp},v1=${signature}`),
      "sandbox",
    );
    expect(event.id).toBe("evt_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejeita uma assinatura inválida (segredo errado)", async () => {
    const payload = JSON.stringify({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const badSignature = await signBody(payload, timestamp, "whsec_wrong_secret");

    await expect(
      verifyWebhook(makeRequest(payload, `t=${timestamp},v1=${badSignature}`), "sandbox"),
    ).rejects.toThrow("Invalid webhook signature");
  });

  it("rejeita quando o corpo foi adulterado após a assinatura", async () => {
    const originalPayload = JSON.stringify({ id: "evt_3", type: "checkout.session.completed" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signBody(originalPayload, timestamp, SECRET);
    const tamperedPayload = JSON.stringify({ id: "evt_3", type: "payment_intent.succeeded" });

    await expect(
      verifyWebhook(makeRequest(tamperedPayload, `t=${timestamp},v1=${signature}`), "sandbox"),
    ).rejects.toThrow("Invalid webhook signature");
  });

  it("rejeita quando o cabeçalho stripe-signature está ausente", async () => {
    await expect(verifyWebhook(makeRequest("{}", null), "sandbox")).rejects.toThrow(
      "Missing signature or body",
    );
  });

  it("rejeita um timestamp fora da janela de tolerância (replay)", async () => {
    const payload = JSON.stringify({ id: "evt_4", type: "checkout.session.completed" });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const signature = await signBody(payload, oldTimestamp, SECRET);

    await expect(
      verifyWebhook(makeRequest(payload, `t=${oldTimestamp},v1=${signature}`), "sandbox"),
    ).rejects.toThrow("Webhook timestamp too old");
  });
});
