import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

type AdminOrder = {
  id: string;
  user_id: string;
  status: string;
  txid: string | null;
  crypto_method: string;
  amount_usd: number;
  created_at: string;
  delivery_details: string | null;
  wallet_address: string | null;
  cards: { card_name: string } | null;
  payment_invoices: { amount_display: string } | null;
};

const mocks = vi.hoisted(() => ({
  orders: [] as AdminOrder[],
  rpc: vi.fn(),
  fetchEmails: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  authState: { user: { id: "admin-1" }, isAdmin: true, loading: false, roleLoading: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: async () => ({ data: mocks.orders, error: null }) }),
    }),
    rpc: mocks.rpc,
  },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mocks.authState }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

vi.mock("@/lib/payment.functions", () => ({ adminUserEmails: mocks.fetchEmails }));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

// The admin page renders inside <Layout>, which uses router links.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
  };
});

import { Route as AdminRoute } from "@/routes/_authenticated/admin";

const AdminPage = AdminRoute.options.component as ComponentType;

const order = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  id: "order-1",
  user_id: "user-1",
  status: "pending",
  txid: `0x${"a".repeat(64)}`,
  crypto_method: "USDT-BEP20",
  amount_usd: 55,
  created_at: new Date().toISOString(),
  delivery_details: null,
  wallet_address: null,
  cards: { card_name: "Shadow Visa $50" },
  payment_invoices: null,
  ...overrides,
});

const renderAdmin = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminPage />
    </QueryClientProvider>,
  );

describe("Admin orders table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orders = [order()];
    mocks.fetchEmails.mockResolvedValue({ "user-1": "alice@example.com" });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("shows the submitted TXID, the chosen payment method and the verification state", async () => {
    renderAdmin();

    const link = await screen.findByRole("link", { name: new RegExp(mocks.orders[0]!.txid!, "i") });
    expect(link).toHaveAttribute("href", `https://bscscan.com/tx/${mocks.orders[0]!.txid}`);
    expect(screen.getByText("USDT - BEP20")).toBeInTheDocument();
    expect(screen.getByText("Pending Verification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve payment/i })).toBeInTheDocument();
  });

  it("links a Solana TXID to Solscan", async () => {
    mocks.orders = [
      order({ crypto_method: "USDT-SOLANA", txid: "5VERv8NMvzbzYJb9hZkZk9Qp1s5uqJ9o1F6Tz7dGz3dG" }),
    ];
    renderAdmin();

    const link = await screen.findByRole("link", { name: /5VERv8/i });
    expect(link).toHaveAttribute(
      "href",
      "https://solscan.io/tx/5VERv8NMvzbzYJb9hZkZk9Qp1s5uqJ9o1F6Tz7dGz3dG",
    );
    expect(screen.getByText("USDT - Solana")).toBeInTheDocument();
  });

  it("approves the order through resolve_payment", async () => {
    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: /approve payment/i }));
    const buttons = await screen.findAllByRole("button", { name: /approve payment/i });
    fireEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("resolve_payment", {
        p_order_id: "order-1",
        p_approve: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Payment approved — card delivered");
  });
});
