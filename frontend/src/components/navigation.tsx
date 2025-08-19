'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FiMenu, FiX, FiUser, FiShoppingCart } from 'react-icons/fi'

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full z-50 glass-effect border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gradient-gold">TenkaiGen</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <a href="#" className="text-white hover:text-tenkai-gold transition-colors px-3 py-2 text-sm font-medium">
                Home
              </a>
              <a href="#" className="text-white hover:text-tenkai-gold transition-colors px-3 py-2 text-sm font-medium">
                Gallery
              </a>
              <a href="#" className="text-white hover:text-tenkai-gold transition-colors px-3 py-2 text-sm font-medium">
                How it Works
              </a>
              <a href="#" className="text-white hover:text-tenkai-gold transition-colors px-3 py-2 text-sm font-medium">
                Pricing
              </a>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="text-white hover:text-tenkai-gold">
              <FiUser className="h-4 w-4 mr-2" />
              Sign In
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:text-tenkai-gold">
              <FiShoppingCart className="h-4 w-4 mr-2" />
              Cart
            </Button>
            <Button variant="gold" size="sm">
              Get Started
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white"
            >
              {isMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 glass-effect">
            <a href="#" className="text-white hover:text-tenkai-gold block px-3 py-2 text-base font-medium">
              Home
            </a>
            <a href="#" className="text-white hover:text-tenkai-gold block px-3 py-2 text-base font-medium">
              Gallery
            </a>
            <a href="#" className="text-white hover:text-tenkai-gold block px-3 py-2 text-base font-medium">
              How it Works
            </a>
            <a href="#" className="text-white hover:text-tenkai-gold block px-3 py-2 text-base font-medium">
              Pricing
            </a>
            <div className="pt-4 pb-3 border-t border-white/10">
              <div className="flex items-center px-3 space-x-3">
                <Button variant="ghost" size="sm" className="text-white">
                  <FiUser className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button variant="gold" size="sm">
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
