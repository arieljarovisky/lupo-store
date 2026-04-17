import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchAdminOrders, type AdminOrder } from '../../lib/api';
import { downloadOrdersCsv } from '../../lib/adminExport';

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminOrders().then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok === false) {
        setOrders([]);
        setError(r.error);
        return;
      }
      setOrders(r.orders);
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[34px] font-light tracking-[-0.5px] text-lupo-black mb-2">Pedidos</h1>
          <p className="text-[14px] text-lupo-text">Pedidos del checkout (más recientes primero).</p>
        </div>
        {!loading && !error && orders.length > 0 && (
          <button
            type="button"
            onClick={() => downloadOrdersCsv(orders)}
            className="inline-flex items-center gap-2 border border-lupo-black bg-white text-lupo-black px-4 py-2.5 text-[11px] uppercase tracking-[1.5px] font-semibold hover:bg-lupo-black hover:text-white transition-colors"
          >
            <Download size={16} strokeWidth={1.5} />
            Exportar CSV
          </button>
        )}
      </div>

      {loading && <p className="text-[14px] text-lupo-text">Cargando…</p>}
      {error && <p className="text-[14px] text-red-600">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <div className="bg-white border border-[#e8e8e8] p-12 text-center text-[14px] text-lupo-text">
          No hay pedidos todavía.
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="space-y-6">
          {orders.map((o) => (
            <article key={o.id} className="bg-white border border-[#e8e8e8] overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 border-b border-[#f0f0f0] bg-[#fafafa]">
                <div>
                  <p className="text-[11px] uppercase tracking-[1.5px] text-[#888]">Pedido</p>
                  <p className="text-[18px] font-medium text-lupo-black">#{o.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-lupo-text">
                    {new Date(o.createdAt).toLocaleString('es-AR', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-[20px] font-medium mt-1">
                    {o.currency} ${o.total.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-4 text-[13px]">
                <span>
                  <span className="text-[#888]">Estado: </span>
                  <span className="font-medium">{o.status}</span>
                </span>
                <span>
                  <span className="text-[#888]">Pago: </span>
                  <span className="font-medium">{o.paymentStatus}</span>
                </span>
                <span>
                  <span className="text-[#888]">Contacto: </span>
                  {o.guestEmail || o.guestPhone || '—'}
                </span>
              </div>
              <div className="px-5 pb-5 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[1px] text-[#888] border-b border-[#eee]">
                      <th className="text-left py-2 font-medium">Producto</th>
                      <th className="text-right py-2 font-medium w-24">Cant.</th>
                      <th className="text-right py-2 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((it) => (
                      <tr key={it.id} className="border-b border-[#f8f8f8]">
                        <td className="py-2 pr-4">{it.productNameSnapshot}</td>
                        <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                        <td className="py-2 text-right tabular-nums">${it.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
