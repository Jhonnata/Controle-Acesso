import { Attendee, ColumnMapping } from '../types';

export interface StorageData {
  attendees: Attendee[];
  spreadsheetId: string;
  tabName: string;
  webhookUrl?: string;
  lastUpdated: string;
}

const STORAGE_KEY_WEBHOOK = 'access_control_webhook_url';
const STORAGE_KEY_CUSTOM_MAPPING = 'access_control_custom_mapping';

/**
 * Get and set Webhook URL (Google Apps Script Web App for direct sync)
 */
export function getSavedWebhookUrl(): string {
  return localStorage.getItem(STORAGE_KEY_WEBHOOK) || '';
}

export function saveWebhookUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEY_WEBHOOK, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_WEBHOOK);
  }
}

/**
 * Send check-in update to Google Apps Script webhook (if configured)
 */
export async function sendWebhookUpdate(
  webhookUrl: string,
  payload: {
    action: 'update_status' | 'batch_update' | 'add_attendee';
    attendee?: Attendee;
    attendees?: Attendee[];
    rowIndex?: number;
    isCheckedIn?: boolean;
    timestamp?: string;
    newAttendee?: any;
  }
): Promise<boolean> {
  if (!webhookUrl) return false;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.warn('Webhook sync note:', err);
    return false;
  }
}

/**
 * Parse raw text (TSV from Google Sheets copy-paste, or CSV from file upload)
 */
export function parsePastedOrCSVData(rawText: string): {
  attendees: Attendee[];
  headers: string[];
  mapping: ColumnMapping;
} {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Nenhum dado encontrado no texto colado.');
  }

  // Detect delimiter sampling multiple lines (the first line can be a title
  // without any delimiter, ex.: "23/08 - DOMINGO")
  const sampleLines = lines.slice(0, Math.min(lines.length, 20));
  const scoreDelimiter = (d: string) =>
    sampleLines.reduce((acc, line) => acc + line.split(d).length, 0);
  const delimiter = ['\t', ';', ','].reduce((a, b) =>
    scoreDelimiter(b) > scoreDelimiter(a) ? b : a
  );

  // Parse lines with quoted string handling
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parsedRows = lines.map(parseLine);
  if (parsedRows.length === 0) {
    throw new Error('Não foi possível processar as linhas.');
  }

  // Procura a linha de cabeçalho real: pode vir depois de linhas de título
  // (ex.: "23/08 - DOMINGO" na linha 1 e "EXPOSITOR | NOME | CPF" na linha 2)
  const HEADER_HINT_RE =
    /(expositor|empresa|nome|cpf|cnpj|documento|participante|convidado|cargo|funcao|função|estande|stand|status|check|presenca|presença|marca|razao|matricula|matrícula|email|e-mail|telefone)/i;
  let headerLineIdx = 0;
  for (let i = 0; i < Math.min(parsedRows.length, 20); i++) {
    const hits = parsedRows[i].filter((c) => HEADER_HINT_RE.test(c)).length;
    if (hits >= 2) {
      headerLineIdx = i;
      break;
    }
  }

  const rawHeaders = parsedRows[headerLineIdx];
  const hasHeaders =
    headerLineIdx > 0 ||
    rawHeaders.some((h) =>
      /(expositor|empresa|nome|cpf|participante|cargo|estande|status|check)/i.test(h)
    );

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (hasHeaders) {
    headers = rawHeaders;
    dataRows = parsedRows.slice(headerLineIdx + 1);
  } else {
    headers = rawHeaders.map((_, idx) => `Coluna ${idx + 1}`);
    dataRows = parsedRows;
  }

  const cleanHeaders = headers.map((h) => h.toLowerCase().trim());
  let exhibitorIndex = -1;
  let nameIndex = -1;
  let docIndex = -1;
  let roleIndex = -1;
  let standIndex = -1;
  let statusIndex = 4; // Column E strictly by default
  let timeIndex = 5;

  cleanHeaders.forEach((h, idx) => {
    if (exhibitorIndex === -1 && /(expositor|empresa|marca|razao|organizacao|company)/i.test(h)) {
      exhibitorIndex = idx;
    }
    if (nameIndex === -1 && /(nome|participante|integrante|titular|responsavel|name)/i.test(h) && idx !== exhibitorIndex) {
      nameIndex = idx;
    }
    if (docIndex === -1 && /(cpf|rg|documento|doc|crach|badge|matricula)/i.test(h)) {
      docIndex = idx;
    }
    if (roleIndex === -1 && /(cargo|funcao|função|tipo|perfil|categoria|setor)/i.test(h)) {
      roleIndex = idx;
    }
    if (standIndex === -1 && /(estande|stand|box|pavilh|localizacao|espaco)/i.test(h)) {
      standIndex = idx;
    }
    if (idx === 4 || /(status|check|presenca|presença|entrou|entrada|acesso)/i.test(h)) {
      statusIndex = idx;
    }
    if (/(data|hora|horario|timestamp)/i.test(h) && idx !== 0) {
      timeIndex = idx;
    }
  });

  if (!hasHeaders && headers.length >= 4) {
    exhibitorIndex = 0;
    standIndex = 1;
    nameIndex = 2;
    docIndex = 3;
    statusIndex = -1;
    timeIndex = -1;
  } else {
    if (exhibitorIndex === -1) exhibitorIndex = 0;
    if (nameIndex === -1) nameIndex = exhibitorIndex === 0 && headers.length > 1 ? 1 : 0;
  }

  const mapping: ColumnMapping = {
    exhibitorIndex,
    nameIndex,
    documentIndex: docIndex,
    roleIndex,
    standIndex,
    statusIndex,
    timestampIndex: timeIndex,
    emailIndex: -1,
    phoneIndex: -1,
  };

  const attendees: Attendee[] = [];
  let lastExhibitor = '';

  dataRows.forEach((row, index) => {
    if (row.length === 0 || row.every((c) => !c.trim())) return;

    const exhibitorCell = (row[exhibitorIndex] || '').trim();
    const exhibitor = exhibitorCell || lastExhibitor || 'Geral / Outros';
    const name = (row[nameIndex] || '').trim();
    const doc = docIndex >= 0 ? (row[docIndex] || '').trim() : undefined;
    const role = roleIndex >= 0 ? (row[roleIndex] || '').trim() : undefined;
    const stand = standIndex >= 0 ? (row[standIndex] || '').trim() : undefined;
    const rawStatus = statusIndex >= 0 ? (row[statusIndex] || '').trim().toLowerCase() : '';
    const rawTime = timeIndex >= 0 ? (row[timeIndex] || '').trim() : undefined;

    if (!name) return;
    if (exhibitorCell) lastExhibitor = exhibitorCell;

    const isCheckedIn =
      rawStatus === 'sim' ||
      rawStatus === 'ok' ||
      rawStatus === 'presente' ||
      rawStatus === 'entrou' ||
      rawStatus === 'true' ||
      rawStatus === '1' ||
      rawStatus === 's' ||
      rawStatus.startsWith('entrada em') ||
      rawStatus.startsWith('ok');

    attendees.push({
      id: `att-${index + 1}`,
      rowIndex: index + 2,
      name,
      exhibitor,
      document: doc || undefined,
      role: role || undefined,
      stand: stand || undefined,
      isCheckedIn,
      checkedInAt: isCheckedIn ? rawTime || undefined : undefined,
      rawValues: row,
    });
  });

  return {
    attendees,
    headers,
    mapping,
  };
}

/**
 * Generate UTF-8 CSV with BOM for Brazilian Excel & Google Sheets compatibility
 */
export function generateCSVReport(attendees: Attendee[]): string {
  const headers = [
    'Expositor / Empresa',
    'Nome do Participante',
    'CPF / Documento',
    'Cargo / Função',
    'Estande',
    'Status Entrada',
    'Horário de Entrada',
    'Operador Responsável',
    'Data de Registro',
    'ID Sistema',
  ];

  const escapeCell = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const todayStr = new Date().toLocaleDateString('pt-BR');

  const rows = attendees.map((a) => [
    escapeCell(a.exhibitor),
    escapeCell(a.name),
    escapeCell(a.document || ''),
    escapeCell(a.role || 'Credenciado'),
    escapeCell(a.stand || ''),
    escapeCell(a.isCheckedIn ? 'ENTROU' : 'PENDENTE'),
    escapeCell(a.checkedInAt || '-'),
    escapeCell(a.checkedBy || (a.isCheckedIn ? 'Portaria' : '-')),
    escapeCell(a.isCheckedIn ? todayStr : '-'),
    escapeCell(a.id),
  ]);

  const csvContent = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  return '\uFEFF' + csvContent;
}

/**
 * Generate Exhibitor Group Summary CSV
 */
export function generateExhibitorSummaryCSV(attendees: Attendee[]): string {
  const map: Record<string, { total: number; checkedIn: number }> = {};
  attendees.forEach((a) => {
    const exp = a.exhibitor || 'Outros';
    if (!map[exp]) map[exp] = { total: 0, checkedIn: 0 };
    map[exp].total += 1;
    if (a.isCheckedIn) map[exp].checkedIn += 1;
  });

  const headers = [
    'Expositor / Empresa',
    'Total Credenciais',
    'Entradas Confirmadas',
    'Pendentes',
    'Taxa de Presença (%)',
  ];

  const escapeCell = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([exhibitor, stats]) => {
      const pending = stats.total - stats.checkedIn;
      const pct = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
      return [
        escapeCell(exhibitor),
        escapeCell(stats.total),
        escapeCell(stats.checkedIn),
        escapeCell(pending),
        escapeCell(`${pct}%`),
      ];
    });

  const csvContent = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  return '\uFEFF' + csvContent;
}

/**
 * Generate CSV of confirmed entries grouped by exhibitor/company
 */
export function generateEnteredByExhibitorCSV(attendees: Attendee[]): string {
  const checkedInAttendees = attendees
    .filter((a) => a.isCheckedIn)
    .sort((a, b) => {
      const exhibitorCompare = (a.exhibitor || 'Outros').localeCompare(
        b.exhibitor || 'Outros',
        'pt-BR'
      );
      if (exhibitorCompare !== 0) return exhibitorCompare;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  const headers = [
    'Expositor / Empresa',
    'Nome do Participante',
    'CPF / Documento',
    'Cargo / Função',
    'Estande',
    'Horário de Entrada',
    'Operador Responsável',
  ];

  const escapeCell = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = checkedInAttendees.map((a) => [
    escapeCell(a.exhibitor || 'Outros'),
    escapeCell(a.name),
    escapeCell(a.document || ''),
    escapeCell(a.role || 'Credenciado'),
    escapeCell(a.stand || ''),
    escapeCell(a.checkedInAt || 'Presente'),
    escapeCell(a.checkedBy || 'Portaria'),
  ]);

  const csvContent = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  return '\uFEFF' + csvContent;
}
