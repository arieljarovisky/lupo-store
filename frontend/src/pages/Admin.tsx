import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './admin/AdminLayout';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminCatalog } from './admin/AdminCatalog';
import { AdminOrders } from './admin/AdminOrders';
import { AdminCustomers } from './admin/AdminCustomers';
import { AdminTiendaNube } from './admin/AdminTiendaNube';

export function Admin() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="catalogo" element={<AdminCatalog />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="clientes" element={<AdminCustomers />} />
        <Route path="tiendanube" element={<AdminTiendaNube />} />
      </Route>
    </Routes>
  );
}
