import { Attendee, ColumnMapping, ExhibitorGroup, SheetInfo, SheetTabInfo } from '../types';
import { getAccessToken } from './auth';

export const DEFAULT_SPREADSHEET_ID = '1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc';
export const DEFAULT_TARGET_GID = '752074394';

const STORAGE_KEY_SPREADSHEET_ID = 'access_control_spreadsheet_id';
const STORAGE_KEY_ACTIVE_TAB = 'access_control_active_tab';
const STORAGE_KEY_TARGET_GID = 'access_control_target_gid';
const STORAGE_KEY_CUSTOM_MAPPING = 'access_control_custom_mapping';

/**
 * Parse a raw string which could be a Google Sheets URL or a clean Sheet ID,
 * and extract the Sheet ID and any GID (tab ID).
 */
export function parseSpreadsheetInput(input: string): { sheetId: string; gid?: string } {
  const clean = input.trim();
  if (!clean) {
    return { sheetId: DEFAULT_SPREADSHEET_ID, gid: DEFAULT_TARGET_GID };
  }

  // Check if it's a URL
  const matchId = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const matchGid = clean.match(/[?&#]gid=([0-9]+)/);

  const sheetId = matchId ? matchId[1] : clean.split('/')[0].split('?')[0];
  const gid = matchGid ? matchGid[1] : undefined;

  return { sheetId, gid };
}

export function getSavedSpreadsheetId(): string {
  const saved = localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID);
  if (!saved) return DEFAULT_SPREADSHEET_ID;
  const parsed = parseSpreadsheetInput(saved);
  return parsed.sheetId || DEFAULT_SPREADSHEET_ID;
}

export function saveSpreadsheetId(idOrUrl: string) {
  const { sheetId, gid } = parseSpreadsheetInput(idOrUrl);
  localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, sheetId);
  if (gid) {
    localStorage.setItem(STORAGE_KEY_TARGET_GID, gid);
  }
}

export function getSavedTargetGid(): string | null {
  return localStorage.getItem(STORAGE_KEY_TARGET_GID) || DEFAULT_TARGET_GID;
}

export function saveTargetGid(gid: string) {
  localStorage.setItem(STORAGE_KEY_TARGET_GID, gid);
}

export function getSavedActiveTab(): string | null {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
}

export function saveActiveTab(tab: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, tab);
}

export function getSavedCustomMapping(): ColumnMapping | null {
  const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_MAPPING);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function saveCustomMapping(mapping: ColumnMapping | null) {
  if (mapping) {
    localStorage.setItem(STORAGE_KEY_CUSTOM_MAPPING, JSON.stringify(mapping));
  } else {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_MAPPING);
  }
}

/**
 * Safely format range with single quotes for tab names with spaces/symbols
 */
export function formatSheetRange(tabName: string, cellRange: string): string {
  const cleanTab = tabName.replace(/'/g, "''");
  return `'${cleanTab}'!${cellRange}`;
}

/**
 * Fetch spreadsheet metadata (title and sheet tabs with sheetId/gid)
 */
export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken?: string,
  preferredGid?: string
): Promise<SheetInfo> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 401 || errData?.error?.message?.includes('insufficient')) {
      throw new Error(
        'Request had insufficient authentication scopes: O Google precisa de permissão de acesso ao Google Sheets. Por favor, clique em "Reconectar" para conceder acesso às planilhas.'
      );
    }
    const message = errData?.error?.message || `Erro ${res.status}: Falha ao acessar a planilha.`;
    throw new Error(message);
  }

  const data = await res.json();
  const title = data.properties?.title || 'Controle de Acesso';
  const tabs: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || 'Sheet1',
    index: s.properties?.index ?? 0,
  }));

  if (tabs.length === 0) {
    tabs.push({ sheetId: 0, title: 'Sheet1', index: 0 });
  }

  // Check if we have a target GID (e.g. 659040042)
  const targetGid = preferredGid || getSavedTargetGid();
  let selectedTab = tabs[0].title;
  let activeSheetId = tabs[0].sheetId;

  if (targetGid) {
    const matchedTabByGid = tabs.find((t) => String(t.sheetId) === String(targetGid));
    if (matchedTabByGid) {
      selectedTab = matchedTabByGid.title;
      activeSheetId = matchedTabByGid.sheetId;
    }
  } else {
    const savedTab = getSavedActiveTab();
    if (savedTab) {
      const matched = tabs.find((t) => t.title === savedTab);
      if (matched) {
        selectedTab = matched.title;
        activeSheetId = matched.sheetId;
      }
    }
  }

  return {
    id: spreadsheetId,
    title,
    tabs,
    activeTab: selectedTab,
    activeSheetId,
  };
}

/**
 * Automatically detect column indices from header row with comprehensive keyword detection
 */
export function detectColumnMapping(headers: string[]): { mapping: ColumnMapping; headers: string[] } {
  const clean = headers.map((h) => (h ? String(h).trim().toLowerCase() : ''));

  let exhibitorIndex = -1;
  let nameIndex = -1;
  let statusIndex = -1;
  let timestampIndex = -1;
  let documentIndex = -1;
  let roleIndex = -1;
  let standIndex = -1;
  let emailIndex = -1;
  let phoneIndex = -1;

  // 1. Detect Exhibitor / Empresa
  clean.forEach((h, idx) => {
    if (
      exhibitorIndex === -1 &&
      (h.includes('expositor') ||
        h.includes('empresa') ||
        h.includes('razão social') ||
        h.includes('razao social') ||
        h.includes('nome fantasia') ||
        h.includes('marca') ||
        h.includes('companhia') ||
        h.includes('organização') ||
        h.includes('organizacao') ||
        h.includes('instituição') ||
        h.includes('instituicao') ||
        h.includes('exhibitor') ||
        h.includes('company'))
    ) {
      exhibitorIndex = idx;
    }
  });

  // 2. Detect Name / Participante
  clean.forEach((h, idx) => {
    if (
      nameIndex === -1 &&
      (h.includes('nome do participante') ||
        h.includes('nome completo') ||
        h.includes('nome do integrante') ||
        h.includes('nome credenciado') ||
        h.includes('nome do responsável') ||
        h.includes('nome') ||
        h.includes('participante') ||
        h.includes('integrante') ||
        h.includes('pessoa') ||
        h.includes('credenciado') ||
        h.includes('responsável') ||
        h.includes('responsavel') ||
        h.includes('titular') ||
        h.includes('colaborador') ||
        h.includes('atendente') ||
        h.includes('promotor') ||
        h.includes('full name') ||
        h === 'name')
    ) {
      // Avoid accidentally picking company name if it had 'nome da empresa'
      if (idx !== exhibitorIndex) {
        nameIndex = idx;
      }
    }
  });

  // 3. Detect Document / CPF / RG / Crachá
  clean.forEach((h, idx) => {
    if (
      documentIndex === -1 &&
      (h.includes('cpf') ||
        h.includes('rg') ||
        h.includes('documento') ||
        h.includes('doc') ||
        h.includes('crachá') ||
        h.includes('cracha') ||
        h.includes('badge') ||
        h.includes('matrícula') ||
        h.includes('matricula') ||
        h.includes('passaporte') ||
        h.includes('identidade') ||
        h === 'id')
    ) {
      documentIndex = idx;
    }
  });

  // 4. Detect Role / Cargo / Função
  clean.forEach((h, idx) => {
    if (
      roleIndex === -1 &&
      (h.includes('cargo') ||
        h.includes('função') ||
        h.includes('funcao') ||
        h.includes('tipo') ||
        h.includes('categoria') ||
        h.includes('perfil') ||
        h.includes('setor') ||
        h.includes('departamento') ||
        h.includes('credencial') ||
        h.includes('role'))
    ) {
      roleIndex = idx;
    }
  });

  // 5. Detect Stand / Estande
  clean.forEach((h, idx) => {
    if (
      standIndex === -1 &&
      (h.includes('estande') ||
        h.includes('stand') ||
        h.includes('box') ||
        h.includes('pavilhão') ||
        h.includes('pavilhao') ||
        h.includes('localização') ||
        h.includes('localizacao') ||
        h.includes('espaço') ||
        h.includes('espaco') ||
        h.includes('ilha') ||
        h.includes('número do estande') ||
        h.includes('numero do estande'))
    ) {
      standIndex = idx;
    }
  });

  // 6. Detect Email
  clean.forEach((h, idx) => {
    if (emailIndex === -1 && (h.includes('email') || h.includes('e-mail') || h.includes('correio'))) {
      emailIndex = idx;
    }
  });

  // 7. Detect Phone
  clean.forEach((h, idx) => {
    if (
      phoneIndex === -1 &&
      (h.includes('fone') ||
        h.includes('telefone') ||
        h.includes('celular') ||
        h.includes('whatsapp') ||
        h.includes('tel') ||
        h.includes('contato'))
    ) {
      phoneIndex = idx;
    }
  });

  // 8. Detect Check-in Status (Strictly prioritizing Column E / 'status')
  // First check if column index 4 (Column E) is 'status'
  if (clean.length > 4 && (clean[4] === 'status' || clean[4].includes('status') || clean[4].includes('presen') || clean[4].includes('check'))) {
    statusIndex = 4;
  }

  // Otherwise search across all headers for 'status'
  if (statusIndex === -1) {
    clean.forEach((h, idx) => {
      if (
        statusIndex === -1 &&
        (h === 'status' ||
          h.includes('status entrada') ||
          h.includes('status do check') ||
          h.includes('status check-in') ||
          h.includes('status') ||
          h.includes('check-in') ||
          h.includes('checkin') ||
          h.includes('entrada realizada') ||
          h.includes('presença') ||
          h.includes('presenca') ||
          h.includes('presente') ||
          h.includes('entrou') ||
          h.includes('acesso liberado') ||
          h.includes('validação') ||
          h.includes('validacao') ||
          h === 'entrada' ||
          h === 'acesso')
      ) {
        statusIndex = idx;
      }
    });
  }

  // 9. Detect Check-in Timestamp (not form submission date)
  clean.forEach((h, idx) => {
    if (
      timestampIndex === -1 &&
      idx !== statusIndex &&
      (h.includes('data/hora entrada') ||
        h.includes('data da entrada') ||
        h.includes('horário de entrada') ||
        h.includes('horario de entrada') ||
        h.includes('hora entrada') ||
        h.includes('momento entrada') ||
        h.includes('timestamp check-in') ||
        h.includes('check-in em') ||
        h.includes('data/hora do acesso'))
    ) {
      timestampIndex = idx;
    }
  });

  // Smart fallbacks
  // If no exhibitor found, try first column that is not timestamp/date
  if (exhibitorIndex === -1) {
    for (let i = 0; i < clean.length; i++) {
      if (!clean[i].includes('carimbo') && !clean[i].includes('data') && !clean[i].includes('hora') && i !== nameIndex && i !== statusIndex) {
        exhibitorIndex = i;
        break;
      }
    }
    if (exhibitorIndex === -1) exhibitorIndex = 0;
  }

  // If no name found, pick next available column
  if (nameIndex === -1) {
    for (let i = 0; i < clean.length; i++) {
      if (i !== exhibitorIndex && i !== statusIndex && !clean[i].includes('carimbo') && !clean[i].includes('data')) {
        nameIndex = i;
        break;
      }
    }
    if (nameIndex === -1) nameIndex = exhibitorIndex === 0 ? 1 : 0;
  }

  // Default status column to Column E (index 4) if not detected
  if (statusIndex === -1) {
    statusIndex = 4; // Column E
  }

  const finalHeaders = [...headers];
  while (finalHeaders.length <= Math.max(statusIndex, timestampIndex, 4)) {
    finalHeaders.push(`Coluna ${columnIndexToLetter(finalHeaders.length)}`);
  }
  if (finalHeaders[statusIndex] === undefined || finalHeaders[statusIndex].startsWith('Coluna')) {
    finalHeaders[statusIndex] = 'Status';
  }

  return {
    mapping: {
      exhibitorIndex,
      nameIndex,
      statusIndex,
      timestampIndex,
      documentIndex,
      roleIndex,
      standIndex,
      emailIndex,
      phoneIndex,
    },
    headers: finalHeaders,
  };
}

/**
 * Fetch all attendee rows from Google Sheets tab
 */
export async function fetchSheetAttendees(
  spreadsheetId: string,
  tabName: string,
  accessToken?: string
): Promise<{ attendees: Attendee[]; headers: string[]; mapping: ColumnMapping; totalRowsInSheet: number }> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  // Fetch full range of tab
  const range = encodeURIComponent(formatSheetRange(tabName, 'A1:ZZ'));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 401 || errData?.error?.message?.includes('insufficient')) {
      throw new Error(
        'Request had insufficient authentication scopes: O Google precisa de permissão de acesso ao Google Sheets. Por favor, clique em "Reconectar" para conceder acesso às planilhas.'
      );
    }
    const message = errData?.error?.message || `Erro ${res.status}: Falha ao carregar dados da planilha.`;
    throw new Error(message);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  if (rows.length === 0) {
    return {
      attendees: [],
      headers: ['Expositor', 'Nome', 'Documento', 'Cargo/Tipo', 'Estande', 'Status Entrada', 'Data/Hora Entrada'],
      mapping: {
        exhibitorIndex: 0,
        nameIndex: 1,
        documentIndex: 2,
        roleIndex: 3,
        standIndex: 4,
        statusIndex: 5,
        timestampIndex: 6,
        emailIndex: -1,
        phoneIndex: -1,
      },
      totalRowsInSheet: 0,
    };
  }

  const headerRow = rows[0].map((c) => (c !== undefined && c !== null ? String(c) : ''));
  const { mapping: autoMapping, headers: autoHeaders } = detectColumnMapping(headerRow);

  // Check if user has saved custom column mapping
  const savedMapping = getSavedCustomMapping();
  const mapping = savedMapping || autoMapping;
  const headers = autoHeaders;

  const attendees: Attendee[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Check if row has any non-empty cell
    const hasAnyValue = row.some((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (!hasAnyValue) continue;

    const exhibitor = (
      mapping.exhibitorIndex >= 0 && row[mapping.exhibitorIndex] !== undefined
        ? String(row[mapping.exhibitorIndex])
        : ''
    ).trim();

    const name = (
      mapping.nameIndex >= 0 && row[mapping.nameIndex] !== undefined ? String(row[mapping.nameIndex]) : ''
    ).trim();

    const rawStatus = (
      mapping.statusIndex >= 0 && row[mapping.statusIndex] !== undefined ? String(row[mapping.statusIndex]) : ''
    ).trim();

    const checkedInAt = (
      mapping.timestampIndex >= 0 && row[mapping.timestampIndex] !== undefined
        ? String(row[mapping.timestampIndex])
        : ''
    ).trim();

    // Check if status represents entered
    const isCheckedIn = isStatusCheckedIn(rawStatus);

    const docVal =
      mapping.documentIndex >= 0 && row[mapping.documentIndex] !== undefined
        ? String(row[mapping.documentIndex]).trim()
        : undefined;
    const roleVal =
      mapping.roleIndex >= 0 && row[mapping.roleIndex] !== undefined
        ? String(row[mapping.roleIndex]).trim()
        : undefined;
    const standVal =
      mapping.standIndex >= 0 && row[mapping.standIndex] !== undefined
        ? String(row[mapping.standIndex]).trim()
        : undefined;
    const emailVal =
      mapping.emailIndex >= 0 && row[mapping.emailIndex] !== undefined
        ? String(row[mapping.emailIndex]).trim()
        : undefined;
    const phoneVal =
      mapping.phoneIndex >= 0 && row[mapping.phoneIndex] !== undefined
        ? String(row[mapping.phoneIndex]).trim()
        : undefined;

    // If both name and exhibitor are blank, but row has values, provide fallback
    const displayName = name || (docVal ? `Participante (${docVal})` : `Linha ${i + 1}`);
    const displayExhibitor = exhibitor || 'Geral / Outros';

    attendees.push({
      id: `row-${i + 1}`,
      rowIndex: i + 1, // 1-based index in sheet
      name: displayName,
      exhibitor: displayExhibitor,
      document: docVal,
      role: roleVal,
      stand: standVal,
      email: emailVal,
      phone: phoneVal,
      isCheckedIn,
      checkedInAt: isCheckedIn ? checkedInAt || undefined : undefined,
      rawValues: row,
    });
  }

  return {
    attendees,
    headers,
    mapping,
    totalRowsInSheet: rows.length - 1,
  };
}

/**
 * Check if a text status means checked-in
 */
export function isStatusCheckedIn(status: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s === 'sim' ||
    s === 'ok' ||
    s === 'presente' ||
    s === 'entrou' ||
    s === 'entrada realizada' ||
    s === 'check-in' ||
    s === 'checkin' ||
    s === 'checked' ||
    s === 'liberado' ||
    s === 'confirmado' ||
    s === 'true' ||
    s === '1' ||
    s === 's' ||
    s.startsWith('entrada em') ||
    s.startsWith('ok -') ||
    s.startsWith('sim ') ||
    s.startsWith('entrou ')
  );
}

/**
 * Convert 0-based column index to Sheet Column Letter (0 -> A, 1 -> B, 26 -> AA)
 */
export function columnIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Format current timestamp in Brazilian standard format: DD/MM/YYYY HH:mm:ss
 */
export function formatCurrentTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Update single attendee check-in status in Google Sheets
 */
export async function updateAttendeeStatusInSheet(
  spreadsheetId: string,
  tabName: string,
  attendee: Attendee,
  newCheckedInState: boolean,
  mapping: ColumnMapping,
  accessToken?: string
): Promise<{ timestamp: string }> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  const timestamp = newCheckedInState ? formatCurrentTimestamp() : '';
  const statusText = newCheckedInState ? 'SIM' : 'NÃO';

  const statusColLetter = columnIndexToLetter(mapping.statusIndex);
  const timeColLetter = columnIndexToLetter(mapping.timestampIndex);

  const updates: { range: string; values: string[][] }[] = [];

  updates.push({
    range: formatSheetRange(tabName, `${statusColLetter}${attendee.rowIndex}`),
    values: [[statusText]],
  });

  if (mapping.timestampIndex >= 0) {
    updates.push({
      range: formatSheetRange(tabName, `${timeColLetter}${attendee.rowIndex}`),
      values: [[timestamp]],
    });
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 401 || errData?.error?.message?.includes('insufficient')) {
      throw new Error(
        'Request had insufficient authentication scopes: O Google precisa de permissão de gravação no Google Sheets. Por favor, reconecte sua conta do Google.'
      );
    }
    throw new Error(errData?.error?.message || 'Falha ao salvar no Google Sheets');
  }

  return { timestamp };
}

/**
 * Batch update all attendees of an exhibitor
 */
export async function batchUpdateExhibitorStatusInSheet(
  spreadsheetId: string,
  tabName: string,
  attendees: Attendee[],
  newCheckedInState: boolean,
  mapping: ColumnMapping,
  accessToken?: string
): Promise<{ timestamp: string }> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  const timestamp = newCheckedInState ? formatCurrentTimestamp() : '';
  const statusText = newCheckedInState ? 'SIM' : 'NÃO';
  const statusColLetter = columnIndexToLetter(mapping.statusIndex);
  const timeColLetter = columnIndexToLetter(mapping.timestampIndex);

  const updates: { range: string; values: string[][] }[] = [];

  for (const att of attendees) {
    updates.push({
      range: formatSheetRange(tabName, `${statusColLetter}${att.rowIndex}`),
      values: [[statusText]],
    });
    if (mapping.timestampIndex >= 0) {
      updates.push({
        range: formatSheetRange(tabName, `${timeColLetter}${att.rowIndex}`),
        values: [[timestamp]],
      });
    }
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 401 || errData?.error?.message?.includes('insufficient')) {
      throw new Error(
        'Request had insufficient authentication scopes: O Google precisa de permissão de gravação no Google Sheets. Por favor, reconecte sua conta do Google.'
      );
    }
    throw new Error(errData?.error?.message || 'Falha ao atualizar grupo no Google Sheets');
  }

  return { timestamp };
}

/**
 * Add a new attendee row to Google Sheets
 */
export async function appendAttendeeToSheet(
  spreadsheetId: string,
  tabName: string,
  newAttendee: {
    name: string;
    exhibitor: string;
    document?: string;
    role?: string;
    stand?: string;
    isCheckedIn: boolean;
  },
  mapping: ColumnMapping,
  totalColumns: number,
  accessToken?: string
): Promise<{ rowIndex: number; timestamp: string }> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  const timestamp = newAttendee.isCheckedIn ? formatCurrentTimestamp() : '';
  const statusText = newAttendee.isCheckedIn ? 'SIM' : 'NÃO';

  const rowLength = Math.max(
    totalColumns,
    mapping.exhibitorIndex + 1,
    mapping.nameIndex + 1,
    mapping.statusIndex + 1,
    mapping.timestampIndex + 1,
    (mapping.documentIndex || 0) + 1,
    (mapping.roleIndex || 0) + 1,
    (mapping.standIndex || 0) + 1
  );

  const rowValues: string[] = new Array(rowLength).fill('');
  rowValues[mapping.exhibitorIndex] = newAttendee.exhibitor;
  rowValues[mapping.nameIndex] = newAttendee.name;
  if (mapping.documentIndex >= 0 && newAttendee.document) {
    rowValues[mapping.documentIndex] = newAttendee.document;
  }
  if (mapping.roleIndex >= 0 && newAttendee.role) {
    rowValues[mapping.roleIndex] = newAttendee.role;
  }
  if (mapping.standIndex >= 0 && newAttendee.stand) {
    rowValues[mapping.standIndex] = newAttendee.stand;
  }
  if (mapping.statusIndex >= 0) {
    rowValues[mapping.statusIndex] = statusText;
  }
  if (mapping.timestampIndex >= 0) {
    rowValues[mapping.timestampIndex] = timestamp;
  }

  const range = encodeURIComponent(formatSheetRange(tabName, 'A:A'));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 401 || errData?.error?.message?.includes('insufficient')) {
      throw new Error(
        'Request had insufficient authentication scopes: O Google precisa de permissão de gravação no Google Sheets. Por favor, reconecte sua conta do Google.'
      );
    }
    throw new Error(errData?.error?.message || 'Falha ao adicionar participante na planilha');
  }

  const data = await res.json();
  const updatedRange = data.updates?.updatedRange || '';
  const match = updatedRange.match(/([0-9]+):/);
  const rowIndex = match ? parseInt(match[1], 10) : 999;

  return { rowIndex, timestamp };
}

/**
 * Group flat attendees list by exhibitor
 */
export function groupAttendeesByExhibitor(attendees: Attendee[]): ExhibitorGroup[] {
  const groupMap = new Map<string, ExhibitorGroup>();

  for (const att of attendees) {
    const exhibitorKey = att.exhibitor.trim() || 'Geral / Outros';
    let group = groupMap.get(exhibitorKey);
    if (!group) {
      group = {
        name: exhibitorKey,
        stand: att.stand,
        totalAttendees: 0,
        checkedInCount: 0,
        attendees: [],
      };
      groupMap.set(exhibitorKey, group);
    }

    if (!group.stand && att.stand) {
      group.stand = att.stand;
    }

    group.totalAttendees += 1;
    if (att.isCheckedIn) {
      group.checkedInCount += 1;
    }
    group.attendees.push(att);
  }

  return Array.from(groupMap.values());
}

/**
 * Initialize sample template in empty sheet
 */
export async function seedSampleSheet(
  spreadsheetId: string,
  tabName: string,
  accessToken?: string
): Promise<void> {
  const token = accessToken || (await getAccessToken());
  if (!token) throw new Error('Não autenticado com o Google.');

  const headers = [
    'Expositor',
    'Nome do Integrante',
    'CPF/Documento',
    'Cargo / Função',
    'Estande',
    'Status Entrada',
    'Data/Hora Entrada',
  ];
  const sampleRows = [
    headers,
    ['Tech Solutions Brasil', 'Carlos Henrique Mendes', '123.456.789-00', 'Diretor Comercial', 'Estande A-12', 'NÃO', ''],
    ['Tech Solutions Brasil', 'Mariana Alcantara', '234.567.890-11', 'Gerente de Vendas', 'Estande A-12', 'NÃO', ''],
    ['Tech Solutions Brasil', 'Rafael Souza Dias', '345.678.901-22', 'Especialista Técnico', 'Estande A-12', 'NÃO', ''],
    ['Inova Agritech', 'Fernanda Lima Castro', '456.789.012-33', 'Coordenadora de Estande', 'Estande B-04', 'NÃO', ''],
    ['Inova Agritech', 'Lucas Gabriel Silva', '567.890.123-44', 'Promotor', 'Estande B-04', 'NÃO', ''],
    ['Nexus Soluções Digitais', 'Juliana Moreira', '678.901.234-55', 'CEO', 'Estande C-08', 'NÃO', ''],
    ['Nexus Soluções Digitais', 'Roberto Fontes', '789.012.345-66', 'Designer de Produto', 'Estande C-08', 'NÃO', ''],
    ['Nexus Soluções Digitais', 'Beatriz Neves', '890.123.456-77', 'Atendimento', 'Estande C-08', 'NÃO', ''],
    ['Mega Indústria Global', 'Alexandre Pires', '901.234.567-88', 'Gerente Regional', 'Estande D-01', 'NÃO', ''],
    ['Mega Indústria Global', 'Patricia Gomes', '012.345.678-99', 'Supervisora de Operações', 'Estande D-01', 'NÃO', ''],
  ];

  const range = encodeURIComponent(formatSheetRange(tabName, 'A1:G11'));
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: sampleRows,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Falha ao preencher modelo inicial na planilha');
  }
}

/**
 * Mock demo data for offline/demo testing
 */
export function getMockDemoData(): { attendees: Attendee[]; headers: string[]; mapping: ColumnMapping } {
  const sampleAttendees: Attendee[] = [
    {
      id: 'row-2',
      rowIndex: 2,
      name: 'Carlos Henrique Mendes',
      exhibitor: 'Tech Solutions Brasil',
      document: '123.456.789-00',
      role: 'Diretor Comercial',
      stand: 'A-12',
      isCheckedIn: true,
      checkedInAt: '21/08/2026 08:34:12',
      rawValues: ['Tech Solutions Brasil', 'Carlos Henrique Mendes', '123.456.789-00', 'Diretor Comercial', 'A-12', 'SIM', '21/08/2026 08:34:12'],
    },
    {
      id: 'row-3',
      rowIndex: 3,
      name: 'Mariana Alcantara',
      exhibitor: 'Tech Solutions Brasil',
      document: '234.567.890-11',
      role: 'Gerente de Vendas',
      stand: 'A-12',
      isCheckedIn: true,
      checkedInAt: '21/08/2026 08:45:00',
      rawValues: ['Tech Solutions Brasil', 'Mariana Alcantara', '234.567.890-11', 'Gerente de Vendas', 'A-12', 'SIM', '21/08/2026 08:45:00'],
    },
    {
      id: 'row-4',
      rowIndex: 4,
      name: 'Rafael Souza Dias',
      exhibitor: 'Tech Solutions Brasil',
      document: '345.678.901-22',
      role: 'Especialista Técnico',
      stand: 'A-12',
      isCheckedIn: false,
      rawValues: ['Tech Solutions Brasil', 'Rafael Souza Dias', '345.678.901-22', 'Especialista Técnico', 'A-12', 'NÃO', ''],
    },
    {
      id: 'row-5',
      rowIndex: 5,
      name: 'Fernanda Lima Castro',
      exhibitor: 'Inova Agritech',
      document: '456.789.012-33',
      role: 'Coordenadora de Estande',
      stand: 'B-04',
      isCheckedIn: true,
      checkedInAt: '21/08/2026 09:12:30',
      rawValues: ['Inova Agritech', 'Fernanda Lima Castro', '456.789.012-33', 'Coordenadora de Estande', 'B-04', 'SIM', '21/08/2026 09:12:30'],
    },
    {
      id: 'row-6',
      rowIndex: 6,
      name: 'Lucas Gabriel Silva',
      exhibitor: 'Inova Agritech',
      document: '567.890.123-44',
      role: 'Promotor',
      stand: 'B-04',
      isCheckedIn: false,
      rawValues: ['Inova Agritech', 'Lucas Gabriel Silva', '567.890.123-44', 'Promotor', 'B-04', 'NÃO', ''],
    },
    {
      id: 'row-7',
      rowIndex: 7,
      name: 'Juliana Moreira',
      exhibitor: 'Nexus Soluções Digitais',
      document: '678.901.234-55',
      role: 'CEO & Founder',
      stand: 'C-08',
      isCheckedIn: false,
      rawValues: ['Nexus Soluções Digitais', 'Juliana Moreira', '678.901.234-55', 'CEO & Founder', 'C-08', 'NÃO', ''],
    },
    {
      id: 'row-8',
      rowIndex: 8,
      name: 'Roberto Fontes',
      exhibitor: 'Nexus Soluções Digitais',
      document: '789.012.345-66',
      role: 'Designer de Produto',
      stand: 'C-08',
      isCheckedIn: false,
      rawValues: ['Nexus Soluções Digitais', 'Roberto Fontes', '789.012.345-66', 'Designer de Produto', 'C-08', 'NÃO', ''],
    },
    {
      id: 'row-9',
      rowIndex: 9,
      name: 'Beatriz Neves',
      exhibitor: 'Nexus Soluções Digitais',
      document: '890.123.456-77',
      role: 'Atendimento e Relações',
      stand: 'C-08',
      isCheckedIn: false,
      rawValues: ['Nexus Soluções Digitais', 'Beatriz Neves', '890.123.456-77', 'Atendimento e Relações', 'C-08', 'NÃO', ''],
    },
    {
      id: 'row-10',
      rowIndex: 10,
      name: 'Alexandre Pires',
      exhibitor: 'Mega Indústria Global',
      document: '901.234.567-88',
      role: 'Gerente Regional',
      stand: 'D-01',
      isCheckedIn: false,
      rawValues: ['Mega Indústria Global', 'Alexandre Pires', '901.234.567-88', 'Gerente Regional', 'D-01', 'NÃO', ''],
    },
    {
      id: 'row-11',
      rowIndex: 11,
      name: 'Patricia Gomes',
      exhibitor: 'Mega Indústria Global',
      document: '012.345.678-99',
      role: 'Supervisora de Operações',
      stand: 'D-01',
      isCheckedIn: false,
      rawValues: ['Mega Indústria Global', 'Patricia Gomes', '012.345.678-99', 'Supervisora de Operações', 'D-01', 'NÃO', ''],
    },
  ];

  return {
    attendees: sampleAttendees,
    headers: ['Expositor', 'Nome', 'Documento', 'Cargo/Tipo', 'Estande', 'Status Entrada', 'Data/Hora Entrada'],
    mapping: {
      exhibitorIndex: 0,
      nameIndex: 1,
      documentIndex: 2,
      roleIndex: 3,
      standIndex: 4,
      statusIndex: 5,
      timestampIndex: 6,
      emailIndex: -1,
      phoneIndex: -1,
    },
  };
}
