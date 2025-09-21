'use client'

import { useState, useEffect, useRef } from 'react'

const LANGUAGES = [
  { code: 'en_US', name: 'English (US)', flag: 'us' },
  { code: 'en_GB', name: 'English (UK)', flag: 'gb' },
  { code: 'en_CA', name: 'English (CA)', flag: 'ca' },
  { code: 'es_ES', name: 'Español', flag: 'es' },
  { code: 'fr_FR', name: 'Français', flag: 'fr' },
  { code: 'de_DE', name: 'Deutsch', flag: 'de' },
  { code: 'it_IT', name: 'Italiano', flag: 'it' },
  { code: 'ja_JP', name: '日本語', flag: 'jp' },
]

export function LanguageSelector() {
  const [locale, setLocale] = useState<string>('en_US')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize from localStorage or cookie
    const storedLocale = localStorage.getItem('locale')
    if (storedLocale) {
      setLocale(storedLocale)
    } else {
      // Auto-detect from browser or default to US
      const browserLang = navigator.language || 'en-US'
      const detectedLocale = browserLang.replace('-', '_')
      const matchedLocale = LANGUAGES.find(l => l.code === detectedLocale)?.code || 'en_US'
      setLocale(matchedLocale)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale)
    setIsOpen(false)
    
    // Persist in localStorage and cookie
    localStorage.setItem('locale', newLocale)
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`
    
    // Set HTML lang attribute
    document.documentElement.lang = newLocale.split('_')[0]
    
    // Reload to apply new locale
    window.location.reload()
  }

  const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0]

  return (
    <div className="hidden sm:block relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="dark-dropdown appearance-none text-xs rounded-lg px-2 py-1 pr-6 flex items-center gap-2 min-w-[120px]"
        title="Language"
      >
        <span className={`fi fi-${currentLanguage.flag}`}></span>
        <span className="truncate">{currentLanguage.name}</span>
        <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full rounded-lg border border-white/15 bg-black/90 backdrop-blur-sm shadow-xl z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLocaleChange(lang.code)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/10 transition-colors ${
                locale === lang.code ? 'bg-amber-500/20 text-amber-200' : 'text-white/90'
              }`}
            >
              <span className={`fi fi-${lang.flag}`}></span>
              <span className="truncate">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
