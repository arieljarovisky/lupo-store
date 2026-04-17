import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink } from 'lucide-react';
import { useProductCatalog } from '../../context/ProductCatalogContext';
import { parseLupoSku13 } from '../../lib/lupoSku';

export function AdminCatalog() {
  const { products, loading, error } = useProductCatalog();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.sku && p.sku.toLowerCase().includes(s)) ||
        p.category.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s)
    );
  }, [products, q]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] md:text-[34px] font-light tracking-[-0.5px] text-lupo-black mb-2">Catálogo</h1>
        <p className="text-[14px] text-lupo-text">
          Productos visibles en la tienda ({products.length} en total).
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" size={18} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, SKU, categoría o ID…"
          className="w-full border border-[#ddd] pl-10 pr-4 py-3 text-[14px] outline-none focus:border-lupo-black bg-white"
        />
      </div>

      {loading && <p className="text-[14px] text-lupo-text">Cargando…</p>}
      {error && <p className="text-[14px] text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border border-[#e8e8e8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[720px]">
              <thead>
                <tr className="border-b border-[#eee] bg-[#fafafa] text-[11px] uppercase tracking-[1px] text-[#666]">
                  <th className="py-3 px-4 font-medium w-[72px]">Img</th>
                  <th className="py-3 px-4 font-medium">Producto</th>
                  <th className="py-3 px-4 font-medium">SKU</th>
                  <th className="py-3 px-4 font-medium">Categoría</th>
                  <th className="py-3 px-4 font-medium text-right">Precio</th>
                  <th className="py-3 px-4 font-medium text-right">Stock</th>
                  <th className="py-3 px-4 font-medium w-[100px]"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#f4f4f4] hover:bg-[#fafafa]">
                    <td className="py-2 px-4">
                      <img
                        src={p.image || 'https://placehold.co/56x56/f0f0f0/999?text=·'}
                        alt=""
                        className="w-14 h-14 object-cover border border-[#eee]"
                      />
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <p className="font-medium text-lupo-black line-clamp-2">{p.name}</p>
                      <p className="text-[11px] text-[#999] font-mono truncate mt-0.5">{p.id}</p>
                    </td>
                    <td className="py-3 px-4 text-lupo-text">
                      <span className="block">{p.sku ?? '—'}</span>
                      {(() => {
                        const parts = parseLupoSku13(p.sku);
                        if (!parts) return null;
                        return (
                          <span className="block text-[10px] text-[#999] mt-0.5 font-mono">
                            Art. {parts.article} · Talle {parts.size} · Color {parts.color}
                          </span>
                        );
                      })()}
                      {p.variants && p.variants.length > 1 && (
                        <span className="block text-[10px] text-[#666] mt-0.5">
                          {p.variants.length} variantes en catálogo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-lupo-text">{p.category}</td>
                    <td className="py-3 px-4 text-right tabular-nums">${p.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span
                        className={
                          (p.stockQuantity ?? 0) <= 0
                            ? 'text-red-600 font-medium'
                            : (p.stockQuantity ?? 0) <= 5
                              ? 'text-amber-700 font-medium'
                              : ''
                        }
                      >
                        {p.stockQuantity ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/producto/${encodeURIComponent(p.id)}`}
                        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-lupo-black hover:underline"
                      >
                        Ver
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="p-8 text-center text-[14px] text-lupo-text">No hay resultados para tu búsqueda.</p>
          )}
        </div>
      )}
    </div>
  );
}
