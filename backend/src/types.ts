export type ProductSyncSource = 'manual' | 'tiendanube' | 'lupo_hub' | 'mercadolibre';

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  sku?: string;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  price: number;
  /** Stock disponible (sincronizable desde Lupo Hub / ML / TN) */
  stockQuantity: number;
  image: string;
  category: string;
  description?: string;
  /** ID legado / genérico */
  externalId?: string;
  externalTnId?: string;
  externalMlId?: string;
  source?: 'tiendanube' | 'local';
  syncSource?: ProductSyncSource;
  hubSyncedAt?: string | null;
  variants?: ProductVariant[];
}

export interface Customer {
  id: number;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  createdAt: string;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface Order {
  id: number;
  customerId: number | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: number;
  productId: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CustomerJwtPayload {
  typ: 'customer';
  sub: number;
}

export interface AdminJwtPayload {
  typ: 'admin';
  sub: number;
  role: string;
}
