import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { useActiveBusiness, useManagedBusinesses } from "@/hooks/usePlan";
import { RescanBanner } from "@/features/rescan/RescanBanner";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/apps/products", label: "Products", end: false },
  { to: "/apps/orders", label: "Orders", end: false },
  { to: "/apps/customers", label: "Customers", end: false },
  { to: "/apps/settings", label: "Settings", end: false },
  { to: "/apps/import", label: "Import", end: false },
  { to: "/apps/scrape", label: "Scrape", end: false },
  { to: "/apps/review", label: "Review", end: false },
  { to: "/apps/extract/text", label: "Extract Text", end: false },
  { to: "/apps/extract/vision", label: "Extract Vision", end: false },
  { to: "/apps/ask", label: "Ask Munshee", end: false },
  { to: "/apps/social", label: "Social Connect", end: false },
  { to: "/apps/whatsapp", label: "WhatsApp Export", end: false },
  { to: "/apps/billing", label: "Billing & Plans", end: false },
  { to: "/apps/clients", label: "Clients", end: false },
  { to: "/apps/admin", label: "Admin", end: false },
];

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const { businessId, setBusinessId } = useActiveBusiness();
  const { data: managedBusinesses = [] } = useManagedBusinesses();

  const hasClients = managedBusinesses.length > 0;
  const activeBusiness = managedBusinesses.find((b) => b.tenant_id === businessId);

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-bold text-brand-600">Munshee</span>
              <span className="text-lg font-bold text-ink">.pk</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {hasClients && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setContextOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  <Icon name="box" size={16} />
                  <span>{activeBusiness?.display_name ?? "My Business"}</span>
                  <Icon name="chevron-down" size={14} />
                </button>
                {contextOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs font-medium text-ink-muted">Switch context</p>
                      {managedBusinesses.map((b) => (
                        <button
                          key={b.tenant_id}
                          type="button"
                          className={`w-full rounded px-2 py-2 text-left text-sm hover:bg-gray-50 ${
                            b.tenant_id === businessId ? "bg-brand-50 text-brand-700" : "text-ink"
                          }`}
                          onClick={() => {
                            setBusinessId(b.tenant_id);
                            setContextOpen(false);
                          }}
                        >
                          {b.display_name}
                          {b.tenant_id === businessId && <span className="ml-2 text-xs">?</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <LogoutButton />
          </div>

          <button
            type="button"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-200 px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-2">
                <LogoutButton />
              </div>
            </nav>
          </div>
        )}
      </header>

      <RescanBanner businessId={businessId} />

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
