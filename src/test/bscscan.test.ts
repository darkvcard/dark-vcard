import { describe, expect, it } from "vitest";
import { bscScanUrl, bscTransferParams, parseBscScanTransfers } from "@/lib/bscscan";
describe("BscScan Etherscan V2 verification", () => {
  it("uses Etherscan V2 with BNB chain 56, exact USDT contract and pagination", () => {
    const url = bscScanUrl(bscTransferParams("0x35aec7E35F65ea227e49fDd321709D52Ada389E4", "100", "200", 2), "test-only-key");
    expect(url.origin + url.pathname).toBe("https://api.etherscan.io/v2/api");
    expect(url.searchParams.get("chainid")).toBe("56");
    expect(url.searchParams.get("contractaddress")).toBe("0x55d398326f99059ff775485246999027b3197955");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("startblock")).toBe("100");
    expect(url.searchParams.get("endblock")).toBe("200");
  });
  it("reads explorer raw amounts and hash without floating-point conversion", () => {
    const row = { hash: "0xabc", timeStamp: "1792944000", blockNumber: "100", value: "10150000000000000000", to: "0xrecipient", contractAddress: "0xcontract" };
    expect(parseBscScanTransfers({ status: "1", message: "OK", result: [row] })).toEqual([row]);
  });
  it("accepts no transactions but never treats invalid keys or tier failures as unpaid", () => {
    expect(parseBscScanTransfers({ status: "0", message: "No transactions found", result: [] })).toEqual([]);
    expect(() => parseBscScanTransfers({ status: "0", message: "NOTOK", result: "Invalid API Key" })).toThrow("Invalid API Key");
    expect(() => parseBscScanTransfers({ status: "0", message: "NOTOK", result: "Free API access is not supported for this chain." })).toThrow("Free API access");
  });
});