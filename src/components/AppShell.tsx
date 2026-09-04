import { useState, type ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/features/auth/LogoutButton";

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
];

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <a href="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-bold text-brand-600">Munshee</span>
              <span className="text-lg font-bold text-ink">.pk</span>
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden md:block">
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
          <div className="border-t border-gray-100 px-4 py-3 md:hidden">
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

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
