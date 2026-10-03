export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      <main className="flex-1 container mx-auto px-4 py-12 pb-32">
        <div className="max-w-2xl mx-auto">
          {/* Profile card skeleton */}
          <div className="bg-brand-white border-4 border-brand-black/10 animate-pulse p-5 sm:p-8 mb-12 flex flex-col md:flex-row gap-6 sm:gap-8 items-start rounded-xl">
            {/* Avatar circle */}
            <div className="flex flex-col items-center gap-4 w-full md:w-auto">
              <div className="w-32 h-32 rounded-full bg-brand-black/10" />
              {/* Upload button placeholder */}
              <div className="h-8 w-28 bg-brand-black/10 rounded" />
            </div>

            {/* Info section */}
            <div className="flex-1 w-full">
              {/* "PROFILE" heading placeholder */}
              <div className="h-10 w-36 bg-brand-black/10 rounded mb-6" />

              <div className="space-y-4">
                {/* Name row */}
                <div className="border-b-4 border-brand-black/10 pb-2 flex items-center gap-4">
                  <div className="h-4 w-16 bg-brand-black/10 rounded shrink-0" />
                  <div className="h-4 flex-1 bg-brand-black/10 rounded" />
                </div>
                {/* Email row */}
                <div className="border-b-4 border-brand-black/10 pb-2 flex items-center gap-4">
                  <div className="h-4 w-16 bg-brand-black/10 rounded shrink-0" />
                  <div className="h-4 flex-1 bg-brand-black/10 rounded" />
                </div>
                {/* Role row */}
                <div className="border-b-4 border-brand-black/10 pb-2 flex items-center gap-4">
                  <div className="h-4 w-16 bg-brand-black/10 rounded shrink-0" />
                  <div className="h-4 w-24 bg-brand-black/10 rounded" />
                </div>
              </div>

              {/* Logout button placeholder */}
              <div className="h-9 w-24 bg-brand-black/10 rounded mt-8" />
            </div>
          </div>

          {/* Serving History card skeleton */}
          <div className="bg-brand-white border-4 border-brand-black/10 animate-pulse p-5 sm:p-8 rounded-xl">
            {/* "SERVING HISTORY" heading */}
            <div className="h-8 w-48 bg-brand-black/10 rounded mb-6" />

            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-brand-black/10 pb-4 last:border-0 gap-2"
                >
                  <div className="flex flex-col gap-1">
                    <div className="h-5 w-48 bg-brand-black/10 rounded" />
                    <div className="h-4 w-36 bg-brand-black/10 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-brand-black/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
