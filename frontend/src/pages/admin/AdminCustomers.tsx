import { useEffect, useState } from 'react';
import { fetchAdminCustomers, type AdminCustomerRow } from '../../lib/api';

export function AdminCustomers() {
  const [rows, setRows] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminCustomers().then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok === false) {
        setRows([]);
        setError(r.error);
        return;
      }
      setRows(r.customers);
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] md:text-[34px] font-light tracking-[-0.5px] text-lupo-black mb-2">Clientes</h1>
        <p className="text-[14px] text-lupo-text">
          Cuentas registradas (últimos 500). Los pedidos como invitado no crean cliente salvo que inicien sesión.
        </p>
      </div>

      {loading && <p className="text-[14px] text-lupo-text">Cargando…</p>}
      {error && <p className="text-[14px] text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border border-[#e8e8e8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[600px]">
              <thead>
                <tr className="border-b border-[#eee] bg-[#fafafa] text-[11px] uppercase tracking-[1px] text-[#666]">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Teléfono</th>
                  <th className="py-3 px-4 font-medium">Nombre</th>
                  <th className="py-3 px-4 font-medium">Alta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-[#f4f4f4] hover:bg-[#fafafa]">
                    <td className="py-3 px-4 font-mono text-[12px]">{c.id}</td>
                    <td className="py-3 px-4">{c.email ?? '—'}</td>
                    <td className="py-3 px-4">{c.phone ?? '—'}</td>
                    <td className="py-3 px-4">{c.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-lupo-text whitespace-nowrap">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="p-8 text-center text-[14px] text-lupo-text">No hay clientes registrados.</p>
          )}
        </div>
      )}
    </div>
  );
}
