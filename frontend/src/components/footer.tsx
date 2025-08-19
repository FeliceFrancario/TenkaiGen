export function Footer() {
  return (
    <footer className="py-10 px-4 sm:px-6 lg:px-8 bg-tenkai-dark border-t border-white/10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-gray-400 text-sm">© {new Date().getFullYear()} TenkaiGen. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm">
          <a href="#" className="text-gray-400 hover:text-tenkai-gold">Terms</a>
          <a href="#" className="text-gray-400 hover:text-tenkai-gold">Privacy</a>
          <a href="#" className="text-gray-400 hover:text-tenkai-gold">Contact</a>
        </div>
      </div>
    </footer>
  )
}
