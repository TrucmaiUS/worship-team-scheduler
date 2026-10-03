export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-8 pb-32">
        {/* Page header skeleton */}
        <div className="mb-8 border-b-8 border-brand-black/10 pb-4">
          <div className="h-10 w-56 bg-brand-black/10 animate-pulse rounded mb-2" />
          <div className="h-4 w-40 bg-brand-black/10 animate-pulse rounded" />
        </div>

        {/* 3 stat boxes */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-brand-white border-4 border-brand-black/10 animate-pulse p-4 text-center rounded"
            >
              <div className="h-4 w-24 bg-brand-black/10 rounded mx-auto mb-3" />
              <div className="h-10 w-16 bg-brand-black/10 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Tab button placeholders */}
        <div className="flex gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-9 w-28 bg-brand-black/10 animate-pulse rounded border-2 border-brand-black/10"
            />
          ))}
        </div>

        {/* Big schedule table placeholder */}
        <div className="bg-brand-white border-4 border-brand-black/10 animate-pulse rounded-xl overflow-hidden">
          {/* Table header row */}
          <div className="flex gap-4 p-4 border-b-2 border-brand-black/10">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-5 flex-1 bg-brand-black/10 rounded" />
            ))}
          </div>
          {/* Table body rows */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex gap-4 p-4 border-b border-brand-black/5 last:border-0"
            >
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-4 flex-1 bg-brand-black/10 rounded" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
