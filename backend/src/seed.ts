import type { Product } from './types.js';

export const seedProducts: Product[] = [
  {
    id: '1',
    name: 'Boxer Algodón Seamless',
    price: 12500,
    stockQuantity: 50,
    category: 'Hombre',
    image:
      'https://images.unsplash.com/photo-1552874869-5c39ec9288dc?q=80&w=1000&auto=format&fit=crop',
    description: 'Boxer de algodón sin costuras. Máxima comodidad para el uso diario.',
    source: 'local',
    syncSource: 'manual',
  },
  {
    id: '2',
    name: 'Top Deportivo Basic',
    price: 18900,
    stockQuantity: 40,
    category: 'Deportivo',
    image:
      'https://images.unsplash.com/photo-1608228079968-c7681eaef81e?q=80&w=1000&auto=format&fit=crop',
    description: 'Top deportivo con soporte medio, ideal para entrenamiento.',
    source: 'local',
    syncSource: 'manual',
  },
  {
    id: '3',
    name: 'Pack x3 Medias Invisibles',
    price: 8500,
    stockQuantity: 80,
    category: 'Medias',
    image:
      'https://images.unsplash.com/photo-1582966772680-860e372bb558?q=80&w=1000&auto=format&fit=crop',
    description:
      'Medias de algodón invisibles con silicona en el talón para que no se bajen.',
    source: 'local',
    syncSource: 'manual',
  },
  {
    id: '4',
    name: 'Calza Legging Seamless',
    price: 32000,
    stockQuantity: 25,
    category: 'Deportivo',
    image:
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?q=80&w=1000&auto=format&fit=crop',
    description: 'Calza deportiva sin costuras. Ajuste perfecto y libertad de movimiento.',
    source: 'local',
    syncSource: 'manual',
  },
  {
    id: '5',
    name: 'Conjunto Ropa Interior',
    price: 24500,
    stockQuantity: 30,
    category: 'Damas',
    image:
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=1000&auto=format&fit=crop',
    description: 'Conjunto de microfibra suave y confortable.',
    source: 'local',
    syncSource: 'manual',
  },
  {
    id: '6',
    name: 'Medias Deportivas Media Caña',
    price: 4500,
    stockQuantity: 100,
    category: 'Medias',
    image:
      'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?q=80&w=1000&auto=format&fit=crop',
    description: 'Medias deportivas con toalla en la planta para mayor amortiguación.',
    source: 'local',
    syncSource: 'manual',
  },
];
