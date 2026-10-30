import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
    rpc: mocks.rpc,
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children?: React.ReactNode }) => <a href={to}>{children}</a>,
    useNavigate: () => mocks.navigate,
  };
});

import { Layout } from "@/components/site/Layout";
import { resetAuthStore } from "@/lib/auth-store";
import { Route as AuthPageRoute } from "@/routes/auth";
import { Route as AdminRoute } from "@/routes/_authenticated/admin";

const session = { access_token: "token", user: { id: "user-1", email: "alice@example.com" } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const AuthPage = AuthPageRoute.options.component as ComponentType;
const AdminPage = AdminRoute.options.component as ComponentType;

const renderLayout = (label = "page content") =>
  render(
    <Layout>
      <p>{label}</p>
    </Layout>,
  );

describe("Auth hydration flicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
  });

  it("renders a navbar skeleton instead of the signed-out button while the session is read", async () => {
    const pending = deferred<{ data: { session: typeof session | null }; error: null }>();
    mocks.getSession.mockReturnValue(pending.promise);

    renderLayout();

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.queryByText("Sign out")).toBeNull();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();

    await act(async () => {
      pending.resolve({ data: { session }, error: null });
    });

    expect(await screen.findByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("keeps the resolved user across page changes so the navbar never flashes the signed-out state", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });

    const first = renderLayout("shop");
    expect(await screen.findByText("Sign out")).toBeInTheDocument();
    first.unmount();

    renderLayout("dashboard");

    // Synchronous first paint of the new page: already signed in, no flicker.
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("never renders the sign-in form for a signed-in visitor on /auth", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });

    render(<AuthPage />);

    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
    await act(async () => {});
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("shows the sign-in form once the session read confirms nobody is signed in", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(<AuthPage />);

    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("waits for the admin role before rendering ACCESS DENIED", async () => {
    const role = deferred<{ data: boolean; error: null }>();
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.rpc.mockReturnValue(role.promise);

    render(<AdminPage />);

    await act(async () => {});
    expect(screen.queryByText(/ACCESS DENIED/)).toBeNull();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();

    await act(async () => {
      role.resolve({ data: false, error: null });
    });

    expect(await screen.findByText(/ACCESS DENIED/)).toBeInTheDocument();
  });
});
