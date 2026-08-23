export type SheetRow = Record<string, any>;

export interface GoogleSheetsUrlInfo {
  id: string | null;
  gid: string | null;
}

const NAME_KEYS = ['nome', 'name', 'nome completo', 'full name', 'nome_completo', 'participante'];
const COMPANY_KEYS = ['empresa', 'company', 'org', 'organization', 'empresa_nome', 'expositor', 'marca'];
const CPF_KEYS = ['cpf', 'documento', 'doc', 'cpf_cnpj', 'cpf/cnpj', 'documento cpf', 'cpfcnpj'];

export function onlyDigits(value: any): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9));
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calcDigit(cpf.slice(0, 10));
  return d2 === Number(cpf[10]);
}

export function parseGoogleSheetsUrl(url: string): GoogleSheetsUrlInfo {
  try {
    const parsed = new URL(url.trim());
    const idMatch = parsed.pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = parsed.searchParams.get('gid') || parsed.hash.match(/gid=(\d+)/)?.[1] || null;
    return { id: idMatch ? idMatch[1] : null, gid: gidMatch };
  } catch {
    return { id: null, gid: null };
  }
}

export function getFieldValue(row: SheetRow, candidates: string[]): any {
  const normalizedEntries = Object.entries(row).map(([k, v]) => [
    k.toLowerCase().trim(),
    v,
  ]);
  for (const candidate of candidates) {
    const found = normalizedEntries.find(
      ([k]) => k === candidate || k.replace(/[\s_/-]/g, '') === candidate.replace(/[\s_/-]/g, '')
    );
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
      return found[1];
    }
  }
  // fallback: partial match
  for (const candidate of candidates) {
    const found = normalizedEntries.find(([k]) => k.includes(candidate));
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
      return found[1];
    }
  }
  return undefined;
}

export function filterValidRows(rows: SheetRow[]): SheetRow[] {
  return rows
    .filter((row) => row && typeof row === 'object')
    .filter((row) => {
      const name = String(getFieldValue(row, NAME_KEYS) ?? '').trim();
      const company = String(getFieldValue(row, COMPANY_KEYS) ?? '').trim();
      const rawCpf = String(getFieldValue(row, CPF_KEYS) ?? '').trim();
      return !!name && !!company && isValidCPF(rawCpf);
    })
    .map((row) => ({
      ...row,
      nome: String(getFieldValue(row, NAME_KEYS) ?? '').trim(),
      empresa: String(getFieldValue(row, COMPANY_KEYS) ?? '').trim(),
      cpf: onlyDigits(getFieldValue(row, CPF_KEYS)),
    }));
}

export function rowKeyCpf(row: SheetRow): string {
  return onlyDigits(getFieldValue(row, CPF_KEYS));
}

export function diffImportedRows(
  existing: SheetRow[],
  incoming: SheetRow[],
  keyFields: string[] = ['cpf']
): { existingMatches: SheetRow[]; newRows: SheetRow[] } {
  const buildKey = (row: SheetRow): string =>
    keyFields
      .map((f) =>
        f.toLowerCase() === 'cpf'
          ? rowKeyCpf(row)
          : String(getFieldValue(row, [f]) ?? '')
              .toLowerCase()
              .trim()
      )
      .join('|');

  const existingKeys = new Set(existing.map(buildKey).filter(Boolean));
  const existingMatches: SheetRow[] = [];
  const newRows: SheetRow[] = [];

  for (const row of incoming) {
    if (existingKeys.has(buildKey(row))) {
      existingMatches.push(row);
    } else {
      newRows.push(row);
    }
  }
  return { existingMatches, newRows };
}

export interface GoogleFetchResult {
  format: 'xlsx' | 'csv';
  buffer?: ArrayBuffer;
  csvText?: string;
}

export async function fetchGoogleSpreadsheet(url: string): Promise<GoogleFetchResult> {
  const { id, gid } = parseGoogleSheetsUrl(url);
  if (!id) {
    throw new Error(
      'URL do Google Sheets inválida. Cole o link completo (ex.: https://docs.google.com/spreadsheets/d/ID/...).'
    );
  }

  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;

  try {
    console.log('[googleImport] Baixando pasta de trabalho completa (XLSX):', xlsxUrl);
    const res = await fetch(xlsxUrl);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Resposta em HTML — planilha provavelmente não pública.');
    }
    const buffer = await res.arrayBuffer();
    console.log('[googleImport] XLSX baixado com sucesso (todas as abas).');
    return { format: 'xlsx', buffer };
  } catch (xlsxErr: any) {
    console.warn('[googleImport] Falha no XLSX, tentando CSV da aba:', xlsxErr?.message);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid ?? 0}`;
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Resposta em HTML — planilha provavelmente não pública.');
      }
      const csvText = await res.text();
      console.log('[googleImport] CSV da aba baixado com sucesso.');
      return { format: 'csv', csvText };
    } catch (csvErr: any) {
      console.error('[googleImport] Falha ao acessar a planilha:', csvErr);
      if (
        xlsxErr?.status === 403 ||
        csvErr?.status === 403 ||
        /Failed to fetch|NetworkError|Load failed/i.test(String(xlsxErr?.message))
      ) {
        throw new Error(
          'Não foi possível acessar a planilha diretamente. Torne-a pública (Arquivo → Publicar na web) ou use um proxy (Apps Script/Cloudflare Worker).'
        );
      }
      throw new Error(csvErr?.message || 'Erro ao buscar a planilha do Google Sheets.');
    }
  }
}
