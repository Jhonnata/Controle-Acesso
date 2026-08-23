import React, { useState } from 'react';
import { CloudDownload, AlertCircle, Loader2 } from 'lucide-react';
import { Attendee } from '../types';
import { importGoogleSheet, filterValidRows, diffImportedRows, SheetRow } from '../utils/googleImport';

interface GoogleSyncImportProps {
  existingRecords: Attendee[];
  keyFields?: string[];
  selectedDay?: string;
  onImportRows: (rows: SheetRow[]) => void;
}

export const GoogleSyncImport: React.FC<GoogleSyncImportProps> = ({
  existingRecords,
  keyFields = ['cpf'],
  selectedDay = '',
  onImportRows,
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; valid: number; removed: number } | null>(null);
  const [newRows, setNewRows] = useState<SheetRow[]>([]);
  const [existingMatches, setExistingMatches] = useState<SheetRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleSync = async () => {
    setError(null);
    setStats(null);
    setNewRows([]);
    setExistingMatches([]);
    setSelected(new Set());

    if (!url.trim()) {
      setError('Cole o link do Google Sheets.');
      return;
    }

    setLoading(true);
    try {
      const { rows } = await importGoogleSheet(url);
      const total = rows.length;
      const valid = filterValidRows(rows);
      const { existingMatches: matches, newRows: fresh } = diffImportedRows(
        existingRecords as unknown as SheetRow[],
        valid,
        keyFields
      );
      setStats({ total, valid: valid.length, removed: total - valid.length });
      setNewRows(fresh);
      setExistingMatches(matches);
      setSelected(new Set(fresh.map((_, i) => i)));
      console.log(
        `[googleSync] Lidas ${total}, válidas ${valid.length}, descartadas ${total - valid.length}, já cadastradas ${matches.length}, novas ${fresh.length}`
      );
    } catch (err: any) {
      console.error('[googleSync]', err);
      setError(err.message || 'Erro ao sincronizar a planilha.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleImportSelected = () => {
    const selectedRows = newRows.filter((_, i) => selected.has(i));
    if (selectedRows.length === 0) return;
    onImportRows(selectedRows);
    setUrl('');
    setStats(null);
    setNewRows([]);
    setExistingMatches([]);
    setSelected(new Set());
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
            placeholder="https://docs.google.com/spreadsheets/d/ID/edit#gid=0"
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSync}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            <span>{loading ? 'Buscando...' : 'Sincronizar'}</span>
          </button>
        </div>
        <div className="text-[10px] text-slate-500">
          A planilha precisa estar pública (Arquivo → Compartilhar → Qualquer pessoa com o link).
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-[11px]">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {stats && (
        <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2.5 text-[11px]">
          <div className="flex items-center justify-between font-black text-slate-900">
            <span>Prévia da sincronização</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
              Lidas {stats.total} · Válidas {stats.valid} · Descartadas {stats.removed}
            </span>
          </div>

          {existingMatches.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Já cadastrados ({existingMatches.length})
              </div>
              <div className="max-h-20 overflow-y-auto space-y-1">
                {existingMatches.map((r, i) => (
                  <div key={`e${i}`} className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 flex justify-between items-center">
                    <span className="truncate max-w-[140px] font-semibold text-slate-800">{r.nome}</span>
                    <span className="truncate max-w-[110px] text-slate-500">{r.empresa}</span>
                    <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
                      Já cadastrado
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newRows.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Novos registros ({selected.size}/{newRows.length} selecionados)
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {newRows.map((r, i) => (
                  <button
                    key={`n${i}`}
                    type="button"
                    onClick={() => toggleRow(i)}
                    className={`w-full p-1.5 rounded-lg border flex items-center justify-between text-left transition-colors ${
                      selected.has(i)
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} readOnly />
                      <span className="font-semibold text-slate-900 truncate max-w-[130px]">{r.nome}</span>
                      <span className="text-slate-500 truncate max-w-[100px]">{r.empresa}</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0">{r.cpf}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selected.size === 0}
                className="w-full mt-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl text-xs transition-colors"
              >
                Importar selecionados ({selected.size}) no dia {selectedDay || '--/--'}
              </button>
            </div>
          )}

          {newRows.length === 0 && existingMatches.length > 0 && (
            <div className="text-emerald-700 font-semibold">Tudo sincronizado — nenhum registro novo.</div>
          )}
        </div>
      )}
    </div>
  );
};
