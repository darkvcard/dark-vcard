import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  writeText: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  authState: {
    user: { id: "user-1", email: "alice@example.com" } as { id: string; email: string } | null,
    isAdmin: false,
    loading: false,
    roleLoading: false,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { CheckoutDialog } from "@/components/site/CheckoutDialog";
import type { CardRow } from "@/components/site/CardTile";

const BEP20 = "0x35aec7E35F65ea227e49fDd321709D52Ada389E4";
const SOLANA = "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ";
const TXID = `0x${"a".repeat(64)}`;

const card: CardRow = {
  id: "11111111-1111-4111-8111-111111111111",
  card_name: "Shadow Visa $50",
  card_type: "Visa",
  price_in_usd: 55,
  description: null,
  image_url: null,
  stock_status: "in_stock",
  created_at: new Date().toISOString(),
};

const onClose = vi.fn();

const renderCheckout = (c: CardRow | null = card) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckoutDialog card={c} onClose={onClose} />
    </QueryClientProvider>,
  );

const addressInput = () => screen.getByLabelText(/wallet address/i) as HTMLInputElement;

const typeTxid = (value: string) =>
  fireEvent.change(screen.getByLabelText(/transaction hash/i), { target: { value } });

const clickConfirm = () =>
  fireEvent.click(screen.getByRole("button", { name: /confirm payment/i }));

describe("Manual crypto checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.user = { id: "user-1", email: "alice@example.com" };
    mocks.authState.loading = false;
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ data: null, error: null });
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it("shows the BEP20 wallet, the exact amount and a QR code for that address", () => {
    renderCheckout();

    expect(addressInput().value).toBe(BEP20);
    expect(screen.getByTestId("checkout-amount")).toHaveTextContent(
      "Please send exactly $55.00 worth of crypto to the address above.",
    );
    // The QR code is an inline SVG whose <title> names the address it encodes.
    const qr = screen.getByTitle(`Wallet QR code for ${BEP20}`);
    expect(qr.tagName.toLowerCase()).toBe("title");
    expect(qr.closest("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: /copy address/i })).toBeInTheDocument();
  });

  it("switches the wallet address and QR code when the Solana network is selected", async () => {
    renderCheckout();

    fireEvent.click(screen.getByLabelText(/crypto network/i));
    fireEvent.click(await screen.findByRole("option", { name: /USDT - Solana/i }));

    await waitFor(() => expect(addressInput().value).toBe(SOLANA));
    expect(screen.getByTitle(`Wallet QR code for ${SOLANA}`).closest("svg")).not.toBeNull();
    expect(screen.queryByTitle(`Wallet QR code for ${BEP20}`)).toBeNull();
  });

  it("copies the currently selected wallet address", async () => {
    renderCheckout();

    fireEvent.click(screen.getByRole("button", { name: /copy address/i }));

    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith(BEP20));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Wallet address copied");
  });

  it("refuses to submit an empty TXID", async () => {
    renderCheckout();

    clickConfirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Paste your Transaction Hash (TXID) before confirming.",
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("inserts a pending order with the TXID and redirects to the dashboard", async () => {
    renderCheckout();

    typeTxid(`  ${TXID}  `);
    clickConfirm();

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.from).toHaveBeenCalledWith("orders");
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      card_id: card.id,
      crypto_method: "USDT-BEP20",
      amount_usd: 55,
      txid: TXID,
      status: "pending",
    });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Payment submitted successfully! We will verify your TXID and deliver your card shortly.",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("records the Solana method when that network is chosen", async () => {
    renderCheckout();

    fireEvent.click(screen.getByLabelText(/crypto network/i));
    fireEvent.click(await screen.findByRole("option", { name: /USDT - Solana/i }));
    await waitFor(() => expect(addressInput().value).toBe(SOLANA));
    typeTxid(TXID);
    clickConfirm();

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert.mock.calls[0]![0]).toMatchObject({
      crypto_method: "USDT-SOLANA",
      status: "pending",
    });
  });

  it("reports a duplicate transaction hash instead of redirecting", async () => {
    mocks.insert.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    renderCheckout();

    typeTxid(TXID);
    clickConfirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/already submitted/i);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a session skeleton instead of the sign-in prompt while auth resolves", () => {
    mocks.authState.user = null;
    mocks.authState.loading = true;

    renderCheckout();

    expect(screen.queryByText(/sign in to continue/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /confirm payment/i })).toBeNull();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("asks signed-out visitors to sign in", () => {
    mocks.authState.user = null;

    renderCheckout();

    expect(screen.queryByRole("button", { name: /confirm payment/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /sign in to continue/i }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth" });
  });
});
