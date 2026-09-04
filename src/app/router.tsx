import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { AppShell } from "@/components/AppShell";
import { ProductsListPage } from "@/features/products/pages/ProductsListPage";
import { ProductNewPage } from "@/features/products/pages/ProductNewPage";
import { ProductDetailPage } from "@/features/products/pages/ProductDetailPage";
import { OrdersListPage } from "@/features/orders/pages/OrdersListPage";
import { OrderNewPage } from "@/features/orders/pages/OrderNewPage";
import { OrderDetailPage } from "@/features/orders/pages/OrderDetailPage";
import { CustomersListPage } from "@/features/customers/pages/CustomersListPage";
import { CustomerNewPage } from "@/features/customers/pages/CustomerNewPage";
import { CustomerDetailPage } from "@/features/customers/pages/CustomerDetailPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { ImportNewPage } from "@/features/imports/pages/ImportNewPage";
import { ReviewQueuePage } from "@/features/reviews/pages/ReviewQueuePage";
import { ReviewDetailPage } from "@/features/reviews/pages/ReviewDetailPage";
import { ExtractTextPage } from "@/features/extraction/pages/ExtractTextPage";
import { ExtractVisionPage } from "@/features/extraction/pages/ExtractVisionPage";
import { ScrapePage } from "@/features/scraper/pages/ScrapePage";
import { AskPage } from "@/features/ask/pages/AskPage";
import { SocialConnectPage } from "@/features/social/pages/SocialConnectPage";
import { WhatsappExportPage } from "@/features/whatsapp/pages/WhatsappExportPage";
import { PublicProfilePage } from "@/features/public-profile/pages/PublicProfilePage";

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
    path: "/profile/:tenantId",
    element: <PublicProfilePage />,
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
  {
    path: "/apps",
    element: <ProtectedRoute />,
    children: [
      { path: "products", element: <ProductsListPage /> },
      { path: "products/new", element: <ProductNewPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "orders", element: <OrdersListPage /> },
      { path: "orders/new", element: <OrderNewPage /> },
      { path: "orders/:id", element: <OrderDetailPage /> },
      { path: "customers", element: <CustomersListPage /> },
      { path: "customers/new", element: <CustomerNewPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "import", element: <ImportNewPage /> },
      { path: "import/new", element: <Navigate to="/apps/import" replace /> },
      { path: "review", element: <ReviewQueuePage /> },
      { path: "review/:id", element: <ReviewDetailPage /> },
      { path: "scrape", element: <ScrapePage /> },
      { path: "extract/text", element: <ExtractTextPage /> },
      { path: "extract/vision", element: <ExtractVisionPage /> },
      { path: "ask", element: <AskPage /> },
      { path: "social", element: <SocialConnectPage /> },
      { path: "whatsapp", element: <WhatsappExportPage /> },
    ],
  },
]);
