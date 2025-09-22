'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const sortOptions = [
  { value: 'bestseller', label: 'Bestseller' },
  { value: 'new', label: 'Newest' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'rating', label: 'Highest Rated' },
]

export function SortingSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sort, setSort] = useState('bestseller')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const currentSort = searchParams.get('sort') || 'bestseller'
    setSort(currentSort)
    setIsLoading(false) // Reset loading when page loads
  }, [searchParams])

  const handleSortChange = (newSort: string) => {
    if (newSort === sort) return // Don't reload if same sort
    
    setIsLoading(true)
    setSort(newSort)
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', newSort)
    params.delete('page') // Reset to first page when sorting changes
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium text-amber-200">
        Sort by:
      </label>
      <div className="relative">
        <select
          id="sort"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          disabled={isLoading}
          className="bg-gray-800 border border-gray-600 text-amber-200 text-sm rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 px-3 py-1.5 min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-gray-800 text-amber-200">
              {option.label}
            </option>
          ))}
        </select>
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-400 border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  )
}
