import { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function Admin() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleImport = () => {
    setIsImporting(true);
    setImportStatus('idle');
    
    // Simulate API call to Tiendanube or CSV processing
    setTimeout(() => {
      setIsImporting(false);
      setImportStatus('success');
    }, 2500);
  };

  return (
    <div className="min-h-screen pt-[120px] pb-24 px-6 md:px-[60px] max-w-4xl mx-auto">
      <h1 className="text-[40px] font-light tracking-[-1px] mb-4">Administración</h1>
      <p className="text-[16px] text-lupo-text mb-12">Gestiona tu catálogo y sincroniza tus productos.</p>

      <div className="bg-white border border-lupo-border p-8">
        <h2 className="text-[18px] font-medium mb-6 text-lupo-black flex items-center gap-2">
          <RefreshCw size={20} />
          Sincronizar con Tiendanube
        </h2>
        
        <p className="text-[14px] text-[#777] mb-8 leading-[1.6]">
          Conecta tu tienda actual para importar automáticamente todos tus productos, imágenes, precios y stock. 
          La sincronización mantendrá tu catálogo actualizado en tiempo real.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <button 
            onClick={handleImport}
            disabled={isImporting}
            className={`flex items-center justify-center gap-2 bg-lupo-black text-white px-[30px] py-[14px] uppercase text-[11px] tracking-[2px] font-semibold transition-colors ${
              isImporting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-black/80'
            }`}
          >
            {isImporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Upload size={16} />
                Importar Productos
              </>
            )}
          </button>

          {importStatus === 'success' && (
            <div className="flex items-center gap-2 text-[#2E7D32] text-[13px] font-medium">
              <CheckCircle2 size={16} />
              Catálogo sincronizado exitosamente (142 productos)
            </div>
          )}

          {importStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 text-[13px] font-medium">
              <AlertCircle size={16} />
              Error al conectar con la API. Verifica tus credenciales.
            </div>
          )}
        </div>

        <div className="mt-10 pt-8 border-t border-lupo-border">
          <h3 className="text-[14px] font-medium mb-4 text-lupo-black">Otras opciones de importación</h3>
          <div className="border-2 border-dashed border-[#EEE] p-8 text-center bg-[#F9F9F9] hover:bg-[#F0F0F0] transition-colors cursor-pointer">
            <Upload size={24} className="mx-auto mb-3 text-[#AAA]" />
            <p className="text-[13px] text-lupo-black font-medium mb-1">Subir archivo CSV</p>
            <p className="text-[11px] text-[#777]">Arrastra tu archivo aquí o haz clic para seleccionar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
