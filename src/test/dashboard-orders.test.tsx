import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

type DashboardOrder = {
  id: string;
  user_id: string;
  status: string;
  txid: string | null;
  crypto_method: string;
  amount_usd: number;
  created_at: string;
  delivery_details: string | null;
  cards: { card_name: string; card_type: string; image_url: string | null } | null;
  payment_invoices: null;
};

const mocks = vi.hoisted(() => ({
  orders: [] as DashboardOrder[],
  signOut: vi.fn(),
  authState: {
    user: { id: "user-1", email: "alice@example.com" },
    isAdmin: false,
    loading: false,
    roleLoading: false,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signOut: mocks.signOut },
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: mocks.orders, error: null }) }),
      }),
    }),
  },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mocks.authState }));

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

import { Route as DashboardRoute } from "@/routes/_authenticated/dashboard";

const Dashboard = DashboardRoute.options.component as ComponentType;

const TXID = `0x${"a".repeat(64)}`;

const submittedOrder = (): DashboardOrder => ({
  id: "order-1",
  user_id: "user-1",
  status: "pending",
  txid: TXID,
  crypto_method: "USDT-BEP20",
  amount_usd: 55,
  created_at: new Date().toISOString(),
  delivery_details: null,
  cards: { card_name: "Shadow Visa $50", card_type: "Visa", image_url: null },
  payment_invoices: null,
});

const renderDashboard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Dashboard />
    </QueryClientProvider>,
  );

describe("Dashboard order history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orders = [submittedOrder()];
  });

  it("shows a submitted order as pending verification with its TXID and payment method", async () => {
    renderDashboard();

    expect(await screen.findByText("Pending Verification")).toBeInTheDocument();
    expect(screen.getByText(TXID)).toBeInTheDocument();
    expect(screen.getByText("USDT - BEP20")).toBeInTheDocument();
    expect(screen.getByText("$55.00")).toBeInTheDocument();
  });

  it("does not offer the removed server-side payment action", async () => {
    renderDashboard();

    await screen.findByText("Pending Verification");
    expect(screen.queryByRole("button", { name: /pay & submit txid/i })).toBeNull();
  });
});
