import React, { useMemo, useState } from 'react';
import {
  X,
  FileText,
  Users,
  Building,
  Calendar,
  Download,
  Copy,
  Check,
  Printer,
  Upload,
  Clipboard,
  AlertCircle,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Attendee, ColumnMapping } from '../types';
import {
  generateEnteredByExhibitorCSV,
  generateExhibitorSummaryCSV,
  parsePastedOrCSVData,
} from '../services/storage';
import {
  isValidEventDate,
  normalizeEventDateInput,
  sortEventDates,
} from '../services/eventDates';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAttendeesCount: number;
  checkedInCount: number;
  attendees: Attendee[];
  onImportAttendees: (
    attendees: Attendee[],
    headers: string[],
    mapping: ColumnMapping,
    selectedDay: string
  ) => void;
}

interface CompanySummaryItem {
  name: string;
  total: number;
  checkedIn: number;
}

interface CompanyEnteredGroup {
  name: string;
  attendees: Attendee[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  totalAttendeesCount,
  checkedInCount,
  attendees,
  onImportAttendees,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'import'>('overview');
  const [selectedReportDay, setSelectedReportDay] = useState<'all' | string>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedEntered, setCopiedEntered] = useState(false);

  const [pasteText, setPasteText] = useState('');
  const [previewAttendees, setPreviewAttendees] = useState<Attendee[] | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [detectedMapping, setDetectedMapping] = useState<ColumnMapping | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedImportDay, setSelectedImportDay] = useState('');

  const availableDates = useMemo(
    () => sortEventDates(attendees.map((attendee) => attendee.date || '').filter(Boolean)),
    [attendees]
  );

  const filteredAttendees =
    selectedReportDay === 'all'
      ? attendees
      : attendees.filter((attendee) => attendee.date === selectedReportDay);

  const checkedInAttendees = filteredAttendees
    .filter((attendee) => attendee.isCheckedIn)
    .sort((a, b) => {
      const exhibitorCompare = (a.exhibitor || 'Outros').localeCompare(
        b.exhibitor || 'Outros',
        'pt-BR'
      );
      if (exhibitorCompare !== 0) return exhibitorCompare;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  const summaryByCompany: CompanySummaryItem[] = useMemo(() => {
    const summaryMap = filteredAttendees.reduce(
      (acc, attendee) => {
        const key = attendee.exhibitor || 'Outros';
        if (!acc[key]) {
          acc[key] = { name: key, total: 0, checkedIn: 0 };
        }
        acc[key].total += 1;
        if (attendee.isCheckedIn) acc[key].checkedIn += 1;
        return acc;
      },
      {} as Record<string, CompanySummaryItem>
    );
    return (Object.values(summaryMap) as CompanySummaryItem[]).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [filteredAttendees]);

  const enteredByCompany: CompanyEnteredGroup[] = useMemo(() => {
    const groupsMap = checkedInAttendees.reduce(
      (acc, attendee) => {
        const key = attendee.exhibitor || 'Outros';
        if (!acc[key]) acc[key] = { name: key, attendees: [] };
        acc[key].attendees.push(attendee);
        return acc;
      },
      {} as Record<string, CompanyEnteredGroup>
    );
    return (Object.values(groupsMap) as CompanyEnteredGroup[]).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [checkedInAttendees]);

  const totalFiltered = filteredAttendees.length;
  const totalCheckedIn = checkedInAttendees.length;
  const totalPending = Math.max(0, totalFiltered - totalCheckedIn);
  const presenceRate = totalFiltered > 0 ? Math.round((totalCheckedIn / totalFiltered) * 100) : 0;

  const getCheckInHour = (value?: string): number | null => {
    if (!value) return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d.getHours();
    }
    const match = str.match(/(\d{1,2}):(\d{2})/);
    return match ? parseInt(match[1], 10) : null;
  };

  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}h`,
    count: checkedInAttendees.filter((attendee) => getCheckInHour(attendee.checkedInAt) === hour).length,
  }));
  const maxHourlyCount = Math.max(1, ...hourlyCounts.map((bucket) => bucket.count));

  if (!isOpen) return null;

  const handleDownloadSummaryCSV = () => {
    const csvContent = generateExhibitorSummaryCSV(filteredAttendees);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dayLabel = selectedReportDay === 'all' ? 'geral' : selectedReportDay.replace('/', '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `resumo_empresas_${dayLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadEnteredCSV = () => {
    const csvContent = generateEnteredByExhibitorCSV(filteredAttendees);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dayLabel = selectedReportDay === 'all' ? 'geral' : selectedReportDay.replace('/', '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `quem_entrou_por_empresa_${dayLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const header = 'Empresa\tTotal\tEntraram\tPendentes\tTaxa';
    const lines = summaryByCompany.map((item) => {
      const pending = item.total - item.checkedIn;
      const rate = item.total > 0 ? Math.round((item.checkedIn / item.total) * 100) : 0;
      return `${item.name}\t${item.total}\t${item.checkedIn}\t${pending}\t${rate}%`;
    });
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyEntered = () => {
    const header = 'Empresa\tNome\tCPF\tCargo\tEstande\tHorário\tOperador';
    const lines = checkedInAttendees.map(
      (attendee) =>
        `${attendee.exhibitor || 'Outros'}\t${attendee.name}\t${attendee.document || ''}\t${
          attendee.role || 'Credenciado'
        }\t${attendee.stand || ''}\t${attendee.checkedInAt || 'Presente'}\t${attendee.checkedBy || 'Portaria'}`
    );
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopiedEntered(true);
    setTimeout(() => setCopiedEntered(false), 2000);
  };

  const handlePrintPdfReport = () => {
    const reportWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!reportWindow) return;

    const summaryRows = summaryByCompany
      .map((item) => {
        const pending = item.total - item.checkedIn;
        const rate = item.total > 0 ? Math.round((item.checkedIn / item.total) * 100) : 0;
        return `<tr><td>${item.name}</td><td>${item.total}</td><td>${item.checkedIn}</td><td>${pending}</td><td>${rate}%</td></tr>`;
      })
      .join('');

    const enteredSections = enteredByCompany
      .map(
        (company) => `
          <section style="margin-top:24px;">
            <h3 style="margin:0 0 10px;font-size:16px;">${company.name} (${company.attendees.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Nome</th>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">CPF</th>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Cargo</th>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Estande</th>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Horário</th>
                  <th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Operador</th>
                </tr>
              </thead>
              <tbody>
                ${company.attendees
                  .map(
                    (attendee) => `
                    <tr>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.name}</td>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.document || ''}</td>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.role || 'Credenciado'}</td>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.stand || ''}</td>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.checkedInAt || 'Presente'}</td>
                      <td style="border-bottom:1px solid #eee;padding:6px;">${attendee.checkedBy || 'Portaria'}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </section>`
      )
      .join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>Dados & Relatórios</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2 { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
            .metric { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #f8fafc; }
            .muted { color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Dados & Relatórios</h1>
          <div class="muted">Gerado em ${new Date().toLocaleString('pt-BR')} • Filtro: ${
            selectedReportDay === 'all' ? 'Todos os dias' : `Dia ${selectedReportDay}`
          }</div>
          <div class="metrics">
            <div class="metric"><strong>Total</strong><br/>${totalFiltered}</div>
            <div class="metric"><strong>Entraram</strong><br/>${totalCheckedIn}</div>
            <div class="metric"><strong>Pendentes</strong><br/>${totalPending}</div>
            <div class="metric"><strong>Taxa</strong><br/>${presenceRate}%</div>
          </div>
          <h2>Resumo por empresa</h2>
          <table>
            <thead>
              <tr><th>Empresa</th><th>Total</th><th>Entraram</th><th>Pendentes</th><th>Taxa</th></tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
          <h2 style="margin-top:28px;">Lista de quem entrou</h2>
          ${enteredSections || '<p class="muted">Nenhuma entrada confirmada para o filtro selecionado.</p>'}
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const handleParseImport = (text: string) => {
    setImportError(null);
    if (!text.trim()) {
      setPreviewAttendees(null);
      setDetectedHeaders([]);
      setDetectedMapping(null);
      return;
    }

    try {
      const result = parsePastedOrCSVData(text);
      if (result.attendees.length === 0) {
        setImportError('Nenhuma linha válida encontrada no texto.');
        setPreviewAttendees(null);
        return;
      }
      setPreviewAttendees(result.attendees);
      setDetectedHeaders(result.headers);
      setDetectedMapping(result.mapping);
    } catch (err: any) {
      setImportError(err.message || 'Erro ao processar os dados.');
      setPreviewAttendees(null);
    }
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName =
            workbook.SheetNames.find((n) => /credenci|particip|convid|lista/i.test(n)) ||
            workbook.SheetNames[0];
          const tsv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
            FS: '\t',
            blankrows: false,
          });
          setPasteText(tsv);
          handleParseImport(tsv);
        } catch (err: any) {
          setImportError(err.message || 'Não foi possível ler a planilha Excel.');
        }
        e.target.value = '';
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPasteText(content);
        handleParseImport(content);
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = () => {
    if (!previewAttendees || !previewAttendees.length || !detectedMapping || !isValidEventDate(selectedImportDay)) {
      return;
    }
    onImportAttendees(previewAttendees, detectedHeaders, detectedMapping, selectedImportDay);
    onClose();
  };

  const exhibitorCount = previewAttendees
    ? new Set(previewAttendees.map((attendee) => attendee.exhibitor)).size
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 w-full max-w-5xl rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[18px] bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Dados & Relatórios</h3>
              <p className="text-xs text-slate-500">Visão geral, relatórios e importação sem sobrescrever existentes</p>
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
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Visão Geral</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'reports' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Relatórios</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'import' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-pink-600" />
            <span>Importar Excel</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {(activeTab === 'overview' || activeTab === 'reports') && (
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
              <button
                onClick={() => setSelectedReportDay('all')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition-all ${
                  selectedReportDay === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({attendees.length})
              </button>
              {availableDates.map((eventDate) => (
                <button
                  key={eventDate}
                  onClick={() => setSelectedReportDay(eventDate)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    selectedReportDay === eventDate
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>{eventDate}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
                  <div className="text-[10px] font-bold text-slate-500">Total</div>
                  <div className="text-2xl font-black text-slate-900">{totalFiltered}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#DCFCE7] border border-emerald-200/70">
                  <div className="text-[10px] font-bold text-emerald-800">Entraram</div>
                  <div className="text-2xl font-black text-emerald-950">{totalCheckedIn}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#E0F2FE] border border-sky-200/70">
                  <div className="text-[10px] font-bold text-sky-800">Pendentes</div>
                  <div className="text-2xl font-black text-sky-950">{totalPending}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#EDE9FE] border border-purple-200/70">
                  <div className="text-[10px] font-bold text-purple-800">Taxa</div>
                  <div className="text-2xl font-black text-purple-950">{presenceRate}%</div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span>Presença por empresa</span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {summaryByCompany.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">Nenhum dado no filtro selecionado.</div>
                    ) : (
                      summaryByCompany.map((item) => {
                        const rate = item.total > 0 ? Math.round((item.checkedIn / item.total) * 100) : 0;
                        return (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-slate-900 truncate">{item.name}</span>
                              <span className="font-black text-indigo-700 shrink-0">{item.checkedIn}/{item.total}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                    <div className="flex items-center gap-2 font-black text-slate-900">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>Entradas por hora</span>
                    </div>
                    <div className="grid grid-cols-6 gap-x-2 gap-y-4 min-h-52 pt-3">
                      {hourlyCounts.map((bucket) => {
                        const heightPct = Math.max(8, Math.round((bucket.count / maxHourlyCount) * 100));
                        return (
                          <div key={bucket.hour} className="flex flex-col items-center justify-end gap-1">
                            <div className="relative w-full h-20 flex items-end justify-center">
                              <span
                                className="absolute text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 rounded-sm shadow-2xs whitespace-nowrap tabular-nums"
                                style={{ top: '-10px' }}
                              >
                                {bucket.count}
                              </span>
                              <div
                                className={`w-full rounded-t-md ${bucket.count > 0 ? 'bg-emerald-500' : 'bg-slate-100'}`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="min-h-[12px] text-[9px] font-bold text-slate-500">{bucket.label}</span>
                          </div>
                        );
                      })}
                    </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <TrendingUp className="w-4 h-4 text-pink-600" />
                  <span>Resumo rápido</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {totalAttendeesCount} credenciados totais, {checkedInCount} entradas confirmadas no sistema e {summaryByCompany.length} empresas no filtro atual.
                </div>
                <div className="text-[11px] text-slate-500">
                  Você pode filtrar qualquer dia existente e importar novos dias no formato `dd/mm`.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadSummaryCSV}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV Resumo</span>
                </button>
                <button
                  onClick={handleDownloadEnteredCSV}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>CSV Quem Entrou</span>
                </button>
                <button
                  onClick={handleCopySummary}
                  className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black flex items-center justify-center gap-2"
                >
                  {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSummary ? 'Resumo copiado' : 'Copiar resumo'}</span>
                </button>
                <button
                  onClick={handleCopyEntered}
                  className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black flex items-center justify-center gap-2"
                >
                  {copiedEntered ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEntered ? 'Lista copiada' : 'Copiar quem entrou'}</span>
                </button>
              </div>

              <button
                onClick={handlePrintPdfReport}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Gerar PDF com resumo e quem entrou</span>
              </button>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Resumo por empresa</span>
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {summaryByCompany.length === 0 ? (
                    <div className="text-slate-500 text-[11px]">Nenhum dado no filtro selecionado.</div>
                  ) : (
                    summaryByCompany.map((item) => {
                      const pending = item.total - item.checkedIn;
                      const rate = item.total > 0 ? Math.round((item.checkedIn / item.total) * 100) : 0;
                      return (
                        <div key={item.name} className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{item.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {item.checkedIn} entraram • {pending} pendentes
                            </div>
                          </div>
                          <div className="text-[11px] font-black text-indigo-700 shrink-0">{rate}%</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Lista de quem entrou</span>
                </div>
                {enteredByCompany.length === 0 ? (
                  <div className="text-slate-500 text-[11px]">Nenhuma entrada confirmada para o filtro selecionado.</div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {enteredByCompany.map((company) => (
                      <div key={company.name} className="space-y-2">
                        <div className="font-black text-slate-900 text-sm">
                          {company.name} ({company.attendees.length})
                        </div>
                        {company.attendees.map((attendee) => (
                          <div key={attendee.id} className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{attendee.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {attendee.document || 'Sem CPF'} • {attendee.role || 'Credenciado'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {attendee.stand || 'Sem estande'} • {attendee.checkedBy || 'Portaria'}
                              </div>
                            </div>
                            <div className="text-[11px] font-bold text-emerald-700 shrink-0">
                              {attendee.checkedInAt || 'Presente'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                Escolha o dia, envie `.xlsx` ou `.csv` e importe apenas novos registros. CPF igual no mesmo dia, com ou sem pontuação, será ignorado e não atualizado.
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Dia da importação *</span>
                  <span className="text-[10px] text-rose-500 font-normal">Obrigatório</span>
                </label>
                <input
                  type="text"
                  value={selectedImportDay}
                  onChange={(e) => setSelectedImportDay(normalizeEventDateInput(e.target.value))}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="dd/mm"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                />
                <div className="text-[10px] text-slate-500">
                  Exemplo: `22/08`, `23/08` ou `28/08`. A data é obrigatória.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-emerald-600" />
                  <span>Cole o conteúdo aqui</span>
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    handleParseImport(e.target.value);
                  }}
                  placeholder="Expositor\tNome\tDocumento\tCargo\tStatus"
                  rows={6}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-[11px] focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <label className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Carregar arquivo .XLSX / .CSV / .TXT</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  onChange={handleImportFileUpload}
                  className="hidden"
                />
              </label>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{importError}</span>
                </div>
              )}

              {previewAttendees && previewAttendees.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-black text-slate-900">Prévia da importação</div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                      {previewAttendees.length} pessoas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{previewAttendees.length} participantes</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{exhibitorCount} empresas</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700">
                    {isValidEventDate(selectedImportDay)
                      ? `Todos os registros serão importados no dia ${selectedImportDay}.`
                      : 'Escolha um dia antes de confirmar a importação.'}
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {previewAttendees.slice(0, 5).map((attendee, index) => (
                      <div
                        key={`${attendee.id}-${index}`}
                        className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-[10px]"
                      >
                        <span className="font-semibold text-slate-900 truncate max-w-[140px]">{attendee.name}</span>
                        <span className="text-slate-500 truncate max-w-[120px]">{attendee.exhibitor}</span>
                        <span className="text-slate-500">{attendee.document || 'Sem CPF'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPasteText('');
                    setPreviewAttendees(null);
                    setDetectedHeaders([]);
                    setDetectedMapping(null);
                    setImportError(null);
                    setSelectedImportDay('');
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={!previewAttendees || previewAttendees.length === 0 || !detectedMapping || !isValidEventDate(selectedImportDay)}
                  className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Importar registros</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
