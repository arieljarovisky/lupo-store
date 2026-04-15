export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  /** ID en Tienda Nube / Nuvemshop */
  externalId?: string;
  source?: 'tiendanube' | 'local';
}
