export type ProductSyncSource = 'manual' | 'tiendanube' | 'lupo_hub' | 'mercadolibre';

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  sku?: string;
  size?: string;
  colorName?: string;
  colorHex?: string;
  image?: string;
  optionValues?: Array<{
    name: string;
    value: string;
    swatch?: string;
  }>;
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
  images?: string[];
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
  paymentMethod: PaymentMethod;
  installments: number;
  installmentInterestRate: number;
  paymentReference: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  total: number;
  currency: string;
  shippingTrackingNumber: string | null;
  shippingProvider: string | null;
  shippingStatus: string | null;
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

export type PaymentMethod = 'mercado_pago' | 'card' | 'bank_transfer' | 'cash';

export interface CustomerJwtPayload {
  typ: 'customer';
  sub: number;
}

export interface AdminJwtPayload {
  typ: 'admin';
  sub: number;
  role: string;
}
