export function ProductSkeleton() {
  return (
    <div className="group rounded-2xl overflow-hidden border border-amber-400/25 bg-white/[0.035] animate-pulse">
      <div className="relative aspect-square bg-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700/20 to-gray-800/20" />
      </div>
      <div className="p-4 text-center">
        <div className="h-4 bg-gray-600/30 rounded mb-2"></div>
        <div className="h-3 bg-gray-600/20 rounded w-3/4 mx-auto"></div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  )
}
