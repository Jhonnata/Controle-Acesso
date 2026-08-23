import React, { useState } from 'react';
import {
  X,
  Database,
  Check,
  Copy,
  ExternalLink,
  Code,
  Sliders,
} from 'lucide-react';
import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_TABLE_NAME,
  getActiveSupabaseConfig,
  saveCustomSupabaseConfig,
  resetSupabaseConfig,
  reinitializeSupabaseClient,
  SUPABASE_SQL_CREATION_SCRIPT,
} from '../services/supabase';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isTableMissing?: boolean;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  isTableMissing = false,
}) => {
  const activeCfg = getActiveSupabaseConfig();
  const [urlInput, setUrlInput] = useState(activeCfg.url);
  const [keyInput, setKeyInput] = useState(activeCfg.key);
  const [tableInput, setTableInput] = useState(activeCfg.table);
  const [activeTab, setActiveTab] = useState<'info' | 'sql' | 'custom'>('info');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_CREATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeCfg.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSaveConfig = () => {
    saveCustomSupabaseConfig(urlInput, keyInput, tableInput);
    reinitializeSupabaseClient();
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
    onRefresh();
  };

  const handleResetConfig = () => {
    resetSupabaseConfig();
    setUrlInput(DEFAULT_SUPABASE_URL);
    setKeyInput(DEFAULT_SUPABASE_ANON_KEY);
    setTableInput(DEFAULT_TABLE_NAME);
    reinitializeSupabaseClient();
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[18px] bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Configurações</h3>
              <p className="text-xs text-slate-500">Supabase, SQL e outro banco/tabela</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'info' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Supabase</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'sql' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            <span>Criar Tabela</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-pink-600" />
            <span>Outro Banco</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'info' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-950 space-y-2">
                <div className="font-black text-sm">Banco atual em uso</div>
                <div className="text-xs">URL: <code>{activeCfg.url}</code></div>
                <div className="text-xs">Tabela: <code>{activeCfg.table}</code></div>
                <button
                  onClick={handleCopyUrl}
                  className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-900 font-bold text-[11px] inline-flex items-center gap-1.5"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'URL copiada' : 'Copiar URL'}</span>
                </button>
              </div>

              {isTableMissing && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                  A tabela `public.attendees` ainda não foi criada. Use a aba `Criar Tabela`.
                </div>
              )}
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400">schema.sql</span>
                  <button
                    onClick={handleCopySql}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-56 whitespace-pre leading-relaxed border border-slate-800">
                  {SUPABASE_SQL_CREATION_SCRIPT}
                </pre>
              </div>

              <a
                href={`${activeCfg.url.replace('.supabase.co', '')}/project/_/editor`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Supabase SQL Editor</span>
              </a>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  URL do Projeto Supabase
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Chave Pública Anon Key
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome da Tabela
                </label>
                <input
                  type="text"
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
                >
                  {configSaved ? 'Configuração Salva!' : 'Salvar Configuração'}
                </button>
                <button
                  onClick={handleResetConfig}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
                >
                  Restaurar Padrão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
