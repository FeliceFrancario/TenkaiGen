'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: 'us' },
  { code: 'CA', name: 'Canada', flag: 'ca' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
  { code: 'DE', name: 'Germany', flag: 'de' },
  { code: 'FR', name: 'France', flag: 'fr' },
  { code: 'ES', name: 'Spain', flag: 'es' },
  { code: 'IT', name: 'Italy', flag: 'it' },
  { code: 'JP', name: 'Japan', flag: 'jp' },
  { code: 'AU', name: 'Australia', flag: 'au' },
  { code: 'NZ', name: 'New Zealand', flag: 'nz' },
  { code: 'BR', name: 'Brazil', flag: 'br' },
  { code: 'MX', name: 'Mexico', flag: 'mx' },
  { code: 'NL', name: 'Netherlands', flag: 'nl' },
  { code: 'SE', name: 'Sweden', flag: 'se' },
  { code: 'NO', name: 'Norway', flag: 'no' },
  { code: 'DK', name: 'Denmark', flag: 'dk' },
  { code: 'FI', name: 'Finland', flag: 'fi' },
  { code: 'PL', name: 'Poland', flag: 'pl' },
  { code: 'PT', name: 'Portugal', flag: 'pt' },
  { code: 'IE', name: 'Ireland', flag: 'ie' },
  { code: 'AT', name: 'Austria', flag: 'at' },
  { code: 'BE', name: 'Belgium', flag: 'be' },
  { code: 'CH', name: 'Switzerland', flag: 'ch' },
  { code: 'CZ', name: 'Czech Republic', flag: 'cz' },
  { code: 'HU', name: 'Hungary', flag: 'hu' },
  { code: 'RO', name: 'Romania', flag: 'ro' },
  { code: 'SK', name: 'Slovakia', flag: 'sk' },
  { code: 'SI', name: 'Slovenia', flag: 'si' },
  { code: 'GR', name: 'Greece', flag: 'gr' },
  { code: 'EE', name: 'Estonia', flag: 'ee' },
  { code: 'LT', name: 'Lithuania', flag: 'lt' },
  { code: 'LV', name: 'Latvia', flag: 'lv' },
  { code: 'LU', name: 'Luxembourg', flag: 'lu' },
  { code: 'MT', name: 'Malta', flag: 'mt' },
  { code: 'BG', name: 'Bulgaria', flag: 'bg' },
  { code: 'HR', name: 'Croatia', flag: 'hr' },
]

export function ShippingCountrySelector() {
  const [country, setCountry] = useState<string>('US')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize from cookie or URL param
    const cookieCountry = document.cookie
      .split('; ')
      .find(row => row.startsWith('country_code='))
      ?.split('=')[1]
    
    const urlCountry = searchParams.get('country')
    const initialCountry = urlCountry || cookieCountry || 'US'
    setCountry(initialCountry)
  }, [searchParams])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    setIsOpen(false)
    
    // Set cookie
    document.cookie = `country_code=${newCountry}; path=/; max-age=31536000`
    
    // Update URL with new country
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('country', newCountry)
    const search = current.toString()
    const query = search ? `?${search}` : ''
    
    router.push(`${window.location.pathname}${query}`)
  }

  const currentCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]

  return (
    <div className="mt-6 space-y-3">
      <div className="text-xs uppercase tracking-wide text-white/50">Shipping country</div>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full dark-dropdown text-sm rounded-lg px-3 py-2 pr-8 flex items-center gap-2"
        >
          <span className={`fi fi-${currentCountry.flag}`}></span>
          <span className="truncate">{currentCountry.name} ({currentCountry.code})</span>
          <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-white/15 bg-black/90 backdrop-blur-sm shadow-xl z-50 max-h-60 overflow-y-auto">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountryChange(country.code)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                  country.code === country.code ? 'bg-amber-500/20 text-amber-200' : 'text-white/90'
                }`}
              >
                <span className={`fi fi-${country.flag}`}></span>
                <span className="truncate">{country.name} ({country.code})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="text-[11px] text-white/50">
        Products not shipping to your country will be marked as unavailable.
      </div>
    </div>
  )
}
