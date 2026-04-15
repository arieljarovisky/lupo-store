import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Product } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const filePath = path.join(dataDir, 'products.json');

const seed: Product[] = [
  {
    id: '1',
    name: 'Boxer Algodón Seamless',
    price: 12500,
    category: 'Hombre',
    image:
      'https://images.unsplash.com/photo-1552874869-5c39ec9288dc?q=80&w=1000&auto=format&fit=crop',
    description: 'Boxer de algodón sin costuras. Máxima comodidad para el uso diario.',
    source: 'local',
  },
  {
    id: '2',
    name: 'Top Deportivo Basic',
    price: 18900,
    category: 'Deportivo',
    image:
      'https://images.unsplash.com/photo-1608228079968-c7681eaef81e?q=80&w=1000&auto=format&fit=crop',
    description: 'Top deportivo con soporte medio, ideal para entrenamiento.',
    source: 'local',
  },
  {
    id: '3',
    name: 'Pack x3 Medias Invisibles',
    price: 8500,
    category: 'Medias',
    image:
      'https://images.unsplash.com/photo-1582966772680-860e372bb558?q=80&w=1000&auto=format&fit=crop',
    description:
      'Medias de algodón invisibles con silicona en el talón para que no se bajen.',
    source: 'local',
  },
  {
    id: '4',
    name: 'Calza Legging Seamless',
    price: 32000,
    category: 'Deportivo',
    image:
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?q=80&w=1000&auto=format&fit=crop',
    description: 'Calza deportiva sin costuras. Ajuste perfecto y libertad de movimiento.',
    source: 'local',
  },
  {
    id: '5',
    name: 'Conjunto Ropa Interior',
    price: 24500,
    category: 'Damas',
    image:
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=1000&auto=format&fit=crop',
    description: 'Conjunto de microfibra suave y confortable.',
    source: 'local',
  },
  {
    id: '6',
    name: 'Medias Deportivas Media Caña',
    price: 4500,
    category: 'Medias',
    image:
      'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?q=80&w=1000&auto=format&fit=crop',
    description: 'Medias deportivas con toalla en la planta para mayor amortiguación.',
    source: 'local',
  },
];

async function ensureFile(): Promise<void> {
  try {
    await readFile(filePath, 'utf-8');
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(seed, null, 2), 'utf-8');
  }
}

export async function loadProducts(): Promise<Product[]> {
  await ensureFile();
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Product[];
}

export async function saveProducts(products: Product[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(products, null, 2), 'utf-8');
}
