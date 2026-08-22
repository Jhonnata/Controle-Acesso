import React, { useState } from 'react';
import {
  X,
  Clipboard,
  Upload,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Building,
} from 'lucide-react';
import { Attendee, ColumnMapping } from '../types';
import { parsePastedOrCSVData } from '../services/storage';
import * as XLSX from 'xlsx';
import { isValidEventDate, normalizeEventDateInput } from '../services/eventDates';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportAttendees: (
    attendees: Attendee[],
    headers: string[],
    mapping: ColumnMapping,
    selectedDay: string
  ) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportAttendees,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [previewAttendees, setPreviewAttendees] = useState<Attendee[] | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [detectedMapping, setDetectedMapping] = useState<ColumnMapping | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState('');

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setErrorMsg(null);
    if (!text.trim()) {
      setPreviewAttendees(null);
      return;
    }

    try {
      const result = parsePastedOrCSVData(text);
      if (result.attendees.length === 0) {
        setErrorMsg('Nenhuma linha válida encontrada no texto.');
        setPreviewAttendees(null);
        return;
      }
      setPreviewAttendees(result.attendees);
      setDetectedHeaders(result.headers);
      setDetectedMapping(result.mapping);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar os dados.');
      setPreviewAttendees(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            workbook.SheetNames.find((n) =>
              /credenci|particip|convid|lista/i.test(n)
            ) || workbook.SheetNames[0];
          const tsv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
            FS: '\t',
            blankrows: false,
          });
          setPasteText(tsv);
          handleParse(tsv);
        } catch (err: any) {
          setErrorMsg(
            err.message || 'Não foi possível ler a planilha Excel.'
          );
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
        handleParse(content);
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = () => {
    if (!previewAttendees || previewAttendees.length === 0 || !detectedMapping || !isValidEventDate(selectedDay)) {
      return;
    }
    onImportAttendees(previewAttendees, detectedHeaders, detectedMapping, selectedDay);
    onClose();
  };

  // Quick stats for preview
  const exhibitorCount = previewAttendees
    ? new Set(previewAttendees.map((a) => a.exhibitor)).size
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clipboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Importar / Colar Células</h3>
              <p className="text-[11px] text-slate-400">Envie um arquivo .XLSX / .CSV ou cole células do Sheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* How to copy instructions */}
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/70 text-[11px] text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Como copiar direto do Google Sheets:</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              1. Na sua planilha do Google, selecione as linhas com <strong>Ctrl+A</strong> (ou arraste com o mouse).<br />
              2. Pressione <strong>Ctrl+C</strong> para copiar.<br />
              3. Cole no campo abaixo (o app detecta as colunas automaticamente).
            </p>
          </div>

          {/* Paste Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center justify-between">
              <span>Cole o conteúdo aqui:</span>
              <span className="text-[10px] text-slate-500 font-normal">Aceita TSV, CSV ou texto tabulado</span>
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                handleParse(e.target.value);
              }}
              placeholder="Exemplo de conteúdo colado:&#10;Expositor	Nome	Documento	Cargo	Status&#10;Empresa A	João Silva	123.456.789-00	Diretor	SIM&#10;Empresa B	Maria Souza	987.654.321-00	Gerente	NÃO"
              rows={5}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px] focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* File Upload Alternative */}
          <div className="flex items-center gap-2">
            <label className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Ou Carregar Arquivo .XLSX / .CSV / .TXT</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center justify-between">
              <span>Dia da importação *</span>
              <span className="text-[10px] text-rose-400 font-normal">Obrigatório</span>
            </label>
            <input
              type="text"
              value={selectedDay}
              onChange={(e) => setSelectedDay(normalizeEventDateInput(e.target.value))}
              inputMode="numeric"
              maxLength={5}
              placeholder="dd/mm"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[10px] text-slate-500">
              O dia escolhido será aplicado a todos os registros desta importação.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 flex items-center gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview summary */}
          {previewAttendees && previewAttendees.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-slate-800 pb-2">
                <span>Prévia dos Dados Processados</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                  {previewAttendees.length} participantes detectados
                </span>
              </div>

              {selectedDay && (
                <div className="text-[11px] font-bold text-emerald-300">
                  Importação configurada para o dia {selectedDay}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">{previewAttendees.length} Pessoas</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-300">{exhibitorCount} Expositores</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                  Primeiras 3 linhas detectadas:
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {previewAttendees.slice(0, 3).map((a, i) => (
                    <div
                      key={i}
                      className="p-1.5 rounded-lg bg-slate-900 text-[10px] flex items-center justify-between text-slate-300"
                    >
                      <span className="font-semibold text-slate-100 truncate max-w-[140px]">{a.name}</span>
                      <span className="text-slate-400 truncate max-w-[120px]">{a.exhibitor}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.isCheckedIn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                        {a.isCheckedIn ? 'Entrou' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-900">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!previewAttendees || previewAttendees.length === 0 || !isValidEventDate(selectedDay)}
            className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>
              {selectedDay
                ? `Importar ${previewAttendees?.length || 0} no dia ${selectedDay}`
                : 'Escolha o dia para importar'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
