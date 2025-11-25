# E-commerce Backend with Printful Integration

This system replaces direct Printful API calls with a structured database approach using Supabase Postgres. It provides consistent pricing, better performance, and easier maintenance.

## 🏗️ Architecture

### Database Schema
- **providers**: POD service providers (Printful, Gelato, etc.)
- **categories**: Product categories with hierarchical structure
- **products**: Product information with base USD pricing
- **variants**: Product variants (size, color, SKU)
- **pricing_rules**: Markup rules per product/currency
- **exchange_rates**: Real-time currency conversion rates
- **images**: Product images with type and gender classification

### Key Benefits
- ✅ **Consistent Pricing**: Same prices across catalog and detail pages
- ✅ **Performance**: No more direct API calls during user interactions
- ✅ **Scalability**: Easy to add new providers (Gelato, Printify)
- ✅ **Maintainability**: Structured data with proper relationships
- ✅ **Future-Proof**: Ready for user designs and orders

## 🚀 Setup

### 1. Database Migrations
Run the SQL migrations in order:
```bash
# Apply migrations to Supabase
supabase db push
```

### 2. Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PRINTFUL_API_TOKEN=your_printful_api_token
```

### 3. Initial Sync
```bash
# Trigger initial sync
curl -X POST "http://localhost:3000/api/sync/printful" \
  -H "Content-Type: application/json" \
  -d '{"locale": "en_US"}'
```

## 📊 API Endpoints

### Sync Operations
- `POST /api/sync/printful` - Sync Printful products and categories
- `POST /api/exchange-rates` - Update currency exchange rates

### Data Access
- `GET /api/products?category_id=xxx&currency=EUR&limit=24` - Get products with pricing
- `GET /api/categories` - Get all categories

## 💰 Pricing System

### How It Works
1. **Base Price**: Stored in USD for all products
2. **Markup Rules**: Applied per product/currency (default: 20%)
3. **Exchange Rates**: Real-time conversion to target currency
4. **Final Price**: `(basePrice + markup) * exchangeRate`

### Example
```typescript
// Base price: $10 USD
// Markup: 20% = $2
// EUR rate: 0.85
// Final price: ($10 + $2) * 0.85 = €10.20
```

## 🔄 Automated Syncing

### Cron Job Setup
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /path/to/scripts/sync-cron.sh
```

### Manual Sync
```bash
# Update exchange rates
curl -X POST "http://localhost:3000/api/exchange-rates"

# Sync Printful data
curl -X POST "http://localhost:3000/api/sync/printful"
```

## 🛠️ Usage Examples

### Get Products with Pricing
```typescript
import { getProductsWithPricing } from '@/lib/pricing'

const products = await getProductsWithPricing(
  'category-id',  // optional
  'EUR',          // currency
  24,             // limit
  0               // offset
)
```

### Calculate Single Price
```typescript
import { calculateRetailPrice } from '@/lib/pricing'

const pricing = await calculateRetailPrice(
  10.00,    // base price USD
  'EUR',    // target currency
  'prod-id' // product ID (optional)
)

console.log(pricing.retailPrice) // €10.20
```

## 🔧 Customization

### Adding New Providers
1. Insert into `providers` table
2. Create provider-specific sync function
3. Add to sync API route

### Custom Pricing Rules
```sql
-- Add product-specific pricing rule
INSERT INTO pricing_rules (product_id, markup_type, markup_value, currency)
VALUES ('product-id', 'percentage', 25, 'EUR');

-- Add default rule for new currency
INSERT INTO pricing_rules (markup_type, markup_value, currency)
VALUES ('percentage', 30, 'GBP');
```

## 📈 Performance

### Indexes
- `products.slug` - Fast product lookups
- `products.category_id` - Category filtering
- `variants.product_id` - Variant queries
- `exchange_rates.currency` - Currency conversion

### Caching
- Exchange rates cached in database
- Product data cached between syncs
- Pricing calculations cached per request

## 🚨 Troubleshooting

### Common Issues
1. **Sync Fails**: Check Printful API token
2. **Pricing Wrong**: Verify exchange rates are updated
3. **Missing Products**: Check category mapping
4. **Slow Queries**: Verify indexes are created

### Debugging
```typescript
// Enable debug logging
console.log('🔄 Syncing categories...')
console.log('📦 Found 150 products')
console.log('✅ Sync completed')
```

## 🔮 Future Enhancements

### Planned Features
- [ ] User-generated designs
- [ ] Order management
- [ ] Inventory tracking
- [ ] Multi-provider support
- [ ] Advanced pricing rules
- [ ] Product recommendations

### Extensibility
The schema is designed to easily add:
- New POD providers
- Custom pricing models
- User-specific rules
- Advanced analytics

---

**Next Steps**: Run the migrations, set up environment variables, and trigger the initial sync to populate your database with Printful products!
