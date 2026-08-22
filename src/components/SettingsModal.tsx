import React, { useState } from 'react';
import {
  X,
  Database,
  Check,
  RotateCw,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Code,
  Sliders,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_TABLE_NAME,
  getActiveSupabaseConfig,
  saveCustomSupabaseConfig,
  resetSupabaseConfig,
  reinitializeSupabaseClient,
  SPREADSHEET_DAY21_URL,
  SPREADSHEET_DAY22_URL,
  SUPABASE_SQL_CREATION_SCRIPT,
  recordDay22ToSupabase,
} from '../services/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAttendeesCount: number;
  checkedInCount: number;
  onSeedSupabase: () => Promise<void>;
  onRefresh: () => void;
  isSyncing: boolean;
  isTableMissing?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  totalAttendeesCount,
  checkedInCount,
  onSeedSupabase,
  onRefresh,
  isSyncing,
  isTableMissing = false,
}) => {
  const activeCfg = getActiveSupabaseConfig();
  const [urlInput, setUrlInput] = useState(activeCfg.url);
  const [keyInput, setKeyInput] = useState(activeCfg.key);
  const [tableInput, setTableInput] = useState(activeCfg.table);

  const [activeTab, setActiveTab] = useState<'info' | 'sql' | 'custom'>('info');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [isRecordingDay22, setIsRecordingDay22] = useState(false);
  const [reseedSuccess, setReseedSuccess] = useState(false);
  const [day22SuccessMsg, setDay22SuccessMsg] = useState<string | null>(null);
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

  const handleReseed = async () => {
    try {
      setIsReseeding(true);
      await onSeedSupabase();
      setReseedSuccess(true);
      setTimeout(() => setReseedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReseeding(false);
    }
  };

  const handleRecordDay22 = async () => {
    try {
      setIsRecordingDay22(true);
      setDay22SuccessMsg(null);
      const res = await recordDay22ToSupabase();
      if (res.success) {
        setDay22SuccessMsg(`✅ ${res.insertedCount} pessoas do Dia 22 gravadas com sucesso! (Dia 21 100% preservado)`);
        onRefresh();
      } else {
        setDay22SuccessMsg(`Nota: ${res.error}`);
      }
      setTimeout(() => setDay22SuccessMsg(null), 4000);
    } catch (err: any) {
      setDay22SuccessMsg(`Erro: ${err.message}`);
    } finally {
      setIsRecordingDay22(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[18px] bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Banco de Dados Supabase</h3>
              <p className="text-xs text-slate-500">Onde os dados são salvos & Configuração</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs for clarity */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'info' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Onde está Salvando</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'sql' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            <span>Criar Tabela (SQL)</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-pink-600" />
            <span>Outro Banco / Tabela</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'info' && (
            <div className="space-y-3.5">
              {/* Where is it saving explanation */}
              <div className="p-4 rounded-[24px] bg-indigo-50/70 border border-indigo-100 text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-black text-sm text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Onde os dados ficam guardados?</span>
                </div>
                <p className="text-xs leading-relaxed text-indigo-900/90">
                  Cada entrada e check-in é salvo no seu banco de dados <strong>PostgreSQL no Supabase</strong>, na tabela <code>public.attendees</code>.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="bg-white/80 px-2.5 py-1 rounded-xl border border-indigo-200 text-indigo-900">
                    📂 Projeto: <code>myvetgtnheigkzbbhpng</code>
                  </span>
                  <span className="bg-white/80 px-2.5 py-1 rounded-xl border border-indigo-200 text-indigo-900">
                    📑 Tabela: <code>{activeCfg.table}</code>
                  </span>
                </div>
              </div>

              {/* Status Note if table is missing */}
              {isTableMissing && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>A tabela &apos;public.attendees&apos; ainda não foi criada no Supabase</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    O app está operando normalmente com cache local resiliente, mas para sincronizar entre todos os 3 celulares, copie o script na aba <strong>&quot;Criar Tabela (SQL)&quot;</strong> e cole no SQL Editor do Supabase!
                  </p>
                  <button
                    onClick={() => setActiveTab('sql')}
                    className="mt-1 px-3 py-1.5 rounded-xl bg-amber-900 text-white font-bold text-[11px]"
                  >
                    Ver Script SQL Rápido →
                  </button>
                </div>
              )}

              {/* Status Cards */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500">Total de Credenciados</div>
                  <div className="text-base font-black text-slate-900">{totalAttendeesCount} pessoas</div>
                </div>
                <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-800">Entradas Confirmadas</div>
                  <div className="text-base font-black text-emerald-950">{checkedInCount} presentes</div>
                </div>
              </div>

              {/* Planilhas Google Sheets Origem */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Planilhas Google Sheets Oficiais</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                    DIAS 21 & 22
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <a
                    href={SPREADSHEET_DAY21_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Planilha Dia 21/08 (86 Pessoas)</span>
                  </a>
                  <a
                    href={SPREADSHEET_DAY22_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Planilha Dia 22/08 (33 Pessoas)</span>
                  </a>
                </div>
              </div>

              {/* Action: Record Day 22 to Supabase */}
              <div className="p-3.5 rounded-2xl bg-indigo-900 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-200">
                    <ShieldCheck className="w-4 h-4 text-indigo-300" />
                    <span>Gravar Lista do Dia 22 no Supabase</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 font-bold">
                    +33 Pessoas
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200 leading-relaxed">
                  Adiciona os 33 credenciados do dia 22 diretamente no Supabase com segurança total, mantendo todas as marcações de hoje (21/08).
                </p>
                <button
                  onClick={handleRecordDay22}
                  disabled={isRecordingDay22}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRecordingDay22 ? 'animate-spin' : ''}`} />
                  <span>{isRecordingDay22 ? 'Gravando Dia 22...' : 'Gravar Lista do Dia 22 (+33)'}</span>
                </button>
                {day22SuccessMsg && (
                  <div className="p-2 rounded-lg bg-indigo-950 text-indigo-200 font-bold text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{day22SuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* Reseed Base Button */}
              <div className="pt-1">
                <button
                  onClick={handleReseed}
                  disabled={isReseeding}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm disabled:opacity-50 text-xs"
                >
                  {reseedSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Base Unificada Gravada no Banco!</span>
                    </>
                  ) : (
                    <>
                      <RotateCw className={`w-4 h-4 text-pink-300 ${isReseeding ? 'animate-spin' : ''}`} />
                      <span>{isReseeding ? 'Gravando dados...' : 'Sincronizar Todas as Listas (Dia 21 + 22)'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400">schema.sql (Copiar e Executar)</span>
                  <button
                    onClick={handleCopySql}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-48 whitespace-pre leading-relaxed border border-slate-800">
                  {SUPABASE_SQL_CREATION_SCRIPT}
                </pre>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-950 text-xs space-y-1">
                <div className="font-bold">Como rodar no Supabase em 10 segundos:</div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-indigo-900/90">
                  <li>Clique no botão <strong>Copiar SQL</strong> acima.</li>
                  <li>Abra o link do painel do Supabase abaixo.</li>
                  <li>Cole no <strong>SQL Editor</strong> e clique em <strong>Run (Executar)</strong>.</li>
                </ol>
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
              <p className="text-slate-600 text-xs">
                Se você criar um novo projeto ou quiser apontar para outra tabela no Supabase, altere os parâmetros abaixo:
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  URL do Projeto Supabase
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://xyz.supabase.co"
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
                  placeholder="eyJhbG..."
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
                  placeholder="attendees"
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
