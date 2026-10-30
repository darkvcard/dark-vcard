import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  createPayment: vi.fn(),
  navigate: vi.fn(),
  authState: { user: { id: "user-1", email: "alice@example.com" } as { id: string; email: string } | null, isAdmin: false, loading: false, roleLoading: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession, refreshSession: mocks.refreshSession, signOut: mocks.signOut } },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mocks.createPayment,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/payment.functions", () => ({
  createPayment: vi.fn(),
  adminUserEmails: vi.fn(),
}));

import { CheckoutDialog } from "@/components/site/CheckoutDialog";
import type { CardRow } from "@/components/site/CardTile";

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

const invoice = {
  order_id: "order-1",
  user_id: "user-1",
  method: "USDT-BEP20",
  recipient: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4",
  amount_units: "56010000000000000000",
  amount_display: "56.01",
  memo: "order-1",
  created_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
  verification_state: "pending",
  transaction_ref: null,
  paid_at: null,
  last_checked_at: null,
  last_error: null,
  scan_cursor: null,
};

const renderCheckout = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckoutDialog card={card} onClose={() => {}} />
    </QueryClientProvider>,
  );

const clickContinue = () => fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

describe("Checkout order creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.user = { id: "user-1", email: "alice@example.com" };
    mocks.authState.loading = false;
  });

  it("shows a session skeleton instead of the sign-in prompt while auth resolves", () => {
    mocks.authState.user = null;
    mocks.authState.loading = true;

    renderCheckout();

    expect(screen.queryByText(/sign in to continue/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /continue to payment/i })).toBeNull();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("reads the session right before the request and sends the access token as a Bearer header", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } }, error: null });
    mocks.createPayment.mockResolvedValue(invoice);

    renderCheckout();
    clickContinue();

    await waitFor(() => expect(mocks.createPayment).toHaveBeenCalledTimes(1));
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.createPayment).toHaveBeenCalledWith({
      data: { cardId: card.id, method: "USDT-BEP20" },
      headers: { Authorization: "Bearer token-123" },
    });
    expect(await screen.findByText(/56\.01/)).toBeInTheDocument();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("shows a red payment error without signing the user out when the payment call fails", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } }, error: null });
    mocks.createPayment.mockRejectedValue(new Error("Card unavailable"));

    renderCheckout();
    clickContinue();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Payment failed. Please try again.");
    expect(alert.className).toContain("destructive");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("never signs out when there is no usable session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });

    renderCheckout();
    clickContinue();

    expect(await screen.findByRole("alert")).toHaveTextContent("Payment failed. Please try again.");
    expect(mocks.createPayment).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("retries once with a refreshed token when the server rejects the first one", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "stale-token" } }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: "fresh-token" } }, error: null });
    mocks.createPayment
      .mockRejectedValueOnce(new Error("Unauthorized: session rejected"))
      .mockResolvedValueOnce(invoice);

    renderCheckout();
    clickContinue();

    await waitFor(() => expect(mocks.createPayment).toHaveBeenCalledTimes(2));
    expect(mocks.createPayment.mock.calls[0]![0].headers.Authorization).toBe("Bearer stale-token");
    expect(mocks.createPayment.mock.calls[1]![0].headers.Authorization).toBe("Bearer fresh-token");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
