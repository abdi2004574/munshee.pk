interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

const px = (v?: string | number) => (v == null ? undefined : typeof v === "number" ? `${v}px` : v);

export function Skeleton({ width, height, className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
      style={{ width: px(width), height: px(height) }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = "" }: SkeletonCardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      <Skeleton height={14} className="w-1/3 mb-4" />
      <Skeleton height={28} className="w-1/2 mb-2" />
      <SkeletonText lines={2} />
    </div>
  );
}
