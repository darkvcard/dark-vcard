// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createInvoiceForUser,
  type CreateInvoiceDeps,
  type InvoiceRpcClient,
} from "@/lib/payment.server";

const input = {
  userId: "11111111-1111-4111-8111-aaaaaaaaaaaa",
  cardId: "22222222-2222-4222-8222-bbbbbbbbbbbb",
  method: "USDT-BEP20" as const,
};

const invoice = {
  order_id: "order-1",
  user_id: input.userId,
  method: "USDT-BEP20",
  recipient: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4",
  amount_units: "56010000000000000000",
  amount_display: "56.01",
  memo: "order-1",
};

type RpcMock = ReturnType<typeof vi.fn>;

const asClient = (rpc: RpcMock): InvoiceRpcClient => ({
  rpc: rpc as unknown as InvoiceRpcClient["rpc"],
});

const deps = (
  rpc: RpcMock,
  describeEnv: () => string = () =>
    "SUPABASE_URL=set SUPABASE_SERVICE_ROLE_KEY=set host=example.supabase.co",
): CreateInvoiceDeps => ({
  getClient: () => asClient(rpc),
  describeEnv,
});

describe("createInvoiceForUser", () => {
  it("returns the invoice and calls the RPC with the verified user and card", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: invoice, error: null });

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toEqual({ ok: true, invoice });
    expect(rpc).toHaveBeenCalledWith("create_crypto_invoice", {
      p_user_id: input.userId,
      p_card_id: input.cardId,
      p_method: "USDT-BEP20",
    });
    // The success payload must survive transport serialization.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("returns a config failure naming the missing variable instead of throwing", async () => {
    const describeEnv = vi.fn(
      () => "SUPABASE_URL=set SUPABASE_SERVICE_ROLE_KEY=MISSING host=example.supabase.co",
    );
    const result = await createInvoiceForUser(input, {
      getClient: () => {
        throw new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.");
      },
      describeEnv,
    });

    expect(result).toMatchObject({
      ok: false,
      stage: "config",
      message: "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
    });
    expect(result.ok === false && result.env).toContain("SUPABASE_SERVICE_ROLE_KEY=MISSING");
    expect(describeEnv).toHaveBeenCalled();
    // Serialization keeps the reason, which is the whole point of not throwing.
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      message: "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
    });
  });

  it("returns the PostgREST message and code when the RPC rejects the call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "function public.create_crypto_invoice(uuid, uuid, text) does not exist",
        code: "42883",
        details: null,
        hint: null,
      },
    });

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toMatchObject({
      ok: false,
      stage: "database",
      message: "function public.create_crypto_invoice(uuid, uuid, text) does not exist",
      code: "42883",
    });
  });

  it("falls back to details/hint when the error carries no message", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "",
        code: "42501",
        details: "permission denied for function create_crypto_invoice",
        hint: null,
      },
    });

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toMatchObject({
      ok: false,
      stage: "database",
      message: "permission denied for function create_crypto_invoice",
      code: "42501",
    });
  });

  it("reports an empty RPC response instead of returning a null invoice", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toEqual({
      ok: false,
      stage: "database",
      message: "Invoice creation returned no data.",
    });
  });

  it("reports an unreachable database instead of throwing", async () => {
    const rpc = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toMatchObject({
      ok: false,
      stage: "request",
      message: "Could not reach the database: fetch failed",
    });
  });

  it("classifies a PostgREST fetch failure as a request problem and names the endpoint", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "TypeError: fetch failed",
        code: "",
        details: "Error: getaddrinfo ENOTFOUND",
        hint: "",
      },
    });

    const result = await createInvoiceForUser(input, deps(rpc));

    expect(result).toMatchObject({
      ok: false,
      stage: "request",
      message: "Could not reach the database: TypeError: fetch failed",
    });
    expect(result.ok === false && result.env).toContain("host=example.supabase.co");
  });

  it("resolves the service-role client on every call (no module-scope client)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: invoice, error: null });
    const getClient = vi.fn((): InvoiceRpcClient => asClient(rpc));

    await createInvoiceForUser(input, { getClient, describeEnv: () => "" });
    await createInvoiceForUser(
      { ...input, method: "USDT-SOLANA" },
      { getClient, describeEnv: () => "" },
    );

    expect(getClient).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("create_crypto_invoice", {
      p_user_id: input.userId,
      p_card_id: input.cardId,
      p_method: "USDT-SOLANA",
    });
  });
});
