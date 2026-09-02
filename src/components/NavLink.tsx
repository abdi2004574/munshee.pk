import { NavLink as RRNavLink, type NavLinkProps } from "react-router";

export function NavLink({ className, ...rest }: NavLinkProps) {
  return (
    <RRNavLink
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700"
            : "text-ink-muted hover:text-ink"
        } ${typeof className === "function" ? className({ isActive: false, isPending: false, isTransitioning: false }) : className ?? ""}`
      }
      {...rest}
    />
  );
}
