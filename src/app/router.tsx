import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { AppShell } from "@/components/AppShell";

function ProtectedRoute() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!data?.session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function RootRedirect() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Loading…
      </div>
    );
  }

  return <Navigate to={data?.session ? "/dashboard" : "/login"} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/auth/callback",
    element: <CallbackPage />,
  },
  {
    path: "/dashboard",
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
    ],
  },
]);
