import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  Printer,
  FileText,
  Database,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Building,
  TrendingUp,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { Attendee } from '../types';
import { generateCSVReport, generateExhibitorSummaryCSV } from '../services/storage';
import {
  syncAllAttendeesToSupabase,
  recordDay22ToSupabase,
  getActiveSupabaseConfig,
} from '../services/supabase';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: Attendee[];
  onRefreshData?: () => void;
}

interface ExhibitorReportStat {
  name: string;
  total: number;
  checkedIn: number;
  attendees: Attendee[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  attendees,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'downloads' | 'preview' | 'summary'>('downloads');
  const [selectedDay, setSelectedDay] = useState<'all' | '21/08' | '22/08'>('all');
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isRecordingDay22, setIsRecordingDay22] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter attendees by selected export day if specified
  const filteredList =
    selectedDay === 'all'
      ? attendees
      : attendees.filter((a) => a.date === selectedDay);

  const total = filteredList.length;
  const checkedIn = filteredList.filter((a) => a.isCheckedIn).length;
  const pending = Math.max(0, total - checkedIn);
  const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  const cfg = getActiveSupabaseConfig();

  const day21Count = attendees.filter((a) => a.date === '21/08').length;
  const day22Count = attendees.filter((a) => a.date === '22/08').length;

  // Group by exhibitor for reports
  const exhibitorMap: Record<string, ExhibitorReportStat> = {};
  filteredList.forEach((a) => {
    const exp = a.exhibitor || 'Outros';
    if (!exhibitorMap[exp]) {
      exhibitorMap[exp] = { name: exp, total: 0, checkedIn: 0, attendees: [] };
    }
    exhibitorMap[exp].total += 1;
    if (a.isCheckedIn) exhibitorMap[exp].checkedIn += 1;
    exhibitorMap[exp].attendees.push(a);
  });

  const exhibitorStats: ExhibitorReportStat[] = Object.values(exhibitorMap).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );

  const handleDownloadFullCSV = () => {
    const csvContent = generateCSVReport(filteredList);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    const dayLabel = selectedDay === 'all' ? 'geral' : selectedDay.replace('/', '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_checkin_${dayLabel}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummaryCSV = () => {
    const csvContent = generateExhibitorSummaryCSV(filteredList);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    const dayLabel = selectedDay === 'all' ? 'geral' : selectedDay.replace('/', '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `resumo_estandes_${dayLabel}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyStatusTable = () => {
    const header = "Expositor\tDia\tNome\tCPF\tStatus\tHorário de Entrada\tOperador";
    const lines = filteredList.map(
      (a) =>
        `${a.exhibitor}\t${a.date || '21/08'}\t${a.name}\t${a.document || ''}\t${
          a.isCheckedIn ? 'ENTROU' : 'PENDENTE'
        }\t${a.checkedInAt || '-'}\t${a.checkedBy || '-'}`
    );
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopySummaryTable = () => {
    const header = "Estande / Expositor\tTotal Credenciados\tEntraram\tPendentes\t% Presença";
    const lines = exhibitorStats.map((e) => {
      const p = e.total - e.checkedIn;
      const pct = e.total > 0 ? Math.round((e.checkedIn / e.total) * 100) : 0;
      return `${e.name}\t${e.total}\t${e.checkedIn}\t${p}\t${pct}%`;
    });
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleDownloadJSONBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      reportTitle: 'Relatório Oficial de Credenciamento e Presença na Portaria',
      filterDay: selectedDay,
      totalAttendees: total,
      checkedInCount: checkedIn,
      pendingCount: pending,
      presenceRatePercent: percent,
      supabaseTable: cfg.table,
      attendees: filteredList,
      exhibitorStats: exhibitorStats.map((e) => ({
        exhibitor: e.name,
        total: e.total,
        checkedIn: e.checkedIn,
        pending: e.total - e.checkedIn,
        rate: e.total > 0 ? `${Math.round((e.checkedIn / e.total) * 100)}%` : '0%',
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `backup_checkin_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Safe action: Records Day 22 without overwriting anything from Day 21
  const handleRecordDay22 = async () => {
    setIsRecordingDay22(true);
    setSyncSuccess(null);
    try {
      const res = await recordDay22ToSupabase(attendees);
      if (res.success) {
        setSyncSuccess(
          `✅ Lista do Dia 22 salva no Supabase! ${res.insertedCount} novos inseridos (${res.existingCount} já existiam). Dia 21 100% preservado!`
        );
        if (onRefreshData) onRefreshData();
      } else {
        setSyncSuccess(`Nota: ${res.error || 'Verifique a tabela'}`);
      }
    } catch (e: any) {
      setSyncSuccess(`Erro ao gravar Dia 22: ${e.message}`);
    } finally {
      setIsRecordingDay22(false);
      setTimeout(() => setSyncSuccess(null), 5000);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncSuccess(null);
    try {
      const res = await syncAllAttendeesToSupabase(attendees);
      if (res.success) {
        setSyncSuccess(`100% dos ${res.count} registros sincronizados no Supabase (Dia 21 e 22 preservados)!`);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncSuccess(`Nota de sincronização: ${res.error || 'Verifique a tabela'}`);
      }
    } catch (e: any) {
      setSyncSuccess(`Erro ao conectar ao Supabase: ${e.message}`);
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncSuccess(null), 4000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const nowFormatted = new Date().toLocaleString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[18px] bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Relatórios & Exportação</h3>
              <p className="text-xs text-slate-500">Dados salvos no Supabase • CSV, Impressão & Backup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'downloads' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Downloads & CSV</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'summary' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-indigo-600" />
            <span>Por Estande ({exhibitorStats.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-pink-600" />
            <span>Imprimir / Visualizar</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Day Selector Pills for Export */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setSelectedDay('all')}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition-all ${
                selectedDay === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Dias ({attendees.length})
            </button>
            <button
              onClick={() => setSelectedDay('21/08')}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                selectedDay === '21/08'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Dia 21/08 ({day21Count})</span>
            </button>
            <button
              onClick={() => setSelectedDay('22/08')}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                selectedDay === '22/08'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Dia 22/08 ({day22Count})</span>
            </button>
          </div>

          {/* Quick Record Day 22 Dedicated Card */}
          <div className="p-3.5 rounded-[22px] bg-indigo-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Gravar Lista do Dia 22 no Supabase</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-400/20 text-indigo-200">
                    +33 Pessoas
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Insere com segurança sem sobrescrever os check-ins já feitos no Dia 21.
                </div>
              </div>
            </div>

            <button
              onClick={handleRecordDay22}
              disabled={isRecordingDay22}
              className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-[11px] flex items-center gap-1.5 active:scale-95 transition-all self-stretch sm:self-auto justify-center shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRecordingDay22 ? 'animate-spin' : ''}`} />
              <span>{isRecordingDay22 ? 'Gravando...' : 'Gravar Dia 22 no Supabase'}</span>
            </button>
          </div>

          {/* Supabase Save Status Banner */}
          <div className="p-3.5 rounded-[22px] bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Persistência no Supabase</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[11px] text-slate-400">
                  Tabela <code>{cfg.table}</code> • Cada marcação gera histórico de check-in
                </div>
              </div>
            </div>

            <button
              onClick={handleSyncSupabase}
              disabled={isSyncingSupabase}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center gap-1.5 active:scale-95 transition-all self-stretch sm:self-auto justify-center"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingSupabase ? 'Sincronizando...' : 'Garantir Todos no Supabase'}</span>
            </button>
          </div>

          {syncSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncSuccess}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-[#EDE9FE] border border-purple-200/70">
              <div className="text-[10px] font-bold text-purple-800 uppercase">Liberados</div>
              <div className="text-xl font-black text-purple-950">{checkedIn}</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#E0F2FE] border border-sky-200/70">
              <div className="text-[10px] font-bold text-sky-800 uppercase">Pendentes</div>
              <div className="text-xl font-black text-sky-950">{pending}</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-emerald-200/70">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Presença Total</div>
              <div className="text-xl font-black text-emerald-950">{percent}%</div>
            </div>
          </div>

          {/* Tab 1: Downloads */}
          {activeTab === 'downloads' && (
            <div className="space-y-3">
              {/* Card 1: Full CSV */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Relatório Nominal Completo (.CSV)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {total} Linhas
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Exporta todos os participantes com Expositor, Nome, CPF, Status (Entrou/Pendente), Horário Exato e Operador Responsável. Compatível com Excel Brasil e Google Sheets.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadFullCSV}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo .CSV Completo</span>
                  </button>

                  <button
                    onClick={handleCopyStatusTable}
                    className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center gap-1.5 transition-colors"
                    title="Copiar dados formatados para colar no Excel ou Sheets"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Summary by Exhibitor CSV */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span>Resumo Agrupado por Estande (.CSV)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    {exhibitorStats.length} Estandes
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Gera uma tabela resumida com o nome de cada empresa, quantidade total de credenciais, quantidade presente e taxa de presença de cada equipe.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadSummaryCSV}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Resumo por Estande (.CSV)</span>
                  </button>

                  <button
                    onClick={handleCopySummaryTable}
                    className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSummary ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Card 3: JSON Full Backup */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>Backup Técnico Integral (.JSON)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Exporta objeto estruturado com metadados e carimbo de horário.
                  </p>
                </div>
                <button
                  onClick={handleDownloadJSONBackup}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Exhibitor Breakdown */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold px-1">
                <span>Empresa / Estande</span>
                <span>Presentes / Total (% Taxa)</span>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {exhibitorStats.map((exp) => {
                  const pct = exp.total > 0 ? Math.round((exp.checkedIn / exp.total) * 100) : 0;
                  return (
                    <div
                      key={exp.name}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-xs truncate">{exp.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {exp.checkedIn} de {exp.total} presentes • {exp.total - exp.checkedIn} pendentes
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            pct === 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : pct > 0
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleDownloadSummaryCSV}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2 text-xs transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Exportar Resumo de Estandes para Planilha</span>
              </button>
            </div>
          )}

          {/* Tab 3: Printable Report Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 space-y-3 font-mono text-[11px] max-h-72 overflow-y-auto">
                <div className="border-b border-slate-200 pb-2 text-center">
                  <div className="font-black text-xs uppercase text-slate-900 font-sans">
                    RELATÓRIO OFICIAL DE ENTRADA & PORTARIA
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Gerado em: {nowFormatted} • Banco: Supabase ({cfg.table})
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>Total de Credenciados: <strong>{total}</strong></div>
                  <div>Entradas Confirmadas: <strong>{checkedIn}</strong></div>
                  <div>Pendentes: <strong>{pending}</strong></div>
                  <div>Taxa Geral: <strong>{percent}%</strong></div>
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-1">
                  <div className="font-bold text-[10px] uppercase text-slate-500 font-sans">
                    Últimas Entradas Confirmadas:
                  </div>
                  {attendees
                    .filter((a) => a.isCheckedIn)
                    .slice(0, 10)
                    .map((a) => (
                      <div key={a.id} className="flex justify-between text-[10px] border-b border-slate-100 py-0.5">
                        <span className="truncate max-w-[180px]">{a.name} ({a.exhibitor})</span>
                        <span className="text-emerald-700 font-bold shrink-0">{a.checkedInAt || 'Presente'} • {a.checkedBy || 'Portaria'}</span>
                      </div>
                    ))}
                  {checkedIn > 10 && (
                    <div className="text-[10px] text-slate-400 italic pt-1">
                      + {checkedIn - 10} outras entradas confirmadas no banco de dados.
                    </div>
                  )}
                  {checkedIn === 0 && (
                    <div className="text-[10px] text-slate-400 italic">
                      Nenhuma entrada confirmada até o momento.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2 text-xs transition-all shadow-xs"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Imprimir / Gerar PDF</span>
                </button>

                <button
                  onClick={handleDownloadFullCSV}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2 text-xs transition-all shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar CSV</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <span className="text-[11px] text-slate-500 font-medium">
            Todos os check-ins gravados no Supabase
          </span>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-900 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
