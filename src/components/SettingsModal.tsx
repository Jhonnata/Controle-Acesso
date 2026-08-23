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
import { Attendee, ImportBatch } from '../types';
import {
  generateEnteredByExhibitorCSV,
  generateExhibitorSummaryCSV,
  parsePastedOrCSVData,
} from '../services/storage';
import { GoogleSyncImport } from './GoogleSyncImport';
import { SheetRow } from '../utils/googleImport';
import {
  compareEventDates,
  getDefaultEventDate,
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
    batches: ImportBatch[]
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

interface ExcelImportSummary {
  importedSheets: Array<{ sheetName: string; eventDate: string; count: number }>;
  ignoredSheets: string[];
  source: 'manual' | 'excel-auto';
}

type PreviewMatchStatus = 'new' | 'existing_same_day' | 'missing_cpf' | 'duplicate_in_file';

interface PreviewImportItem {
  id: string;
  attendee: Attendee;
  eventDate: string;
  sheetName: string;
  exhibitor: string;
  normalizedCpf: string;
  matchStatus: PreviewMatchStatus;
  isSelected: boolean;
}

interface PreviewCompanyGroup {
  name: string;
  items: PreviewImportItem[];
}

interface PreviewImportBatch {
  sheetName: string;
  eventDate: string;
  timingLabel: 'past' | 'today' | 'future';
  companies: PreviewCompanyGroup[];
  counts: Record<PreviewMatchStatus, number>;
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
  const [previewBatches, setPreviewBatches] = useState<PreviewImportBatch[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedImportDay, setSelectedImportDay] = useState('');
  const [excelImportSummary, setExcelImportSummary] = useState<ExcelImportSummary | null>(null);
  const [selectedPreviewBatchKey, setSelectedPreviewBatchKey] = useState<string | null>(null);

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

  const existingCpfDayKeys = useMemo(() => {
    const cleanDoc = (value?: string) => (value || '').replace(/\D/g, '');
    return new Set(
      attendees
        .map((attendee) => {
          const cpf = cleanDoc(attendee.document);
          const day = normalizeEventDateInput(attendee.date || '');
          if (!cpf || !isValidEventDate(day)) return null;
          return `${cpf}|${day}`;
        })
        .filter(Boolean) as string[]
    );
  }, [attendees]);

  const buildPreviewBatches = (rawBatches: ImportBatch[]): PreviewImportBatch[] => {
    const seenKeys = new Set<string>();
    const today = getDefaultEventDate();

    return rawBatches.map((batch, batchIndex) => {
      const eventDate = normalizeEventDateInput(batch.eventDate);
      const safeEventDate = isValidEventDate(eventDate) ? eventDate : getDefaultEventDate();
      const timingLabel: 'past' | 'today' | 'future' =
        compareEventDates(safeEventDate, today) < 0
          ? 'past'
          : compareEventDates(safeEventDate, today) > 0
          ? 'future'
          : 'today';

      const items = batch.attendees.map((attendee, attendeeIndex) => {
        const normalizedCpf = String(attendee.document || '').replace(/\D/g, '');
        const key = normalizedCpf ? `${normalizedCpf}|${safeEventDate}` : '';

        let matchStatus: PreviewMatchStatus = 'new';
        if (!normalizedCpf) {
          matchStatus = 'missing_cpf';
        } else if (seenKeys.has(key)) {
          matchStatus = 'duplicate_in_file';
        } else if (existingCpfDayKeys.has(key)) {
          matchStatus = 'existing_same_day';
        }

        if (normalizedCpf) seenKeys.add(key);

        return {
          id: `${batchIndex}-${attendeeIndex}-${safeEventDate}-${normalizedCpf || 'sem-cpf'}-${attendee.name}`,
          attendee: { ...attendee, date: safeEventDate },
          eventDate: safeEventDate,
          sheetName: batch.sheetName || 'Importação manual',
          exhibitor: attendee.exhibitor || 'Geral / Outros',
          normalizedCpf,
          matchStatus,
          isSelected: matchStatus === 'new' || matchStatus === 'missing_cpf',
        } satisfies PreviewImportItem;
      });

      const companiesMap = items.reduce<Record<string, PreviewCompanyGroup>>((acc, item) => {
        const exhibitor = item.exhibitor || 'Geral / Outros';
        if (!acc[exhibitor]) acc[exhibitor] = { name: exhibitor, items: [] };
        acc[exhibitor].items.push(item);
        return acc;
      }, {});

      const counts = items.reduce<Record<PreviewMatchStatus, number>>(
        (acc, item) => {
          acc[item.matchStatus] += 1;
          return acc;
        },
        { new: 0, existing_same_day: 0, missing_cpf: 0, duplicate_in_file: 0 }
      );

      return {
        sheetName: batch.sheetName || 'Importação manual',
        eventDate: safeEventDate,
        timingLabel,
        companies: Object.values(companiesMap).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        counts,
      };
    });
  };

  const selectedPreviewItems = useMemo(
    () =>
      previewBatches.flatMap((batch) =>
        batch.companies.flatMap((company) => company.items.filter((item) => item.isSelected))
      ),
    [previewBatches]
  );

  const selectedPreviewBatch = useMemo(() => {
    if (!previewBatches.length) return null;
    if (!selectedPreviewBatchKey) return previewBatches[0];
    return (
      previewBatches.find(
        (batch) => `${batch.sheetName}-${batch.eventDate}` === selectedPreviewBatchKey
      ) || previewBatches[0]
    );
  }, [previewBatches, selectedPreviewBatchKey]);

  const selectedBatchPreviewItems = useMemo(
    () =>
      selectedPreviewBatch?.companies.flatMap((company) =>
        company.items.filter((item) => item.isSelected)
      ) || [],
    [selectedPreviewBatch]
  );

  const previewTotals = useMemo(
    () =>
      previewBatches.reduce(
        (acc, batch) => {
          acc.total += batch.counts.new + batch.counts.existing_same_day + batch.counts.missing_cpf + batch.counts.duplicate_in_file;
          acc.new += batch.counts.new;
          acc.existing += batch.counts.existing_same_day;
          acc.missingCpf += batch.counts.missing_cpf;
          acc.duplicateInFile += batch.counts.duplicate_in_file;
          return acc;
        },
        { total: 0, new: 0, existing: 0, missingCpf: 0, duplicateInFile: 0 }
      ),
    [previewBatches]
  );

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
      setPreviewBatches([]);
      setExcelImportSummary(null);
      return;
    }

    try {
      const result = parsePastedOrCSVData(text);
      if (result.attendees.length === 0) {
        setImportError('Nenhuma linha válida encontrada no texto.');
        setPreviewBatches([]);
        setSelectedPreviewBatchKey(null);
        return;
      }
      const nextPreviewBatches = buildPreviewBatches([
        {
          attendees: result.attendees,
          headers: result.headers,
          mapping: result.mapping,
          eventDate: normalizeEventDateInput(selectedImportDay),
          sheetName: 'Importação manual',
        },
      ]);
      setPreviewBatches(nextPreviewBatches);
      setSelectedPreviewBatchKey(
        nextPreviewBatches[0]
          ? `${nextPreviewBatches[0].sheetName}-${nextPreviewBatches[0].eventDate}`
          : null
      );
      setExcelImportSummary({
        importedSheets: [],
        ignoredSheets: [],
        source: 'manual',
      });
    } catch (err: any) {
      setImportError(err.message || 'Erro ao processar os dados.');
      setPreviewBatches([]);
      setSelectedPreviewBatchKey(null);
      setExcelImportSummary(null);
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
          const importedSheets: Array<{ sheetName: string; eventDate: string; count: number }> = [];
          const ignoredSheets: string[] = [];
          const nextBatches: ImportBatch[] = [];

            workbook.SheetNames.forEach((sheetName) => {
              const eventDateMatch = sheetName.match(/(?:^|[^\d])(\d{2}\/\d{2}|\d{4})(?:[^\d]|$)/);
              const eventDate = eventDateMatch ? normalizeEventDateInput(eventDateMatch[1]) : '';

            if (!isValidEventDate(eventDate)) {
              ignoredSheets.push(sheetName);
              return;
            }

            const tsv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
              FS: '\t',
              blankrows: false,
            });
            const result = parsePastedOrCSVData(tsv);

            if (!result.attendees.length) {
              ignoredSheets.push(sheetName);
              return;
            }

            nextBatches.push({
              attendees: result.attendees,
              headers: result.headers,
              mapping: result.mapping,
              eventDate,
              sheetName,
            });
            importedSheets.push({
              sheetName,
              eventDate,
              count: result.attendees.length,
            });
          });

            if (!nextBatches.length) {
              setImportError('Nenhuma aba com data no formato dd/mm ou ddmm foi encontrada para importar.');
              setPreviewBatches([]);
              setSelectedPreviewBatchKey(null);
              setExcelImportSummary(null);
              return;
            }

            setPasteText('');
            const nextPreviewBatches = buildPreviewBatches(nextBatches);
            setPreviewBatches(nextPreviewBatches);
            setSelectedPreviewBatchKey(
              nextPreviewBatches[0]
                ? `${nextPreviewBatches[0].sheetName}-${nextPreviewBatches[0].eventDate}`
                : null
            );
            setExcelImportSummary({
              importedSheets,
              ignoredSheets,
              source: 'excel-auto',
            });
          } catch (err: any) {
            setImportError(err.message || 'Não foi possível ler a planilha Excel.');
            setPreviewBatches([]);
            setSelectedPreviewBatchKey(null);
            setExcelImportSummary(null);
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
    if (!selectedPreviewBatch || !selectedBatchPreviewItems.length) {
      return;
    }
    onImportAttendees([
      {
        attendees: selectedPreviewBatch.companies.flatMap((company) =>
          company.items.filter((item) => item.isSelected).map((item) => item.attendee)
        ),
        headers: [],
        mapping: {
          exhibitorIndex: -1,
          nameIndex: -1,
          statusIndex: -1,
          timestampIndex: -1,
          documentIndex: -1,
          roleIndex: -1,
          standIndex: -1,
          emailIndex: -1,
          phoneIndex: -1,
        },
        eventDate: selectedPreviewBatch.eventDate,
        sheetName: selectedPreviewBatch.sheetName,
      },
    ]);
    onClose();
  };

  const handleGoogleImportRows = (rows: SheetRow[]) => {
    if (!isValidEventDate(selectedImportDay)) {
      setImportError('Escolha um dia válido (dd/mm) antes de importar do Google Sheets.');
      return;
    }
    onImportAttendees([
      {
        attendees: rows.map((row, index) => ({
          id: `att-${selectedImportDay}-g-${Date.now()}-${index}`,
          rowIndex: index + 2,
          name: String(row.nome || ''),
          exhibitor: String(row.empresa || 'Geral / Outros'),
          document: row.cpf ? String(row.cpf) : undefined,
          isCheckedIn: false,
          rawValues: [],
        })),
        headers: [],
        mapping: {
          exhibitorIndex: -1,
          nameIndex: -1,
          statusIndex: -1,
          timestampIndex: -1,
          documentIndex: -1,
          roleIndex: -1,
          standIndex: -1,
          emailIndex: -1,
          phoneIndex: -1,
        },
        eventDate: selectedImportDay,
        sheetName: 'Google Sheets',
      },
    ]);
    onClose();
  };

  const togglePreviewItem = (targetId: string) => {
    setPreviewBatches((current) =>
      current.map((batch) => ({
        ...batch,
        companies: batch.companies.map((company) => ({
          ...company,
          items: company.items.map((item) =>
            item.id === targetId ? { ...item, isSelected: !item.isSelected } : item
          ),
        })),
      }))
    );
  };

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
                Revise por aba e por empresa antes de importar. CPF igual no mesmo dia, com ou sem pontuação, aparece como conflito; registros sem CPF ficam separados com alerta.
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                    <span>Dia da importação</span>
                    <span className="text-[10px] text-slate-500 font-normal">CSV / texto</span>
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
                  Exemplo: `22/08`, `23/08`, `28/08` ou abas Excel como `2308`. Em Excel com abas datadas, o dia vem do nome da aba.
                </div>
              </div>

              <GoogleSyncImport
                existingRecords={attendees}
                keyFields={['cpf']}
                selectedDay={selectedImportDay}
                onImportRows={handleGoogleImportRows}
              />

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

              {previewBatches.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-black text-slate-900">Prévia da importação</div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                      {previewTotals.total} pessoas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{previewTotals.new} não encontrados</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{previewTotals.existing} encontrados</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>{previewTotals.missingCpf} sem CPF</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-rose-600" />
                      <span>{previewTotals.duplicateInFile} duplicados no arquivo</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700">
                    {excelImportSummary?.source === 'excel-auto'
                      ? 'As datas serão definidas automaticamente pelo nome de cada aba.'
                      : isValidEventDate(selectedImportDay)
                      ? `Todos os registros serão importados no dia ${selectedImportDay}.`
                      : 'Escolha um dia antes de confirmar a importação.'}
                  </div>
                  {excelImportSummary?.source === 'excel-auto' && (
                    <div className="space-y-2 text-[10px]">
                      <div className="font-black text-slate-800">Abas detectadas</div>
                      <div className="flex flex-wrap gap-2">
                        {excelImportSummary.importedSheets.map((sheet) => (
                          <button
                            key={`${sheet.sheetName}-${sheet.eventDate}`}
                            type="button"
                            onClick={() => setSelectedPreviewBatchKey(`${sheet.sheetName}-${sheet.eventDate}`)}
                            className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                              selectedPreviewBatchKey === `${sheet.sheetName}-${sheet.eventDate}`
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-slate-200 text-slate-900 hover:border-emerald-300'
                            }`}
                          >
                            <div className="font-semibold truncate max-w-[180px]">{sheet.sheetName}</div>
                            <div
                              className={`text-[10px] font-black ${
                                selectedPreviewBatchKey === `${sheet.sheetName}-${sheet.eventDate}`
                                  ? 'text-emerald-50'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {sheet.eventDate} • {sheet.count} registros
                            </div>
                          </button>
                        ))}
                      </div>
                      {excelImportSummary.ignoredSheets.length > 0 && (
                        <div className="text-amber-700">
                          Abas ignoradas por não conterem data `dd/mm` ou `ddmm`: {excelImportSummary.ignoredSheets.join(', ')}.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {selectedPreviewBatch && (
                      <div
                        key={`${selectedPreviewBatch.sheetName}-${selectedPreviewBatch.eventDate}`}
                        className="p-3 rounded-xl bg-white border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-black text-slate-900">{selectedPreviewBatch.sheetName}</div>
                            <div className="text-[10px] text-slate-500">
                              Dia {selectedPreviewBatch.eventDate} •{' '}
                              {selectedPreviewBatch.timingLabel === 'past'
                                ? 'Passado'
                                : selectedPreviewBatch.timingLabel === 'today'
                                ? 'Hoje'
                                : 'Futuro'}
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-slate-600">
                            {selectedPreviewBatch.counts.new} novos •{' '}
                            {selectedPreviewBatch.counts.existing_same_day} conflitos
                          </div>
                        </div>

                        {selectedPreviewBatch.companies.map((company) => (
                          <div
                            key={`${selectedPreviewBatch.sheetName}-${company.name}`}
                            className="space-y-2 border-t border-slate-100 pt-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-900">{company.name}</div>
                              <div className="text-[10px] text-slate-500">{company.items.length} registros</div>
                            </div>

                            {(['new', 'existing_same_day', 'missing_cpf', 'duplicate_in_file'] as PreviewMatchStatus[]).map((status) => {
                              const items = company.items.filter((item) => item.matchStatus === status);
                              if (!items.length) return null;

                              const statusLabel =
                                status === 'new'
                                  ? 'Não encontrados'
                                  : status === 'existing_same_day'
                                  ? 'Encontrados no sistema'
                                  : status === 'missing_cpf'
                                  ? 'Sem CPF'
                                  : 'Duplicados no arquivo';

                              return (
                                <div key={`${company.name}-${status}`} className="space-y-1">
                                  <div className="text-[10px] font-black text-slate-700">{statusLabel}</div>
                                  <div className="space-y-1">
                                    {items.map((item) => (
                                      <label
                                        key={item.id}
                                        className={`flex items-start gap-2 p-2 rounded-lg border text-[10px] ${
                                          item.matchStatus === 'new'
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : item.matchStatus === 'missing_cpf'
                                            ? 'bg-amber-50 border-amber-200'
                                            : 'bg-rose-50 border-rose-200'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={item.isSelected}
                                          onChange={() => togglePreviewItem(item.id)}
                                          className="mt-0.5"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-semibold text-slate-900">{item.attendee.name}</div>
                                          <div className="text-slate-500">
                                            {item.attendee.document || 'Sem CPF'} {item.normalizedCpf ? `• CPF ${item.normalizedCpf}` : ''} • {item.eventDate}
                                          </div>
                                          {item.matchStatus === 'existing_same_day' && (
                                            <div className="text-rose-700">Já existe no sistema para o mesmo dia.</div>
                                          )}
                                          {item.matchStatus === 'missing_cpf' && (
                                            <div className="text-amber-700">Sem CPF: pode gerar duplicidade.</div>
                                          )}
                                          {item.matchStatus === 'duplicate_in_file' && (
                                            <div className="text-rose-700">Duplicado dentro do próprio arquivo.</div>
                                          )}
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPasteText('');
                    setPreviewBatches([]);
                    setImportError(null);
                    setSelectedImportDay('');
                    setExcelImportSummary(null);
                    setSelectedPreviewBatchKey(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={
                    selectedBatchPreviewItems.length === 0 ||
                    (excelImportSummary?.source !== 'excel-auto' && !isValidEventDate(selectedImportDay))
                  }
                  className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {selectedPreviewBatch
                      ? `Importar aba ${selectedPreviewBatch.sheetName} (${selectedBatchPreviewItems.length})`
                      : `Importar selecionados (${selectedBatchPreviewItems.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
