import { useEffect, useState, type FormEvent } from 'react';
import { Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useProductCatalog } from '../context/ProductCatalogContext';
import {
  adminLogin,
  clearAdminToken,
  disconnectTiendaNube,
  getAdminToken,
  getTiendaNubeConnectionStatus,
  importFromTiendaNube,
  startTiendaNubeOAuth,
} from '../lib/api';

export function Admin() {
  const { refetch, products } = useProductCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tnStatus, setTnStatus] = useState<{
    connected: boolean;
    source: 'oauth' | 'env' | 'none';
    storeId: string | null;
    connectedAt: string | null;
    hasOauthConfig: boolean;
  } | null>(null);
  const [tnError, setTnError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(getAdminToken()));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getTiendaNubeConnectionStatus().then((s) => {
      if (s.error) {
        setTnError(s.error);
        return;
      }
      setTnError(null);
      setTnStatus({
        connected: s.connected,
        source: s.source,
        storeId: s.storeId,
        connectedAt: s.connectedAt,
        hasOauthConfig: s.hasOauthConfig,
      });
    });
  }, [isAuthenticated]);

  useEffect(() => {
    const oauthResult = searchParams.get('tn_oauth');
    if (!oauthResult) return;
    const oauthMsg = searchParams.get('message');
    const oauthStore = searchParams.get('store');
    if (oauthResult === 'ok') {
      setImportStatus('success');
      setLastMessage(
        oauthStore
          ? `Tienda conectada correctamente (store ${oauthStore}). Ya podés importar productos.`
          : 'Tienda conectada correctamente. Ya podés importar productos.'
      );
      getTiendaNubeConnectionStatus().then((s) => {
        if (!s.error) {
          setTnStatus({
            connected: s.connected,
            source: s.source,
            storeId: s.storeId,
            connectedAt: s.connectedAt,
            hasOauthConfig: s.hasOauthConfig,
          });
          setTnError(null);
        }
      });
    } else {
      setImportStatus('error');
      setLastMessage(oauthMsg || 'No se pudo completar la conexión OAuth con Tienda Nube.');
    }
    setSearchParams({});
  }, [searchParams, setSearchParams]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    const res = await adminLogin(email, password);
    setIsAuthLoading(false);
    if (!res.ok) {
      setAuthError(res.error ?? 'No se pudo iniciar sesión.');
      return;
    }
    setIsAuthenticated(true);
    setPassword('');
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setPassword('');
    setImportStatus('idle');
    setLastMessage(null);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportStatus('idle');
    setLastMessage(null);

    const result = await importFromTiendaNube();
    setIsImporting(false);

    if (result.ok) {
      setImportStatus('success');
      setLastMessage(result.message ?? `Se importaron ${result.imported} productos.`);
      refetch();
    } else {
      setImportStatus('error');
      setLastMessage(result.error ?? 'Error desconocido');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setImportStatus('idle');
    setLastMessage(null);
    const r = await startTiendaNubeOAuth();
    setIsConnecting(false);
    if (!r.ok || !r.url) {
      setImportStatus('error');
      setLastMessage(r.error ?? 'No se pudo iniciar OAuth con Tienda Nube.');
      return;
    }
    window.location.href = r.url;
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    const r = await disconnectTiendaNube();
    setIsDisconnecting(false);
    if (!r.ok) {
      setImportStatus('error');
      setLastMessage(r.error ?? 'No se pudo desconectar la tienda.');
      return;
    }
    setTnStatus((prev) =>
      prev
        ? { ...prev, connected: false, source: 'none', storeId: null, connectedAt: null }
        : { connected: false, source: 'none', storeId: null, connectedAt: null, hasOauthConfig: false }
    );
    setImportStatus('success');
    setLastMessage('Conexión OAuth eliminada. Podés volver a conectar otra tienda.');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-xl mx-auto">
        <h1 className="text-[40px] font-light tracking-[-1px] mb-4">Iniciar sesión</h1>
        <p className="text-[16px] text-lupo-text mb-10">
          Ingresá con tu cuenta de administrador para importar productos desde Tienda Nube.
        </p>

        <form onSubmit={handleLogin} className="bg-white border border-lupo-border p-8 space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-[12px] uppercase tracking-[1.5px] mb-2 font-medium">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-lupo-border px-4 py-3 text-[14px] outline-none focus:border-lupo-black"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-[12px] uppercase tracking-[1.5px] mb-2 font-medium"
            >
              Contraseña
            </label>
            <input
              id="admin-password"
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
            disabled={isAuthLoading}
            className={`w-full bg-lupo-black text-white px-[30px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
              isAuthLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-black/80'
            }`}
          >
            {isAuthLoading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>

          {authError && <p className="text-[13px] text-red-600 whitespace-pre-wrap">{authError}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-12">
        <div>
          <h1 className="text-[40px] font-light tracking-[-1px] mb-4">Administración</h1>
          <p className="text-[16px] text-lupo-text">Gestiona tu catálogo y sincroniza tus productos.</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-[1.8px] border border-lupo-border px-4 py-2 hover:bg-black hover:text-white transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="bg-white border border-lupo-border p-8">
        <h2 className="text-[18px] font-medium mb-6 text-lupo-black flex items-center gap-2">
          <RefreshCw size={20} />
          Sincronizar con Tienda Nube
        </h2>

        <p className="text-[14px] text-[#777] mb-8 leading-[1.6]">
          Conectá tu tienda con OAuth y luego importá todos los productos publicados desde la API de Tienda Nube
          (Nuvemshop). El catálogo actual en el sitio tiene{' '}
          <strong>{products.length}</strong> producto{products.length === 1 ? '' : 's'}.
        </p>

        <div className="mb-8 p-4 border border-lupo-border bg-[#FAFAFA]">
          <p className="text-[12px] uppercase tracking-[1.5px] mb-2 font-medium">Estado de conexión</p>
          <p className="text-[14px] text-lupo-text">
            {tnStatus?.connected
              ? `Conectado (${tnStatus.source === 'oauth' ? 'OAuth' : 'variables del servidor'})`
              : 'Sin conexión con Tienda Nube'}
            {tnStatus?.storeId ? ` - tienda ${tnStatus.storeId}` : ''}
          </p>
          {tnError && <p className="text-[12px] text-red-600 mt-2 whitespace-pre-wrap">{tnError}</p>}
          {!tnStatus?.hasOauthConfig && (
            <p className="text-[12px] text-[#9A6A00] mt-2">
              Falta configurar OAuth en backend (TIENDANUBE_CLIENT_ID, TIENDANUBE_CLIENT_SECRET,
              TIENDANUBE_REDIRECT_URI).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={handleConnect}
            disabled={isConnecting || tnStatus?.hasOauthConfig === false}
            className={`bg-lupo-black text-white px-[22px] py-[12px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
              isConnecting || tnStatus?.hasOauthConfig === false
                ? 'opacity-70 cursor-not-allowed'
                : 'hover:bg-black/80'
            }`}
          >
            {isConnecting ? 'Conectando…' : tnStatus?.connected ? 'Reconectar tienda' : 'Conectar Tienda Nube'}
          </button>
          {tnStatus?.source === 'oauth' && (
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className={`border border-lupo-border px-[22px] py-[12px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
                isDisconnecting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-black hover:text-white'
              }`}
            >
              {isDisconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <button
            onClick={handleImport}
            disabled={isImporting || !tnStatus?.connected}
            className={`flex items-center justify-center gap-2 bg-lupo-black text-white px-[30px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
              isImporting || !tnStatus?.connected ? 'opacity-70 cursor-not-allowed' : 'hover:bg-black/80'
            }`}
          >
            {isImporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Importando…
              </>
            ) : (
              <>
                <Upload size={16} />
                Importar productos
              </>
            )}
          </button>

          {importStatus === 'success' && (
            <div className="flex items-center gap-2 text-[#2E7D32] text-[13px] font-medium">
              <CheckCircle2 size={16} />
              {lastMessage}
            </div>
          )}

          {importStatus === 'error' && (
            <div className="flex flex-col gap-1 text-red-600 text-[13px] font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                Error al importar
              </div>
              {lastMessage && <p className="text-[12px] font-normal pl-6 opacity-90">{lastMessage}</p>}
            </div>
          )}
        </div>

        <div className="mt-10 pt-8 border-t border-lupo-border">
          <h3 className="text-[14px] font-medium mb-4 text-lupo-black">Otras opciones de importación</h3>
          <div className="border-2 border-dashed border-[#EEE] p-8 text-center bg-[#F9F9F9]">
            <Upload size={24} className="mx-auto mb-3 text-[#AAA]" />
            <p className="text-[13px] text-lupo-black font-medium mb-1">Subir archivo CSV</p>
            <p className="text-[11px] text-[#777]">Próximamente: importación por CSV desde el panel.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
