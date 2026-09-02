import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className = "",
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const hasPrev = page > 1;
  const hasNext = page * pageSize < totalItems;

  return (
    <div className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`}>
      <p className="text-sm text-ink-muted">
        Showing <span className="font-medium text-ink">{start}</span> to{" "}
        <span className="font-medium text-ink">{end}</span> of{" "}
        <span className="font-medium text-ink">{totalItems}</span> results
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!hasPrev} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
