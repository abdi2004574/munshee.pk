import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { CallbackPage } from "@/features/auth/CallbackPage";
import { AppShell } from "@/components/AppShell";
import { PricingPage } from "@/features/pricing/pages/PricingPage";

const LazyDashboardPage = lazy(() => import("@/routes/DashboardPage").then(m => ({ default: m.DashboardPage })));
const LazyProductsListPage = lazy(() => import("@/features/products/pages/ProductsListPage").then(m => ({ default: m.ProductsListPage })));
const LazyProductNewPage = lazy(() => import("@/features/products/pages/ProductNewPage").then(m => ({ default: m.ProductNewPage })));
const LazyProductDetailPage = lazy(() => import("@/features/products/pages/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
const LazyOrdersListPage = lazy(() => import("@/features/orders/pages/OrdersListPage").then(m => ({ default: m.OrdersListPage })));
const LazyOrderNewPage = lazy(() => import("@/features/orders/pages/OrderNewPage").then(m => ({ default: m.OrderNewPage })));
const LazyOrderDetailPage = lazy(() => import("@/features/orders/pages/OrderDetailPage").then(m => ({ default: m.OrderDetailPage })));
const LazyCustomersListPage = lazy(() => import("@/features/customers/pages/CustomersListPage").then(m => ({ default: m.CustomersListPage })));
const LazyCustomerNewPage = lazy(() => import("@/features/customers/pages/CustomerNewPage").then(m => ({ default: m.CustomerNewPage })));
const LazyCustomerDetailPage = lazy(() => import("@/features/customers/pages/CustomerDetailPage").then(m => ({ default: m.CustomerDetailPage })));
const LazySettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const LazyImportNewPage = lazy(() => import("@/features/imports/pages/ImportNewPage").then(m => ({ default: m.ImportNewPage })));
const LazyReviewQueuePage = lazy(() => import("@/features/reviews/pages/ReviewQueuePage").then(m => ({ default: m.ReviewQueuePage })));
const LazyReviewDetailPage = lazy(() => import("@/features/reviews/pages/ReviewDetailPage").then(m => ({ default: m.ReviewDetailPage })));
const LazyExtractTextPage = lazy(() => import("@/features/extraction/pages/ExtractTextPage").then(m => ({ default: m.ExtractTextPage })));
const LazyExtractVisionPage = lazy(() => import("@/features/extraction/pages/ExtractVisionPage").then(m => ({ default: m.ExtractVisionPage })));
const LazyExtractFactsPage = lazy(() => import("@/features/extraction/pages/ExtractFactsPage").then(m => ({ default: m.ExtractFactsPage })));
const LazyScrapePage = lazy(() => import("@/features/scraper/pages/ScrapePage").then(m => ({ default: m.ScrapePage })));
const LazyAskPage = lazy(() => import("@/features/ask/pages/AskPage").then(m => ({ default: m.AskPage })));
const LazySocialConnectPage = lazy(() => import("@/features/social/pages/SocialConnectPage").then(m => ({ default: m.SocialConnectPage })));
const LazyWhatsappExportPage = lazy(() => import("@/features/whatsapp/pages/WhatsappExportPage").then(m => ({ default: m.WhatsappExportPage })));
const LazyPublicProfilePage = lazy(() => import("@/features/public-profile/pages/PublicProfilePage").then(m => ({ default: m.PublicProfilePage })));
const LazyBillingPage = lazy(() => import("@/features/billing/pages/BillingPage").then(m => ({ default: m.BillingPage })));
const LazyClientsPage = lazy(() => import("@/features/clients/pages/ClientsPage").then(m => ({ default: m.ClientsPage })));
const LazyAdminPage = lazy(() => import("@/features/admin/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const LazyAdminEvalPage = lazy(() => import("@/features/admin/pages/AdminEvalPage").then(m => ({ default: m.AdminEvalPage })));

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-ink-muted">Loading…</div>}>
      {children}
    </Suspense>
  );
}

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
    path: "/pricing",
    element: <RouteSuspense><PricingPage /></RouteSuspense>,
  },
  {
    path: "/profile/:tenantId",
    element: <RouteSuspense><LazyPublicProfilePage /></RouteSuspense>,
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
        element: <RouteSuspense><LazyDashboardPage /></RouteSuspense>,
      },
    ],
  },
  {
    path: "/apps",
    element: <ProtectedRoute />,
    children: [
      { path: "products", element: <RouteSuspense><LazyProductsListPage /></RouteSuspense> },
      { path: "products/new", element: <RouteSuspense><LazyProductNewPage /></RouteSuspense> },
      { path: "products/:id", element: <RouteSuspense><LazyProductDetailPage /></RouteSuspense> },
      { path: "orders", element: <RouteSuspense><LazyOrdersListPage /></RouteSuspense> },
      { path: "orders/new", element: <RouteSuspense><LazyOrderNewPage /></RouteSuspense> },
      { path: "orders/:id", element: <RouteSuspense><LazyOrderDetailPage /></RouteSuspense> },
      { path: "customers", element: <RouteSuspense><LazyCustomersListPage /></RouteSuspense> },
      { path: "customers/new", element: <RouteSuspense><LazyCustomerNewPage /></RouteSuspense> },
      { path: "customers/:id", element: <RouteSuspense><LazyCustomerDetailPage /></RouteSuspense> },
      { path: "settings", element: <RouteSuspense><LazySettingsPage /></RouteSuspense> },
      { path: "import", element: <RouteSuspense><LazyImportNewPage /></RouteSuspense> },
      { path: "import/new", element: <Navigate to="/apps/import" replace /> },
      { path: "review", element: <RouteSuspense><LazyReviewQueuePage /></RouteSuspense> },
      { path: "review/:id", element: <RouteSuspense><LazyReviewDetailPage /></RouteSuspense> },
      { path: "scrape", element: <RouteSuspense><LazyScrapePage /></RouteSuspense> },
      { path: "extract/text", element: <RouteSuspense><LazyExtractTextPage /></RouteSuspense> },
      { path: "extract/vision", element: <RouteSuspense><LazyExtractVisionPage /></RouteSuspense> },
      { path: "extract/facts", element: <RouteSuspense><LazyExtractFactsPage /></RouteSuspense> },
      { path: "ask", element: <RouteSuspense><LazyAskPage /></RouteSuspense> },
      { path: "social", element: <RouteSuspense><LazySocialConnectPage /></RouteSuspense> },
      { path: "whatsapp", element: <RouteSuspense><LazyWhatsappExportPage /></RouteSuspense> },
      { path: "billing", element: <RouteSuspense><LazyBillingPage /></RouteSuspense> },
      { path: "clients", element: <RouteSuspense><LazyClientsPage /></RouteSuspense> },
      { path: "admin", element: <RouteSuspense><LazyAdminPage /></RouteSuspense> },
      { path: "admin/eval", element: <RouteSuspense><LazyAdminEvalPage /></RouteSuspense> },
    ],
  },
]);
