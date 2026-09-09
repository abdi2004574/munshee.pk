import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ children, className = "", id }: CardProps) {
  return (
    <div
      id={id}
      className={`rounded-xl border border-gray-100 bg-surface ${className}`}
    >
      {children}
    </div>
  );
}
