import { z } from "zod";
import { BSC_USDT, SOLANA_USDT, matchesPayment, type ChainTransfer } from "./payments";
import type { Invoice } from "./payment-types";

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) { const body = await response.text(); console.error(`Blockchain provider [${response.status}]: ${body}`); throw new Error(`Blockchain provider returned ${response.status}`); }
  const body = await response.json() as { result: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

const transfersSchema = z.object({ cursor: z.string().nullable().optional(), result: z.array(z.object({ transaction_hash: z.string(), block_timestamp: z.string(), block_number: z.string(), value: z.string(), to_address: z.string(), address: z.string() })) });
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
async function findBscPayment(invoice: Invoice): Promise<{ transfer?: ChainTransfer; cursor: string | null }> {
  const key = process.env['MORALIS_API_KEY'];
  if (!key) throw new Error("Moralis is not configured");
  const url = new URL(`https://deep-index.moralis.io/api/v2.2/${invoice.recipient}/erc20/transfers`);
  url.searchParams.set("chain", "bsc"); url.searchParams.set("contract_addresses[0]", BSC_USDT);
  url.searchParams.set("from_date", invoice.created_at); url.searchParams.set("to_date", invoice.expires_at);
  url.searchParams.set("order", "ASC"); url.searchParams.set("limit", "100");
  if (invoice.scan_cursor) url.searchParams.set("cursor", invoice.scan_cursor);
  const response = await fetch(url, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) { const body = await response.text(); console.error(`Moralis [${response.status}]: ${body}`); throw new Error(`Moralis returned ${response.status}: ${body}`); }
  const page = transfersSchema.parse(await response.json());
  const rpcUrl = "https://bsc-dataseed.bnbchain.org";
  const candidates = page.result.filter(t => t.address.toLowerCase() === BSC_USDT && t.to_address.toLowerCase() === invoice.recipient.toLowerCase() && t.value === invoice.amount_units);
  if (!candidates.length) return { cursor: page.cursor ?? null };
  if (await rpc<string>(rpcUrl, "eth_chainId", []) !== "0x38") throw new Error("Incorrect BSC network");
  const finalized = await rpc<{ number: string } | null>(rpcUrl, "eth_getBlockByNumber", ["finalized", false]);
  if (!finalized) throw new Error("Finalized BSC data unavailable");
  for (const candidate of candidates) {
    if (BigInt(candidate.block_number) > BigInt(finalized.number)) return { cursor: invoice.scan_cursor };
    const receipt = await rpc<{ status: string; blockNumber: string; blockHash: string; logs: { address: string; topics: string[]; data: string }[] } | null>(rpcUrl, "eth_getTransactionReceipt", [candidate.transaction_hash]);
    if (!receipt || receipt.status !== "0x1") continue;
    if (BigInt(receipt.blockNumber) > BigInt(finalized.number)) return { cursor: invoice.scan_cursor };
    const block = await rpc<{ hash: string; timestamp: string } | null>(rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false]);
    if (!block || block.hash !== receipt.blockHash) continue;
    const amount = receipt.logs.filter(log => log.address.toLowerCase() === BSC_USDT && log.topics[0] === transferTopic && log.topics[2]?.toLowerCase() === `0x${invoice.recipient.slice(2).toLowerCase().padStart(64, "0")}`).reduce((sum, log) => sum + BigInt(log.data), 0n);
    const transfer: ChainTransfer = { asset: BSC_USDT, recipient: invoice.recipient, amountUnits: amount.toString(), timestamp: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(), successful: true, finalized: true, reference: `bsc:${candidate.transaction_hash.toLowerCase()}` };
    if (matchesPayment(invoice, transfer)) return { transfer, cursor: page.cursor ?? null };
  }
  return { cursor: page.cursor ?? null };
}

type TokenBalance = { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string; decimals: number } };
type Instruction = { program?: string; programId?: string; parsed?: unknown };
type SolTransaction = { blockTime: number | null; meta: { err: unknown; preTokenBalances: TokenBalance[]; postTokenBalances: TokenBalance[]; innerInstructions?: { instructions: Instruction[] }[] } | null; transaction: { message: { instructions: Instruction[] } } };
async function findSolanaPayment(invoice: Invoice): Promise<{ transfer?: ChainTransfer; cursor: string | null }> {
  const key = process.env['HELIUS_API_KEY'];
  if (!key) throw new Error("Helius is not configured");
  const url = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
  const accounts = await rpc<{ value: { pubkey: string }[] }>(url, "getTokenAccountsByOwner", [invoice.recipient, { mint: SOLANA_USDT }, { encoding: "jsonParsed", commitment: "finalized" }]);
  const addresses = [invoice.recipient, ...accounts.value.map(a => a.pubkey)];
  // Walk each token account in lockstep; each account's pagination position is persistent.
  const cursors: Record<string, string> = invoice.scan_cursor ? JSON.parse(invoice.scan_cursor) : {};
  for (const address of addresses) {
    const signatures = await rpc<{ signature: string; err: unknown; blockTime: number | null }[]>(url, "getSignaturesForAddress", [address, { commitment: "finalized", limit: 25, ...(cursors[address] ? { before: cursors[address] } : {}) }]);
    let reachedStart = false;
    for (const signature of signatures) {
      if (signature.blockTime && signature.blockTime * 1000 < Date.parse(invoice.created_at)) { reachedStart = true; break; }
      if (signature.err || !signature.blockTime || signature.blockTime * 1000 > Date.parse(invoice.expires_at)) continue;
      const tx = await rpc<SolTransaction | null>(url, "getTransaction", [signature.signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }]);
      if (!tx) return { cursor: invoice.scan_cursor };
      if (!tx.meta || tx.meta.err || !tx.blockTime) continue;
      const instructions = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions ?? []).flatMap(i => i.instructions)];
      const memo = instructions.find(i => i.programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" && typeof i.parsed === "string" && i.parsed === invoice.memo)?.parsed;
      const incoming = tx.meta.postTokenBalances.filter(b => b.mint === SOLANA_USDT && b.owner === invoice.recipient && b.uiTokenAmount.decimals === 6);
      const delta = incoming.reduce((sum, post) => {
        const pre = tx.meta?.preTokenBalances.find(b => b.accountIndex === post.accountIndex && b.mint === SOLANA_USDT);
        return sum + BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0");
      }, 0n);
      const transfer: ChainTransfer = { asset: SOLANA_USDT, recipient: invoice.recipient, amountUnits: delta.toString(), memo: typeof memo === "string" ? memo : undefined, timestamp: new Date(tx.blockTime * 1000).toISOString(), successful: true, finalized: true, reference: `solana:${signature.signature}` };
      if (matchesPayment(invoice, transfer)) return { transfer, cursor: invoice.scan_cursor };
    }
    const last = signatures.at(-1);
    if (!reachedStart && signatures.length === 25 && last) cursors[address] = last.signature;
    else delete cursors[address];
  }
  return { cursor: Object.keys(cursors).length ? JSON.stringify(cursors) : null };
}

export async function verifyPendingPayments() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: invoices, error } = await supabaseAdmin.from("payment_invoices").select("*").in("verification_state", ["pending", "paid"]).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(5);
  if (error) throw error;
  let completed = 0; let failures = 0;
  for (const invoice of invoices) {
    try {
      const result = invoice.transaction_ref && invoice.paid_at ? { transfer: { reference: invoice.transaction_ref, timestamp: invoice.paid_at }, cursor: null }
        : invoice.method === "USDT-BEP20" ? await findBscPayment(invoice) : await findSolanaPayment(invoice);
      if (result.transfer) {
        const fulfillment = await supabaseAdmin.rpc("fulfill_crypto_invoice", { p_order_id: invoice.order_id, p_transaction_ref: result.transfer.reference, p_paid_at: result.transfer.timestamp });
        if (fulfillment.error) throw fulfillment.error;
        if (fulfillment.data) completed++;
      }
      const update = await supabaseAdmin.from("payment_invoices").update({ last_checked_at: new Date().toISOString(), last_error: null, scan_cursor: result.cursor }).eq("order_id", invoice.order_id);
      if (update.error) throw update.error;
    } catch (error) {
      failures++;
      const message = error instanceof Error ? error.message : "Verification failed";
      console.error(`Payment verification: ${message}`);
      await supabaseAdmin.from("payment_invoices").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("order_id", invoice.order_id);
    }
  }
  return { checked: invoices.length, completed, failures };
}