import { z } from "zod";
import { BSC_USDT } from "./payments";

export const BSCSCAN_API_URL = "https://api.etherscan.io/v2/api";
export function bscScanUrl(params: Record<string, string>, key: string) {
  const url = new URL(BSCSCAN_API_URL);
  url.search = new URLSearchParams({ ...params, chainid: "56", apikey: key }).toString();
  return url;
}
const envelope = z.object({ status: z.string(), message: z.string(), result: z.unknown() });
const transfer = z.object({ hash: z.string(), timeStamp: z.string().regex(/^\d+$/), blockNumber: z.string().regex(/^\d+$/), value: z.string().regex(/^\d+$/), to: z.string(), contractAddress: z.string() });
export function parseBscScanResponse(body: unknown) {
  const parsed = envelope.parse(body);
  if (parsed.status === "1") return parsed.result;
  if (parsed.status === "0" && parsed.message === "No transactions found" && Array.isArray(parsed.result) && parsed.result.length === 0) return [];
  throw new Error(`BscScan / Etherscan: ${typeof parsed.result === "string" ? parsed.result : parsed.message}`);
}
export function parseBscScanTransfers(body: unknown) {
  return z.array(transfer).parse(parseBscScanResponse(body));
}
export function bscTransferParams(recipient: string, startBlock: string, endBlock: string, page: number) {
  return { module: "account", action: "tokentx", contractaddress: BSC_USDT, address: recipient, startblock: startBlock, endblock: endBlock, page: String(page), offset: "100", sort: "asc" };
}