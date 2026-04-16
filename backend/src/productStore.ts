import { listProducts, replaceAllProducts } from './repos/productsRepo.js';
import type { Product } from './types.js';

export async function loadProducts(): Promise<Product[]> {
  return listProducts();
}

export async function saveProducts(products: Product[]): Promise<void> {
  await replaceAllProducts(products);
}
