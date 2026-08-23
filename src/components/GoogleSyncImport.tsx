import React, { useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';

interface GoogleSyncImportProps {
  loading: boolean;
  onSync: (url: string) => void;
}

export const GoogleSyncImport: React.FC<GoogleSyncImportProps> = ({ loading, onSync }) => {
  const [url, setUrl] = useState('');

  const handleSync = () => {
    if (!url.trim() || loading) return;
    onSync(url.trim());
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
      <div className="space-y-1.5">
        <label className="font-semibold text-slate-700 flex items-center gap-2">
          <CloudDownload className="w-4 h-4 text-blue-600" />
          <span>Sincronizar do Google Sheets</span>
          <span className="text-[10px] text-slate-500 font-normal ml-auto">Planilha deve ser pública</span>
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSync();
            }}
            placeholder="https://docs.google.com/spreadsheets/d/ID/edit#gid=0"
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSync}
            disabled={loading || !url.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            <span>{loading ? 'Buscando...' : 'Sincronizar'}</span>
          </button>
        </div>
        <div className="text-[10px] text-slate-500">
          Baixa a pasta de trabalho completa e mostra a mesma prévia por aba/empresa da importação XLSX. A planilha
          precisa estar pública (Arquivo → Compartilhar → Qualquer pessoa com o link).
        </div>
      </div>
    </div>
  );
};
