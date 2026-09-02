import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-surface shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
