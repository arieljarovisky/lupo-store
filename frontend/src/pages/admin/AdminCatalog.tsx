import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { useProductCatalog } from '../../context/ProductCatalogContext';
import type { Product } from '../../context/CartContext';
import { articleCodeFromProduct, parseLupoSku13 } from '../../lib/lupoSku';
import { adminPatchProductPrice } from '../../lib/api';

function AdminPriceEditor({
  productId,
  variantId,
  initialPrice,
  onSaved,
  applyToAllVariants,
}: {
  productId: string;
  variantId: string | null;
  initialPrice: number;
  onSaved: () => void;
  /** Si es true, actualiza el precio del producto y de todas las variantes a la vez. */
  applyToAllVariants?: boolean;
}) {
  const [value, setValue] = useState(String(initialPrice));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(initialPrice));
  }, [initialPrice, productId, variantId]);

  const save = async () => {
    const n = Number(String(value).replace(',', '.').trim());
    if (!Number.isFinite(n) || n < 0) {
      setErr('Precio inválido');
      return;
    }
    setErr(null);
    setSaving(true);
    const r = await adminPatchProductPrice({
      productId,
      price: Math.round(n),
      variantId: variantId ?? undefined,
      applyToAllVariants: applyToAllVariants ? true : undefined,
    });
    setSaving(false);
    if ('error' in r) {
      setErr(r.error);
      return;
    }
    onSaved();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {applyToAllVariants && (
        <span className="text-[10px] text-[#888] max-w-[220px] text-right leading-tight">
          Todas las variantes
        </span>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-[11px] text-[#888]">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-[88px] border border-[#ddd] px-2 py-1 text-right text-[13px] tabular-nums"
          aria-label="Precio"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-[10px] uppercase tracking-wide bg-lupo-black text-white px-2.5 py-1.5 hover:bg-black/85 disabled:opacity-50"
        >
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
      {err && (
        <span className="text-[10px] text-red-600 max-w-[220px] text-right leading-tight">{err}</span>
      )}
    </div>
  );
}

/** Precio mostrado en la fila principal si hay variantes: común a todas o el del producto. */
function displayPriceForVariantsProduct(p: Product): number {
  const v = p.variants;
  if (!v?.length) return p.price;
  const first = v[0].price;
  if (v.every((x) => x.price === first)) return first;
  return p.price;
}

function stockClass(qty: number): string {
  if (qty <= 0) return 'text-red-600 font-medium';
  if (qty <= 5) return 'text-amber-700 font-medium';
  return '';
}

/** Stock mostrado en la fila producto: suma de variantes o stock del producto. */
function totalStockForProduct(p: Product): number {
  if (p.variants?.length) {
    return p.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stockQuantity) || 0), 0);
  }
  return Math.max(0, Number(p.stockQuantity) || 0);
}

export function AdminCatalog() {
  const { products, loading, error, refetch } = useProductCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const setQuery = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const t = value.trim();
        if (t) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true }
    );
  };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => {
      const matchProduct =
        p.name.toLowerCase().includes(s) ||
        (p.sku && p.sku.toLowerCase().includes(s)) ||
        p.category.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s);
      const matchVariant = p.variants?.some(
        (v) =>
          v.id.toLowerCase().includes(s) ||
          (v.sku && v.sku.toLowerCase().includes(s)) ||
          v.name.toLowerCase().includes(s)
      );
      return matchProduct || matchVariant;
    });
  }, [products, q]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const variantRows = (p: Product, isOpen: boolean, onPriceSaved: () => void) => {
    const list = p.variants;
    if (!list?.length) return null;
    return (
      <tr className="bg-[#f8f8f8] border-b border-[#ececec]">
        <td colSpan={8} className="p-0 border-b border-[#ececec]">
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-in-out motion-reduce:transition-none ${
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={`px-4 py-3 pl-12 border-t border-[#eee] transition-opacity duration-500 ease-in-out motion-reduce:transition-none ${
                  isOpen ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <p className="text-[10px] uppercase tracking-wider text-[#888] mb-2">
                  Variantes ({list.length})
                </p>
                <div className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
                  <table className="w-full text-left text-[12px] min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#eee] bg-[#fafafa] text-[10px] uppercase tracking-wide text-[#666]">
                        <th className="py-2 px-3 font-medium">ID TN</th>
                        <th className="py-2 px-3 font-medium">SKU</th>
                        <th className="py-2 px-3 font-medium">Descripción</th>
                        <th className="py-2 px-3 font-medium text-right">Precio</th>
                        <th className="py-2 px-3 font-medium text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((v) => {
                        const parts = parseLupoSku13(v.sku);
                        return (
                          <tr key={v.id} className="border-b border-[#f4f4f4] last:border-0 hover:bg-[#fafafa]">
                            <td className="py-2 px-3 font-mono text-[11px] text-[#555] whitespace-nowrap">{v.id}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">{v.sku ?? '—'}</td>
                            <td className="py-2 px-3">
                              <span className="text-lupo-black">{v.name}</span>
                              {parts && (
                                <span className="block text-[10px] text-[#999] mt-0.5 font-mono">
                                  Art. {parts.article} · Talle {parts.size} · Color {parts.color}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <AdminPriceEditor
                                productId={p.id}
                                variantId={v.id}
                                initialPrice={v.price}
                                onSaved={onPriceSaved}
                              />
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              <span className={stockClass(v.stockQuantity ?? 0)}>{v.stockQuantity ?? 0}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, SKU, categoría o ID…"
          className="w-full border border-[#ddd] pl-10 pr-4 py-3 text-[14px] outline-none focus:border-lupo-black bg-white"
        />
      </div>

      {loading && <p className="text-[14px] text-lupo-text">Cargando…</p>}
      {error && <p className="text-[14px] text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border border-[#e8e8e8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[780px]">
              <thead>
                <tr className="border-b border-[#eee] bg-[#fafafa] text-[11px] uppercase tracking-[1px] text-[#666]">
                  <th className="py-3 px-2 font-medium w-[40px]" aria-label="Expandir variantes" />
                  <th className="py-3 px-4 font-medium w-[72px]">Img</th>
                  <th className="py-3 px-4 font-medium">Producto</th>
                  <th className="py-3 px-4 font-medium">Artículo</th>
                  <th className="py-3 px-4 font-medium">Categoría</th>
                  <th className="py-3 px-4 font-medium text-right">Precio</th>
                  <th className="py-3 px-4 font-medium text-right">Stock</th>
                  <th className="py-3 px-4 font-medium w-[100px]"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const hasVariants = Boolean(p.variants && p.variants.length > 0);
                  const isOpen = expanded[p.id];
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-b border-[#f4f4f4] hover:bg-[#fafafa]">
                        <td className="py-3 px-2 align-middle w-[40px]">
                          {hasVariants ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="p-1 rounded hover:bg-[#eee] text-[#666] focus:outline-none focus:ring-1 focus:ring-lupo-black"
                              aria-expanded={isOpen}
                              title={isOpen ? 'Ocultar variantes' : 'Ver variantes'}
                            >
                              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                          ) : (
                            <span className="inline-block w-[26px]" />
                          )}
                        </td>
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
                          {hasVariants && (
                            <p className="text-[10px] text-[#888] mt-0.5">{p.variants!.length} variantes</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-lupo-text">
                          {hasVariants ? (
                            <span className="block font-mono text-[13px] text-lupo-black">
                              {articleCodeFromProduct(p) ?? p.sku ?? '—'}
                            </span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-lupo-text">{p.category}</td>
                        <td className="py-3 px-4 text-right align-top">
                          {hasVariants ? (
                            <AdminPriceEditor
                              productId={p.id}
                              variantId={null}
                              initialPrice={displayPriceForVariantsProduct(p)}
                              onSaved={refetch}
                              applyToAllVariants
                            />
                          ) : (
                            <AdminPriceEditor
                              productId={p.id}
                              variantId={null}
                              initialPrice={p.price}
                              onSaved={refetch}
                            />
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <span className={stockClass(totalStockForProduct(p))}>{totalStockForProduct(p)}</span>
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
                      {hasVariants ? variantRows(p, isOpen, refetch) : null}
                    </Fragment>
                  );
                })}
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
