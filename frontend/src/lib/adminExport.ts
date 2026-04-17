import type { AdminOrder } from './api';

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Una fila por ítem de línea (útil para Excel / BI). */
export function ordersToCsvLineItems(orders: AdminOrder[]): string {
  const headers = [
    'pedido_id',
    'fecha',
    'email',
    'telefono',
    'estado_pedido',
    'estado_pago',
    'moneda',
    'total_pedido',
    'producto',
    'product_id',
    'cantidad',
    'precio_unitario',
    'subtotal_linea',
  ];
  const rows: string[] = [headers.join(',')];

  for (const o of orders) {
    const email = o.guestEmail ?? '';
    const phone = o.guestPhone ?? '';
    for (const it of o.items) {
      rows.push(
        [
          o.id,
          o.createdAt,
          email,
          phone,
          o.status,
          o.paymentStatus,
          o.currency,
          o.total.toFixed(2),
          it.productNameSnapshot,
          it.productId,
          it.quantity,
          it.unitPrice.toFixed(2),
          it.lineTotal.toFixed(2),
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  return '\uFEFF' + rows.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOrdersCsv(orders: AdminOrder[], filename = `pedidos-lupo-${new Date().toISOString().slice(0, 10)}.csv`): void {
  downloadTextFile(filename, ordersToCsvLineItems(orders));
}

export type SalesStats = {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  last30DaysRevenue: number;
  last30DaysOrders: number;
  /** Suma de cantidades en todas las líneas de todos los pedidos */
  unitsSold: number;
};

export function computeSalesStats(orders: AdminOrder[]): SalesStats {
  if (orders.length === 0) {
    return {
      totalRevenue: 0,
      orderCount: 0,
      averageTicket: 0,
      last30DaysRevenue: 0,
      last30DaysOrders: 0,
      unitsSold: 0,
    };
  }
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = orders.length;
  const averageTicket = totalRevenue / orderCount;
  const unitsSold = orders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  const now = Date.now();
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const recent = orders.filter((o) => now - new Date(o.createdAt).getTime() <= ms30);
  const last30DaysRevenue = recent.reduce((sum, o) => sum + o.total, 0);
  const last30DaysOrders = recent.length;

  return {
    totalRevenue,
    orderCount,
    averageTicket,
    last30DaysRevenue,
    last30DaysOrders,
    unitsSold,
  };
}
