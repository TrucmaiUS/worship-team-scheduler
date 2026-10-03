export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-8 pb-32">
        {/* User header skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-brand-black/10 animate-pulse rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            {/* Title placeholder */}
            <div className="h-8 w-48 bg-brand-black/10 animate-pulse rounded" />
            {/* Subtitle placeholder */}
            <div className="h-4 w-32 bg-brand-black/10 animate-pulse rounded" />
          </div>
        </div>

        {/* Section heading placeholder */}
        <div className="h-6 w-40 bg-brand-black/10 animate-pulse rounded mb-6" />

        {/* 3 skeleton service cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-brand-white border-2 border-brand-black/10 animate-pulse rounded-xl p-4 h-48"
            />
          ))}
        </div>

        {/* Second section heading */}
        <div className="h-6 w-52 bg-brand-black/10 animate-pulse rounded mt-12 mb-6" />

        {/* Another row of skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-brand-white border-2 border-brand-black/10 animate-pulse rounded-xl p-4 h-48"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
