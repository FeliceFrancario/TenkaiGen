/**
 * Determines gender context from category hierarchy
 */
export function getCategoryGender(categoryId: number, allCategories: Array<{ id: number; parent_id: number | null; title?: string; slug?: string }>): 'male' | 'female' | 'unisex' {
  // Men's clothing: 1
  // Women's clothing: 2
  // Kids: 3
  
  const MENS_CATEGORY_ID = 1
  const WOMENS_CATEGORY_ID = 2
  
  // Build category map
  const byId = new Map(allCategories.map(c => [c.id, c]))
  
  // Traverse up the hierarchy
  let current = byId.get(categoryId)
  const visited = new Set<number>()
  
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    
    // Check if we've reached a gender-defining category
    if (current.id === MENS_CATEGORY_ID) return 'male'
    if (current.id === WOMENS_CATEGORY_ID) return 'female'
    
    // Check title/slug for gender keywords
    const title = current.title?.toLowerCase() || ''
    const slug = current.slug?.toLowerCase() || ''
    
    if (title.includes('men') || slug.includes('men')) {
      if (!title.includes('women') && !slug.includes('women')) {
        return 'male'
      }
    }
    
    if (title.includes('women') || slug.includes('women') || title.includes('ladies') || slug.includes('ladies')) {
      return 'female'
    }
    
    // Move to parent
    if (current.parent_id) {
      current = byId.get(current.parent_id)
    } else {
      break
    }
  }
  
  return 'unisex'
}

/**
 * Gets breadcrumb trail for a category
 */
export function getCategoryAncestors(
  categoryId: number, 
  allCategories: Array<{ id: number; parent_id: number | null; title?: string }>
): Array<{ id: number; title: string }> {
  const byId = new Map(allCategories.map(c => [c.id, c]))
  const ancestors: Array<{ id: number; title: string }> = []
  
  let current = byId.get(categoryId)
  const visited = new Set<number>()
  
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ancestors.unshift({ id: current.id, title: current.title || `Category ${current.id}` })
    
    if (current.parent_id) {
      current = byId.get(current.parent_id)
    } else {
      break
    }
  }
  
  return ancestors
}

