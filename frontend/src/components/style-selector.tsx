'use client'

export function StyleSelector() {
  const styles = [
    { name: "Anime", description: "Japanese animation style", emoji: "🎌" },
    { name: "Line Art", description: "Clean minimalist lines", emoji: "✏️" },
    { name: "Flat Logo", description: "Modern flat design", emoji: "🎯" },
    { name: "Watercolor", description: "Artistic paint effect", emoji: "🎨" },
    { name: "Abstract", description: "Creative abstract art", emoji: "🌀" },
    { name: "Minimalist", description: "Simple clean design", emoji: "⚪" },
    { name: "Vintage", description: "Retro classic style", emoji: "📻" },
    { name: "Grunge", description: "Edgy urban aesthetic", emoji: "🔥" }
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Choose Your <span className="text-gradient-gold">Style</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Select from our curated collection of artistic styles to match your vision
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {styles.map((style, index) => (
            <div
              key={index}
              className="glass-effect rounded-xl p-6 hover-lift border border-white/10 cursor-pointer group hover:border-tenkai-gold/50 transition-all"
            >
              <div className="text-center">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {style.emoji}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{style.name}</h3>
                <p className="text-sm text-gray-400">{style.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
