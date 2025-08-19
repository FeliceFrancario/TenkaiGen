export default function CategoriesPage() {
  const cats = ['T-Shirts','Hoodies','Totes','Mugs','Posters','Phone Cases','Stickers','Hats']
  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl font-semibold mb-6">Categories</h1>
      <p className="text-white/60 mb-8">Browse products. This is a placeholder page.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cats.map((c) => (
          <div key={c} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
            {c}
          </div>
        ))}
      </div>
    </main>
  )
}
