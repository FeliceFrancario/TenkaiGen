'use client'

export function HowItWorks() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      badge: '',
      features: [
        'Basic model access',
        'Daily credits (limited)',
        'Non‑commercial use',
        'Standard mockups',
      ],
      cta: 'Get started',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$9',
      badge: 'Most Popular',
      features: [
        'Advanced models + variants',
        'Priority queue & more credits',
        'Commercial use allowed',
        'High‑res mockups & editing tools',
      ],
      cta: 'Subscribe',
      highlight: true,
    },
    {
      name: 'Premier',
      price: '$24',
      badge: 'Best Value',
      features: [
        'Max credits & top priority',
        'Team seats (up to 3)',
        'Brand kit & templates',
        'Premium support',
      ],
      cta: 'Choose plan',
      highlight: false,
    },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto fade-in-up">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">Pricing</h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Start free. Upgrade when you need more credits, quality, and speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border bg-white/[0.04] border-white/10 p-6 transition-all hover:bg-white/[0.06] hover:-translate-y-0.5 ${
                p.highlight ? 'ring-1 ring-tenkai-gold/40 glow-gold' : ''
              } fade-in-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {p.badge && (
                <span className="absolute -top-3 left-6 text-[11px] tracking-wide uppercase px-2 py-1 rounded-full bg-tenkai-gold/20 text-tenkai-gold border border-tenkai-gold/40">
                  {p.badge}
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-white text-xl font-semibold">{p.name}</h3>
                <div className="flex items-end gap-1 mt-3">
                  <span className="text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-white/50 text-sm">/mo</span>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-white/80 mb-6">
                {p.features.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-tenkai-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn-shimmer w-full rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  p.highlight
                    ? 'bg-white text-black hover:opacity-90'
                    : 'bg-gradient-to-r from-tenkai-gold/15 to-red-500/15 text-white hover:from-tenkai-gold/25 hover:to-red-500/25'
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Prices shown in USD. Cancel anytime.
        </p>
      </div>
    </section>
  )
}
