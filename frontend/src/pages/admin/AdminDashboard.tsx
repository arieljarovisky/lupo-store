import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, ShoppingCart, ArrowRight, TrendingUp, Banknote } from 'lucide-react';
import { useProductCatalog } from '../../context/ProductCatalogContext';
import { apiHealthUrl, fetchAdminOrders, type AdminOrder } from '../../lib/api';
import { computeSalesStats, downloadOrdersCsv } from '../../lib/adminExport';

export function AdminDashboard() {
  const { products, loading } = useProductCatalog();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiHealthUrl())
      .then((r) => r.json())
      .then((j: { ok?: boolean }) => {
        if (!cancelled) setHealthOk(Boolean(j.ok));
      })
      .catch(() => {
        if (!cancelled) setHealthOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminOrders().then((r) => {
      if (cancelled) return;
      if (r.ok === false) {
        setOrders([]);
        setOrdersErr(r.error);
        return;
      }
      setOrders(r.orders);
      setOrdersErr(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    const lowStock = products.filter((p) => {
      const q = p.stockQuantity ?? 0;
      return q > 0 && q <= 5;
    }).length;
    const outOfStock = products.filter((p) => (p.stockQuantity ?? 0) <= 0).length;
    return {
      total: products.length,
      categories: cats.size,
      lowStock,
      outOfStock,
    };
  }, [products]);

  const recentOrders = (orders ?? []).slice(0, 6);

  const sales = useMemo(() => computeSalesStats(orders ?? []), [orders]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-[28px] md:text-[34px] font-light tracking-[-0.5px] text-lupo-black mb-2">Resumen</h1>
        <p className="text-[14px] text-lupo-text">Vista general del catálogo y pedidos recientes.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-lupo-text">API:</span>
        {healthOk === null && <span className="text-[#888]">comprobando…</span>}
        {healthOk === true && (
          <span className="text-green-700 font-medium">operativo ({apiHealthUrl()})</span>
        )}
        {healthOk === false && <span className="text-red-600 font-medium">sin respuesta · revisá backend</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Productos publicados"
          value={loading ? '…' : String(stats.total)}
          hint="En catálogo actual"
        />
        <StatCard
          icon={Package}
          label="Categorías"
          value={loading ? '…' : String(stats.categories)}
          hint="Distintas"
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock bajo (1–5)"
          value={loading ? '…' : String(stats.lowStock)}
          hint="Revisar reposición"
        />
        <StatCard
          icon={AlertTriangle}
          label="Sin stock"
          value={loading ? '…' : String(stats.outOfStock)}
          hint="Unidades en 0"
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium text-lupo-black flex items-center gap-2">
              <TrendingUp size={22} strokeWidth={1.5} />
              Ventas
            </h2>
            <p className="text-[13px] text-lupo-text mt-1">Basado en pedidos del checkout (histórico cargado).</p>
          </div>
          {!ordersErr && orders && orders.length > 0 && (
            <button
              type="button"
              onClick={() => downloadOrdersCsv(orders)}
              className="text-[11px] uppercase tracking-[1.5px] border border-lupo-black bg-lupo-black text-white px-4 py-2.5 hover:bg-black/85 transition-colors"
            >
              Exportar pedidos CSV
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#e8e8e8] p-5">
            <div className="flex items-center gap-2 text-[#888] mb-1">
              <Banknote size={18} strokeWidth={1.5} />
              <span className="text-[11px] uppercase tracking-[1.2px]">Ingresos totales</span>
            </div>
            <p className="text-[26px] font-light text-lupo-black tabular-nums">
              {ordersErr
                ? '—'
                : `ARS $${sales.totalRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[12px] text-lupo-text mt-1">
              {ordersErr ? '' : `${sales.orderCount} pedido${sales.orderCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="bg-white border border-[#e8e8e8] p-5">
            <p className="text-[11px] uppercase tracking-[1.2px] text-[#888] mb-1">Ticket promedio</p>
            <p className="text-[26px] font-light text-lupo-black tabular-nums">
              {ordersErr
                ? '—'
                : `ARS $${sales.averageTicket.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[12px] text-lupo-text mt-1">Total ÷ cantidad de pedidos</p>
          </div>
          <div className="bg-white border border-[#e8e8e8] p-5">
            <p className="text-[11px] uppercase tracking-[1.2px] text-[#888] mb-1">Últimos 30 días</p>
            <p className="text-[26px] font-light text-lupo-black tabular-nums">
              {ordersErr
                ? '—'
                : `ARS $${sales.last30DaysRevenue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[12px] text-lupo-text mt-1">
              {ordersErr ? '' : `${sales.last30DaysOrders} pedido${sales.last30DaysOrders === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="bg-white border border-[#e8e8e8] p-5">
            <p className="text-[11px] uppercase tracking-[1.2px] text-[#888] mb-1">Unidades vendidas</p>
            <p className="text-[26px] font-light text-lupo-black tabular-nums">
              {ordersErr ? '—' : String(sales.unitsSold)}
            </p>
            <p className="text-[12px] text-lupo-text mt-1">Suma de cantidades por ítem</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#e8e8e8] p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-medium text-lupo-black flex items-center gap-2">
              <ShoppingCart size={20} strokeWidth={1.5} />
              Pedidos recientes
            </h2>
            <Link
              to="/admin/pedidos"
              className="text-[11px] uppercase tracking-[1.5px] text-lupo-black flex items-center gap-1 hover:opacity-70"
            >
              Ver todos
              <ArrowRight size={14} />
            </Link>
          </div>

          {ordersErr && (
            <p className="text-[13px] text-red-600 mb-4">{ordersErr}</p>
          )}

          {!ordersErr && recentOrders.length === 0 && (
            <p className="text-[14px] text-lupo-text">Todavía no hay pedidos registrados.</p>
          )}

          {recentOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#eee] text-[11px] uppercase tracking-[1px] text-[#888]">
                    <th className="pb-3 pr-4 font-medium">ID</th>
                    <th className="pb-3 pr-4 font-medium">Fecha</th>
                    <th className="pb-3 pr-4 font-medium">Contacto</th>
                    <th className="pb-3 pr-4 font-medium">Estado</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-[#f4f4f4]">
                      <td className="py-3 pr-4 font-medium">#{o.id}</td>
                      <td className="py-3 pr-4 text-lupo-text whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString('es-AR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 pr-4 text-lupo-text max-w-[180px] truncate">
                        {o.guestEmail || o.guestPhone || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-block px-2 py-0.5 bg-[#f0f0f0] text-[11px] uppercase tracking-wide">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium">
                        {o.currency} ${o.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#e8e8e8] p-6 md:p-8 space-y-4">
          <h2 className="text-[16px] font-medium text-lupo-black mb-2">Accesos rápidos</h2>
          <QuickLink to="/admin/catalogo" label="Gestionar catálogo" />
          <QuickLink to="/admin/tiendanube" label="Sincronizar Tienda Nube" />
          <QuickLink to="/admin/pedidos" label="Ver pedidos y exportar CSV" />
          <QuickLink to="/" label="Ir a la tienda" external />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white border border-[#e8e8e8] p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[#888]">
        <Icon size={18} strokeWidth={1.5} />
        <span className="text-[11px] uppercase tracking-[1.2px]">{label}</span>
      </div>
      <p className="text-[28px] font-light text-lupo-black tabular-nums">{value}</p>
      <p className="text-[12px] text-lupo-text">{hint}</p>
    </div>
  );
}

function QuickLink({ to, label, external }: { to: string; label: string; external?: boolean }) {
  const className =
    'block w-full text-left px-4 py-3 border border-[#e8e8e8] text-[12px] uppercase tracking-[1px] hover:border-lupo-black hover:bg-[#fafafa] transition-colors';
  if (external) {
    return (
      <a href={to} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {label}
    </Link>
  );
}
