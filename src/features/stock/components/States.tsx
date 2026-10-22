/**
 * Loading shells for the stock screens: the shape of the list before the data.
 */

export function StockListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-card flex items-center gap-3 p-3">
          <div className="skeleton size-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function MovementListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-card flex items-start gap-3 p-3">
          <div className="skeleton size-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-1/4" />
          </div>
          <div className="skeleton h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
