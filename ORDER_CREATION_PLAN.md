# Printful Order Creation Implementation Plan

## Overview
Create a complete order submission system that takes cart items and submits them to Printful for fulfillment.

---

## Current Cart Implementation

### ✅ What's Working:
- **Designer Flow**: User creates design → generates mockups → adds to cart
- **Cart Page**: Displays cart items with mockups, prices, quantities
- **Shipping Estimates**: Fetches shipping rates from Printful
- **Database**: `cart_items` table with all necessary fields:
  - `files` (JSONB): Design files with placements and positions
  - `mockups` (JSONB): Generated mockup URLs
  - `printful_variant_id`: Printful variant ID for ordering

---

## Phase 1: Create Orders Database Schema

### Migration: `orders` table

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Printful integration
  printful_order_id BIGINT UNIQUE,
  printful_external_id TEXT UNIQUE, -- Our reference ID
  
  -- Order status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'confirmed', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'failed')),
  
  -- Order items (snapshot from cart)
  items JSONB NOT NULL,
  
  -- Pricing
  subtotal NUMERIC NOT NULL,
  shipping_cost NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Shipping information
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_address1 TEXT NOT NULL,
  recipient_address2 TEXT,
  recipient_city TEXT NOT NULL,
  recipient_state_code TEXT,
  recipient_state_name TEXT,
  recipient_country_code TEXT NOT NULL,
  recipient_country_name TEXT NOT NULL,
  recipient_zip TEXT NOT NULL,
  
  -- Shipping method
  shipping_method TEXT, -- e.g., STANDARD, EXPRESS
  
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_to_printful_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_printful_order_id ON orders(printful_order_id);
```

---

## Phase 2: Checkout Flow

### Step 1: Create Checkout Page `/checkout`

**File**: `frontend/src/app/checkout/page.tsx`

**UI Components:**
1. **Cart Summary** (read-only)
   - List items from cart
   - Show quantities, thumbnails
   - Display subtotal

2. **Shipping Information Form**
   ```tsx
   - Full Name *
   - Email *
   - Phone (optional)
   - Address Line 1 *
   - Address Line 2
   - City *
   - State/Province * (for US, CA, AU)
   - Postal Code *
   - Country * (dropdown)
   ```

3. **Shipping Method Selection**
   - Fetch from `/api/printful/shipping-rates`
   - Show options with prices
   - Radio buttons for selection

4. **Order Summary**
   - Subtotal
   - Shipping
   - Tax (future)
   - **Total**

5. **Place Order Button**
   - Validates form
   - Creates order (draft)
   - Redirects to order confirmation

### Step 2: Create Order Draft API

**Endpoint**: `POST /api/orders/create`

**Request Body:**
```json
{
  "shipping": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "address1": "123 Main St",
    "address2": "Apt 4B",
    "city": "New York",
    "state_code": "NY",
    "country_code": "US",
    "zip": "10001"
  },
  "shipping_method": "STANDARD",
  "shipping_rate": 5.99,
  "currency": "USD"
}
```

**Logic:**
1. Get user's cart items
2. Calculate subtotal (from our `/api/db/price`)
3. Validate shipping info
4. Create order record with status='draft'
5. Snapshot cart items to order.items (JSONB)
6. Return order ID

**Response:**
```json
{
  "order_id": "uuid",
  "total": 45.99,
  "items_count": 3
}
```

---

## Phase 3: Submit Order to Printful

### Step 1: Prepare Design Files

**Challenge**: Printful needs hosted file URLs

**Solutions:**
1. **If designs already in B2/S3**: Use those URLs directly
2. **If mockups from Printful**: Files are already hosted, extract from cart_items.files

**In cart_items, we store:**
```json
"files": [
  {
    "placement": "front",
    "image_url": "https://...",
    "position": {
      "area_width": 1800,
      "area_height": 2400,
      "width": 1800,
      "height": 1800,
      "top": 300,
      "left": 0
    }
  }
]
```

These URLs are already accessible - we can use them directly!

### Step 2: Submit to Printful Orders API

**Endpoint**: `POST /api/orders/[id]/submit`

**Logic:**
1. Fetch order from database
2. Validate order status is 'draft'
3. Build Printful payload:

```typescript
const printfulPayload = {
  external_id: order.id, // Our UUID
  recipient: {
    name: order.recipient_name,
    address1: order.recipient_address1,
    address2: order.recipient_address2 || undefined,
    city: order.recipient_city,
    state_code: order.recipient_state_code || undefined,
    country_code: order.recipient_country_code,
    zip: order.recipient_zip,
    phone: order.recipient_phone || undefined,
    email: order.recipient_email,
  },
  items: order.items.map((item: any) => ({
    variant_id: item.printful_variant_id,
    quantity: item.quantity,
    files: item.files.map((f: any) => ({
      url: f.image_url,
      options: [{
        id: f.placement,
        value: {
          area_width: f.position.area_width,
          area_height: f.position.area_height,
          width: f.position.width,
          height: f.position.height,
          top: f.position.top,
          left: f.position.left,
        }
      }]
    }))
  })),
  retail_costs: {
    currency: order.currency,
    subtotal: String(order.subtotal),
    shipping: String(order.shipping_cost),
    tax: String(order.tax || 0),
    total: String(order.total),
  }
}
```

4. Call Printful API:
```typescript
const response = await fetch('https://api.printful.com/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(printfulPayload)
})
```

5. Handle response:
   - Success: Update order with printful_order_id, status='confirmed'
   - Error: Update error_message, increment retry_count

6. Clear user's cart

7. Return success

### Step 3: Confirm Order

**Endpoint**: `POST /api/orders/[id]/confirm`

Printful orders are created as drafts. To actually process them:

```typescript
await fetch(`https://api.printful.com/orders/${printful_order_id}/confirm`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
  }
})
```

Update order status to 'processing'.

---

## Phase 4: Order Status & Webhooks

### Webhook Handler

**Endpoint**: `POST /api/webhooks/printful`

**Printful Events:**
- `order_created` - Order created
- `order_updated` - Status changed
- `package_shipped` - Tracking info available
- `package_returned` - Order returned
- `order_failed` - Order failed
- `order_canceled` - Order cancelled

**Handler Logic:**
```typescript
export async function POST(req: Request) {
  // 1. Verify webhook signature (Printful sends X-Pf-Signature)
  const signature = req.headers.get('X-Pf-Signature')
  // Verify signature with your store's secret
  
  // 2. Parse payload
  const payload = await req.json()
  const { type, data } = payload
  
  // 3. Find order by printful_order_id
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('printful_order_id', data.order.id)
    .single()
  
  // 4. Update based on event type
  switch (type) {
    case 'package_shipped':
      await supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_number: data.shipment.tracking_number,
          tracking_url: data.shipment.tracking_url,
          carrier: data.shipment.carrier,
          shipped_at: new Date().toISOString()
        })
        .eq('id', order.id)
      
      // TODO: Send email to customer
      break
      
    case 'order_updated':
      await supabase
        .from('orders')
        .update({ status: mapPrintfulStatus(data.order.status) })
        .eq('id', order.id)
      break
      
    // ... other cases
  }
  
  return new Response('OK', { status: 200 })
}
```

### Manual Sync

**Endpoint**: `GET /api/orders/[id]/sync`

Manually fetch order status from Printful:

```typescript
const response = await fetch(`https://api.printful.com/orders/${printful_order_id}`, {
  headers: { 'Authorization': `Bearer ${PRINTFUL_API_TOKEN}` }
})

const { result } = await response.json()

// Update database with latest status, tracking info
```

---

## Phase 5: Order Management UI

### Orders List Page `/orders`

```tsx
- Table/List of user's orders
- Columns: Order #, Date, Status, Total, Actions
- Filter by status
- Sort by date
- Click to view details
```

### Order Detail Page `/orders/[id]`

```tsx
- Order information
  - Order ID, Date, Status
- Items ordered
  - Product images, names, quantities
- Shipping address
- Tracking information (if shipped)
  - Tracking number
  - Carrier
  - Tracking URL link
- Status timeline
  - Created → Confirmed → Processing → Shipped → Delivered
```

---

## Implementation Checklist

### Week 1: Database & Checkout
- [ ] Create `orders` table migration
- [ ] Create checkout page UI
- [ ] Shipping info form with validation
- [ ] Create `POST /api/orders/create` endpoint
- [ ] Test order draft creation

### Week 2: Printful Submission
- [ ] Create `POST /api/orders/[id]/submit` endpoint
- [ ] Build Printful API payload
- [ ] Handle file URLs from cart
- [ ] Submit to Printful API
- [ ] Error handling & retry logic
- [ ] Create `POST /api/orders/[id]/confirm` endpoint
- [ ] Clear cart after successful order

### Week 3: Order Status & Webhooks
- [ ] Create webhook endpoint `/api/webhooks/printful`
- [ ] Verify webhook signatures
- [ ] Handle order status updates
- [ ] Handle shipping notifications
- [ ] Create manual sync endpoint
- [ ] Test with Printful sandbox

### Week 4: Order Management UI
- [ ] Create orders list page
- [ ] Create order detail page
- [ ] Display tracking information
- [ ] Status timeline UI
- [ ] Email notifications (optional)

---

## Testing Strategy

### 1. Local Testing
- Use Printful **test mode** (sandbox API)
- Create test orders with various products
- Test error scenarios (invalid address, out of stock)

### 2. Printful API Testing
- Test file URL accessibility
- Verify position calculations
- Test with different product types
- Test shipping to various countries

### 3. End-to-End Flow
1. Create design in designer
2. Add to cart
3. Go to checkout
4. Fill shipping info
5. Submit order
6. Verify Printful receives order
7. Confirm order
8. Check order status updates

---

## Key Considerations

### File URLs
- ✅ Design files are already hosted (from designer)
- ✅ URLs are stored in cart_items.files
- ✅ Printful can access these URLs directly
- ⚠️ Ensure URLs are publicly accessible

### Pricing
- Use `/api/db/price` for our selling prices
- Store prices in order at checkout (snapshot)
- Handle currency conversion via exchange_rates table

### Error Handling
- Network errors → Retry with exponential backoff
- Validation errors → Show user-friendly messages
- Out of stock → Check before submission
- Payment failures → Handle gracefully (future)

### Order IDs
- Use our UUID as `external_id` in Printful
- Store Printful's `order_id` in our database
- Makes order tracking easier

---

## Next Immediate Steps

1. **Create orders table migration**
2. **Build checkout page UI**
3. **Implement order creation API**
4. **Test order draft flow**
5. **Implement Printful submission**

After checkout works, add webhooks and order management UI.

