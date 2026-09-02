import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  isLoading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

const alignClass: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const skeletonRowKeys = ["s1", "s2", "s3", "s4", "s5"];

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyState,
  className = "",
}: DataTableProps<T>) {
  const isEmpty = !isLoading && data.length === 0;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table role="table" className="w-full">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`px-4 py-3 bg-gray-50 text-xs font-medium text-ink-muted uppercase tracking-wider ${alignClass[col.align ?? "left"]}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            skeletonRowKeys.map((skKey) => (
              <tr key={skKey} aria-hidden="true">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 border-t border-gray-100 ${alignClass[col.align ?? "left"]}`}
                  >
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50/50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm text-ink border-t border-gray-100 ${alignClass[col.align ?? "left"]}`}
                  >
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, ReactNode>)[col.key]}
                  </td>
                ))}
              </tr>
            ))}

          {isEmpty && (
            <tr>
              <td colSpan={columns.length} className="border-t border-gray-100">
                {emptyState ?? <EmptyState title="No records found" />}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
