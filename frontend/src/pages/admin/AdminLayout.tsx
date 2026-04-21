import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  RefreshCw,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import {
  adminLogin,
  clearAdminToken,
  getAdminToken,
} from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';

const nav = [
  { to: '/admin', label: 'Resumen', end: true, icon: LayoutDashboard },
  { to: '/admin/catalogo', label: 'Catálogo', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/tiendanube', label: 'Tienda Nube', icon: RefreshCw },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getAdminToken()));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const res = await adminLogin(email, password);
    setAuthLoading(false);
    if (!res.ok) {
      setAuthError(res.error ?? 'No se pudo iniciar sesión.');
      return;
    }
    setAuthed(true);
    setPassword('');
  };

  const handleLogout = () => {
    clearAdminToken();
    setAuthed(false);
    navigate('/admin', { replace: true });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <p className="text-[11px] uppercase tracking-[2px] text-[#888] mb-2">Lupo · administración</p>
          <BrandLogo to="" />
          <h1 className="text-[32px] font-light tracking-[-0.5px] text-lupo-black mb-2">Panel administrador</h1>
          <p className="text-[14px] text-lupo-text mb-8">Ingresá para gestionar catálogo, pedidos y sincronización.</p>

          <form onSubmit={handleLogin} className="bg-white border border-[#e8e8e8] p-8 shadow-sm space-y-5">
            <div>
              <label htmlFor="adm-email" className="block text-[11px] uppercase tracking-[1.5px] mb-2 font-medium">
                Email
              </label>
              <input
                id="adm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-lupo-border px-4 py-3 text-[14px] outline-none focus:border-lupo-black"
              />
            </div>
            <div>
              <label htmlFor="adm-pass" className="block text-[11px] uppercase tracking-[1.5px] mb-2 font-medium">
                Contraseña
              </label>
              <input
                id="adm-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-lupo-border px-4 py-3 text-[14px] outline-none focus:border-lupo-black"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className={`w-full bg-lupo-black text-white py-[14px] uppercase text-[11px] tracking-[2px] font-semibold ${
                authLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-black/80'
              }`}
            >
              {authLoading ? 'Ingresando…' : 'Entrar al panel'}
            </button>
            {authError && <p className="text-[13px] text-red-600 whitespace-pre-wrap">{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 z-20 h-screen w-[260px] bg-lupo-black text-white">
        <div className="p-6 border-b border-white/10 shrink-0">
          <BrandLogo to="" className="[&_*]:text-white [&_span:last-child]:!text-white/60" />
          <p className="text-[18px] font-medium tracking-wide mt-2">Administración</p>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
          {nav.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-[12px] uppercase tracking-[1px] transition-colors rounded-sm ${
                  isActive ? 'bg-white text-lupo-black' : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-3 text-[12px] uppercase tracking-[1px] text-white/80 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-col min-w-0 min-h-screen lg:ml-[260px]">
        <header className="lg:hidden flex items-center justify-between bg-lupo-black text-white px-4 py-3">
          <span className="text-[13px] font-medium uppercase tracking-[1px]">Admin</span>
          <button
            type="button"
            onClick={() => setMobileNav((v) => !v)}
            className="p-2"
            aria-label="Menú"
          >
            {mobileNav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>
        {mobileNav && (
          <div className="lg:hidden bg-lupo-black text-white px-4 pb-4 space-y-1 border-t border-white/10">
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileNav(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-[12px] uppercase tracking-[1px] ${isActive ? 'bg-white text-lupo-black' : 'text-white/90'}`
                }
              >
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                handleLogout();
                setMobileNav(false);
              }}
              className="block w-full text-left px-3 py-2 text-[12px] uppercase text-white/70"
            >
              Cerrar sesión
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
