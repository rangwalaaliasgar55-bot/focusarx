interface SkeletonCardProps {
  rows?: number;
  hasAvatar?: boolean;
  height?: string;
  className?: string;
}

function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[rgba(124,58,237,0.08)] ${className}`}
      style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.06) 25%, rgba(124,58,237,0.12) 50%, rgba(124,58,237,0.06) 75%)", backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.5s infinite" }}
    />
  );
}

export default function SkeletonCard({ rows = 3, hasAvatar = false, height, className = "" }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-2xl border border-[rgba(124,58,237,0.12)] bg-[rgba(10,15,30,0.6)] p-4 ${className}`}
      style={height ? { height } : undefined}
    >
      {hasAvatar && (
        <div className="flex items-center gap-3 mb-3">
          <SkeletonPulse className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonPulse className="h-3.5 w-24 rounded" />
            <SkeletonPulse className="h-3 w-16 rounded" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonPulse
            key={i}
            className={`h-3.5 rounded ${i === rows - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={3} hasAvatar />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={2} hasAvatar />
      ))}
    </div>
  );
}
