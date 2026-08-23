import React, { useEffect, useState } from 'react';
import { CloudDownload, Loader2, Save, Check, AlertCircle } from 'lucide-react';
import {
  fetchSheetConfigFromSupabase,
  saveSheetConfigToSupabase,
  SheetSyncConfig,
} from '../services/supabase';

interface GoogleSyncImportProps {
  loading: boolean;
  operatorName?: string;
  onSync: (url: string) => void;
}

export const GoogleSyncImport: React.FC<GoogleSyncImportProps> = ({ loading, operatorName, onSync }) => {
  const [url, setUrl] = useState('');
  const [savedInfo, setSavedInfo] = useState<SheetSyncConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchSheetConfigFromSupabase().then((cfg) => {
      if (active && cfg) {
        setUrl(cfg.sheetUrl);
        setSavedInfo(cfg);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSync = () => {
    if (!url.trim() || loading) return;
    onSync(url.trim());
  };

  const handleSaveDefault = async () => {
    if (!url.trim() || saving) return;
    setSaving(true);
    setSaveFeedback(null);
    const res = await saveSheetConfigToSupabase(url, operatorName);
    setSaving(false);
    if (res.ok) {
      setSavedInfo({ sheetUrl: url.trim(), updatedBy: operatorName, updatedAt: new Date().toISOString() });
      setSaveFeedback({ ok: true, message: 'Link salvo — todos já veem preenchido.' });
    } else {
      setSaveFeedback({ ok: false, message: res.message || 'Não foi possível salvar.' });
    }
    setTimeout(() => setSaveFeedback(null), 6000);
  };

  const isSameAsSaved = !!savedInfo && savedInfo.sheetUrl === url.trim();

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
          <button
            type="button"
            onClick={handleSaveDefault}
            disabled={saving || !url.trim()}
            title="Salvar este link como padrão para toda a equipe"
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shrink-0 border ${
              isSameAsSaved
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {isSameAsSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            Baixa todas as abas e mostra a mesma prévia por aba/empresa da importação XLSX.
          </span>
          {savedInfo?.updatedAt && (
            <span className="shrink-0 font-semibold text-slate-400">
              Padrão da equipe • {new Date(savedInfo.updatedAt).toLocaleString('pt-BR')}
              {savedInfo.updatedBy ? ` • ${savedInfo.updatedBy}` : ''}
            </span>
          )}
        </div>

        {saveFeedback && (
          <div
            className={`p-2 rounded-lg text-[10px] flex items-center gap-1.5 ${
              saveFeedback.ok
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {!saveFeedback.ok && <AlertCircle className="w-3 h-3 shrink-0" />}
            <span>{saveFeedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
