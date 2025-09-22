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

  useEffect(() => {
    const currentSort = searchParams.get('sort') || 'bestseller'
    setSort(currentSort)
  }, [searchParams])

  const handleSortChange = (newSort: string) => {
    console.log('🔄 Sorting changed to:', newSort)
    setSort(newSort)
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', newSort)
    params.delete('page') // Reset to first page when sorting changes
    const newUrl = `?${params.toString()}`
    console.log('🔗 Navigating to:', newUrl)
    router.push(newUrl)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium text-amber-200">
        Sort by:
      </label>
      <select
        id="sort"
        value={sort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 text-amber-200 text-sm rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 px-3 py-1.5 min-w-[160px]"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-800 text-amber-200">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
