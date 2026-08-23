import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Attendee, UserRoleId, UserProfile } from '../types';
import {
  ensureEventDate,
  getDefaultEventDate,
  normalizeEventDateInput,
} from './eventDates';

export const DEFAULT_SUPABASE_URL = 'https://myvetgtnheigkzbbhpng.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_AZ67PoB7eUWoJpYWQp_wOg_s6QpicxB';
export const DEFAULT_TABLE_NAME = 'attendees';

export const SPREADSHEET_DAY21_URL =
  'https://docs.google.com/spreadsheets/d/1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc/edit?gid=752074394#gid=752074394';
export const SPREADSHEET_DAY22_URL =
  'https://docs.google.com/spreadsheets/d/1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc/edit?gid=1403611028#gid=1403611028';
export const SPREADSHEET_URL = SPREADSHEET_DAY22_URL;

export const PROFILES: Record<UserRoleId, UserProfile> = {
  producao: {
    id: 'producao',
    name: 'Operador Produção',
    roleTitle: 'Produção de Equipe',
    badge: 'Prod. Equipe',
    avatarBg: 'bg-emerald-600',
    avatarText: 'text-emerald-50',
    description: 'Acesso pleno para validação de equipes de montagem e estandes.',
  },
  coordenacao: {
    id: 'coordenacao',
    name: 'Coord. Geral',
    roleTitle: 'Coordenação de Equipe',
    badge: 'Coordenação',
    avatarBg: 'bg-indigo-600',
    avatarText: 'text-indigo-50',
    description: 'Supervisão de fluxo, liberação coletiva e auditoria em tempo real.',
  },
  recepcao: {
    id: 'recepcao',
    name: 'Portaria & Cortesia',
    roleTitle: 'Recepção (Ingressos Gratuitos)',
    badge: 'Cortesia & Recepção',
    avatarBg: 'bg-pink-600',
    avatarText: 'text-pink-50',
    description: 'Validação rápida de convidados, cortesias e credenciados VIP.',
  },
};

const STORAGE_KEY_CONFIG = 'access_control_supabase_cfg';
const STORAGE_KEY_PENDING_QUEUE = 'access_control_supabase_pending_queue_v3';

export interface SupabaseConfig {
  url: string;
  key: string;
  table: string;
}

export function getActiveSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.key) {
        return {
          url: parsed.url,
          key: parsed.key,
          table: parsed.table || DEFAULT_TABLE_NAME,
        };
      }
    }
  } catch (_) {}
  return {
    url: DEFAULT_SUPABASE_URL,
    key: DEFAULT_SUPABASE_ANON_KEY,
    table: DEFAULT_TABLE_NAME,
  };
}

export function saveCustomSupabaseConfig(url: string, key: string, table: string = DEFAULT_TABLE_NAME) {
  localStorage.setItem(
    STORAGE_KEY_CONFIG,
    JSON.stringify({ url: url.trim(), key: key.trim(), table: table.trim() })
  );
}

export function resetSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_CONFIG);
}

export let supabase: SupabaseClient = createClient(
  getActiveSupabaseConfig().url,
  getActiveSupabaseConfig().key,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  }
);

export function reinitializeSupabaseClient(): SupabaseClient {
  const cfg = getActiveSupabaseConfig();
  supabase = createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  });
  return supabase;
}

// ============================================================
// CONFIGURAÇÃO COMPARTILHADA (tabela public.app_config)
// Guarda, por exemplo, o link do Google Sheets usado na
// sincronização, para ninguém precisar redigitar.
// ============================================================
const APP_CONFIG_KEY_SHEET_URL = 'google_sheet_url';

export interface SheetSyncConfig {
  sheetUrl: string;
  updatedBy?: string;
  updatedAt?: string;
}

function isMissingRelationError(message: string): boolean {
  return /does not exist|relation .* was not found|schema cache/i.test(message);
}

export async function fetchSheetConfigFromSupabase(): Promise<SheetSyncConfig | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value, updated_by, updated_at')
      .eq('key', APP_CONFIG_KEY_SHEET_URL)
      .maybeSingle();

    if (error) {
      console.warn(
        `[app_config] Leitura indisponível${isMissingRelationError(error.message) ? ' (tabela app_config ainda não criada)' : ''}:`,
        error.message
      );
      return null;
    }
    if (!data || !data.value) return null;

    return {
      sheetUrl: String(data.value),
      updatedBy: data.updated_by || undefined,
      updatedAt: data.updated_at || undefined,
    };
  } catch (err: any) {
    console.warn('[app_config] Falha ao ler configuração:', err?.message);
    return null;
  }
}

export async function saveSheetConfigToSupabase(
  sheetUrl: string,
  updatedBy?: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await supabase.from('app_config').upsert(
      {
        key: APP_CONFIG_KEY_SHEET_URL,
        value: sheetUrl.trim(),
        updated_by: updatedBy?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error('[app_config] Falha ao salvar:', error.message);
      return {
        ok: false,
        message: isMissingRelationError(error.message)
          ? 'Tabela app_config não existe ainda. Rode o SQL da aba "Criar Tabela".'
          : error.message,
      };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[app_config] Exceção ao salvar:', err?.message);
    return { ok: false, message: err?.message || 'Erro inesperado ao salvar.' };
  }
}

// 86 attendees for Day 21 (21/08 - Sexta)
export const DATASET_DAY_21 = [
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Elen R. Vieira",
    "cpf": "280.618.768-09",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Wellington José De Melo Vieira",
    "cpf": "284.113.228-58",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Pedro Riccomi Vieira",
    "cpf": "497.094.098-32",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Marilia Braga Talarico",
    "cpf": "285.691.768-21",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Ingrid Eliza Fischer",
    "cpf": "024.440.479-82",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Paloma Vilhena",
    "cpf": "334.935.048-88",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Luciana Bertachi Zamora",
    "cpf": "292.198.608-64",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Camila Riccomi Vieira",
    "cpf": "497.095.138-18",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "21/08",
    "name": "Sophia Augusto Murakawa",
    "cpf": "491.354.428-40",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Miguel de Souza Oliveira",
    "cpf": "471.663.828-64",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Yasmin de Souza Maciel Cruz",
    "cpf": "533.409.008-84",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Edgar Vieira de Souza",
    "cpf": "492.669.368-20",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Gabriela Vieira de Souza",
    "cpf": "513.655.758-37",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Sérgio Pereira do Nascimento",
    "cpf": "419.702.328-62",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Thamara de Sousa Santos",
    "cpf": "535.659.818-14",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Marina Belo Tenório da Conceição",
    "cpf": "367.947.098-30",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Renata de Almeida Freitas Cruz",
    "cpf": "345.275.848-63",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Danielle Lima de Andrade Franzolin",
    "cpf": "298.051.788-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "JAKINHA",
    "date": "21/08",
    "name": "Thiago Belo Tenório da Conceição",
    "cpf": "337.121.358-74",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Ricardo Alexandre Rosa da Silva",
    "cpf": "255.900.558-14",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Danielle Jorge Sousa",
    "cpf": "944.706.002-10",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Neilma Souza Gonçalves",
    "cpf": "365.092.678-45",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Deiziele Gomes da Silva",
    "cpf": "404.013.238-62",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Vanessa F Diniz",
    "cpf": "328.410.888-20",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Rinaldi Belfi",
    "cpf": "111.949.008-10",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "RoseIlda Lima Duarte",
    "cpf": "146.820.778-48",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MONDURY",
    "date": "21/08",
    "name": "Neide Francisca Barbosa",
    "cpf": "107.471.738-42",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DO MATOS",
    "date": "21/08",
    "name": "Luciene Silva dos Reis",
    "cpf": "394.505.588-17",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DO MATOS",
    "date": "21/08",
    "name": "Tatiane Karyn Brito Burgers",
    "cpf": "349.951.268-80",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DO MATOS",
    "date": "21/08",
    "name": "Dinah Ferreira de Santana",
    "cpf": "277.186.198-42",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DO MATOS",
    "date": "21/08",
    "name": "Kecio Machado de Santana",
    "cpf": "170.900.618-84",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Rebecca Alves dos Santos Gomes",
    "cpf": "401.972.338-99",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Leonardo Pereira Motoso",
    "cpf": "389.911.168-09",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Davi Alves de França",
    "cpf": "492.395.298-96",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Laura Alves Motoso",
    "cpf": "541.009.668-14",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Sabrina Patricio Costa",
    "cpf": "392.302.868-77",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Thais Francois",
    "cpf": "396.909.848-37",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Marcos Kiyoshi Nagaishi",
    "cpf": "356.982.468-31",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCE",
    "date": "21/08",
    "name": "Aline Sakis Barbosa",
    "cpf": "374.156.778-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "CONITO DOCES",
    "date": "21/08",
    "name": "Lucas Riccomi Vieira",
    "cpf": "497.093.848-21",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "CONITO DOCES",
    "date": "21/08",
    "name": "Bárbara Gomes Alves",
    "cpf": "426.284.568-00",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "CONITO DOCES",
    "date": "21/08",
    "name": "Letícia Oliveira",
    "cpf": "442.348.678-45",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "CONITO DOCES",
    "date": "21/08",
    "name": "Adriana Faza",
    "cpf": "135.273.518-09",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Lucas da Cruz Pereira",
    "cpf": "508.278.568-06",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Deuzilene Almeida Camara",
    "cpf": "603.333.783-26",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Elvira Pereira da Silva",
    "cpf": "106.122.428-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Romilda de Freitas Gondim Moura",
    "cpf": "111.758.258-24",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Willians Araújo Moura",
    "cpf": "125.221.978-43",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Roseli de Freitas Gondim Micarelli",
    "cpf": "111.758.288-40",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Maria Lindinalva Rosa",
    "cpf": "144.262.098-62",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Sandra Helena F. Sena Santos",
    "cpf": "144.246.888-28",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Renata de Almeida Freitas Cruz",
    "cpf": "345.275.848-63",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RECANTO MAGINI",
    "date": "21/08",
    "name": "Danielle Lima de Andrade Franzolin",
    "cpf": "298.051.788-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Milena de Jesus Bicudo Silva",
    "cpf": "541.020.768-83",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Solange Silva dos Santos",
    "cpf": "312.183.988-84",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Roberta Jesus Bicudo Silva",
    "cpf": "223.719.388-66",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Viviane Moreira da Silva",
    "cpf": "362.841.998-05",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Éric Scatine Ferreira",
    "cpf": "507.297.078-73",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SAIMON BROWN",
    "date": "21/08",
    "name": "Ana Paula dos Santos Carvalho",
    "cpf": "053.961.882-94",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "QUILOMBO DOCES",
    "date": "21/08",
    "name": "Carl Lewis Ambrosio Alberto",
    "cpf": "392.869.558-47",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MACONDO CHOCOLATES",
    "date": "21/08",
    "name": "Henrique Falsoni Constâncio",
    "cpf": "427.028.838-85",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MACONDO CHOCOLATES",
    "date": "21/08",
    "name": "Fernando Galeski Nonose",
    "cpf": "095.831.279-65",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MACONDO CHOCOLATES",
    "date": "21/08",
    "name": "Yasmin Yumi Miyashiro",
    "cpf": "436.535.468-00",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MACONDO CHOCOLATES",
    "date": "21/08",
    "name": "Luiz Felipe Mastropietro",
    "cpf": "419.101.198-73",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMICIA BOLOS DE ROLO",
    "date": "21/08",
    "name": "Sophia Araujo Yokoyama",
    "cpf": "506.773.948-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMICIA BOLOS DE ROLO",
    "date": "21/08",
    "name": "Lanna Lucas Rodrigues de Souza",
    "cpf": "484.281.568-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMICIA BOLOS DE ROLO",
    "date": "21/08",
    "name": "Maite Lozano Barbosa",
    "cpf": "414.861.828-01",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMICIA BOLOS DE ROLO",
    "date": "21/08",
    "name": "Joana Gomes Rios Cavalcante",
    "cpf": "519.197.388-78",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "21/08",
    "name": "Audeni de Matos Melo",
    "cpf": "380.200.728-02",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "21/08",
    "name": "Elaine Lopes da Cruz",
    "cpf": "416.264.088-23",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "21/08",
    "name": "Danielle Cristina Alves Pereira",
    "cpf": "354.159.358-00",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "21/08",
    "name": "Fernando da Silva Gonçalves",
    "cpf": "460.825.118-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "AMOR DE GELEIA",
    "date": "21/08",
    "name": "Fabielli Passarella Bonaldi",
    "cpf": "372.278.088-82",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "AMOR DE GELEIA",
    "date": "21/08",
    "name": "Flávia Passarella Bonaldi",
    "cpf": "372.278.098-54",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "AMOR DE GELEIA",
    "date": "21/08",
    "name": "Karoline Rodrigues",
    "cpf": "429.517.288-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RAMOS DO CACAU",
    "date": "21/08",
    "name": "Elisama Silverio dos Santos",
    "cpf": "383.677.368-69",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RAMOS DO CACAU",
    "date": "21/08",
    "name": "Eder José de Queiroz",
    "cpf": "323.287.638-20",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RAMOS DO CACAU",
    "date": "21/08",
    "name": "Tatiane Souza Santos",
    "cpf": "390.333.588-67",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "RAMOS DO CACAU",
    "date": "21/08",
    "name": "Tamires Souza Santos",
    "cpf": "512.355.998-17",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "21/08",
    "name": "Pamela Drigo",
    "cpf": "387.484.678-47",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "21/08",
    "name": "Emily Barboza de Oliveira",
    "cpf": "335.960.748-19",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "21/08",
    "name": "Alexandre Yoshiraro Massuda",
    "cpf": "263.082.458-60",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "21/08",
    "name": "Carla Maia",
    "cpf": "387.478.768-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "FLOQUINHO DOCES",
    "date": "21/08",
    "name": "Isabella Dias Miguel",
    "cpf": "518.850.908-38",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "FLOQUINHO DOCES",
    "date": "21/08",
    "name": "Jhonny Silvino da Conceição",
    "cpf": "310.783.858-66",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "FLOQUINHO DOCES",
    "date": "21/08",
    "name": "Michele Martins Niculau Silvino",
    "cpf": "225.562.728-05",
    "status": "Pendente",
    "entryTime": ""
  }
];

// 33 attendees for Day 22 (22/08 - Sábado)
export const DATASET_DAY_22 = [
  {
    "exhibitor": "SABOR&CORAÇÃO",
    "date": "22/08",
    "name": "Clovis Correa Gradici",
    "cpf": "313.589.728-18",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SABOR&CORAÇÃO",
    "date": "22/08",
    "name": "Sara Silva Gradici",
    "cpf": "483.074.028-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SABOR&CORAÇÃO",
    "date": "22/08",
    "name": "Samuel Silva Gradici",
    "cpf": "497.450.308-13",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SABOR&CORAÇÃO",
    "date": "22/08",
    "name": "Alexandro Anthony Ferreira",
    "cpf": "449.617.268-26",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "SABOR&CORAÇÃO",
    "date": "22/08",
    "name": "Emanuel Macedo",
    "cpf": "287.183.008-80",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "22/08",
    "name": "Jeanne Kretzschmar",
    "cpf": "090.463.698-46",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "22/08",
    "name": "Sergio Augusto Bozzo",
    "cpf": "082.800.428-57",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "22/08",
    "name": "Elaine Vital Marciano",
    "cpf": "295.345.798-40",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "22/08",
    "name": "Fernanda Bino",
    "cpf": "278.404.698-25",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "DIDONE",
    "date": "22/08",
    "name": "Paulo Cesar Marciano",
    "cpf": "205.357.768-10",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Zilene Dias Chagas",
    "cpf": "153.135.303-72",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Michele Rocha Chaves",
    "cpf": "386.446.338-64",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Vithória Guerra Felipe",
    "cpf": "470.671.308-08",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Poliana Procópio",
    "cpf": "010.809.065-50",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Thiago Zacarias Fernandes Pereira",
    "cpf": "354.610.968-67",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "MARIA TERRA",
    "date": "22/08",
    "name": "Diego Martins de Novaes",
    "cpf": "403.941.068-81",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Danielle de Souza Salve",
    "cpf": "376.022.808-90",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Gustavo Rego",
    "cpf": "360.877.868-30",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Rebecca Alves dos Santos Gomes",
    "cpf": "401.972.338-99",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Leonardo Pereira Motoso",
    "cpf": "389.911.168-09",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Davi Alves de França",
    "cpf": "492.395.298-96",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "ERA UMA VEZ DOCES",
    "date": "22/08",
    "name": "Laura Alves Motoso",
    "cpf": "541.009.668-14",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMÍCIA BOLOS",
    "date": "22/08",
    "name": "Joana Gomes Rios Cavalcante",
    "cpf": "519.197.388-78",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMÍCIA BOLOS",
    "date": "22/08",
    "name": "Sophia Araújo Yokoyama",
    "cpf": "506.773.948-70",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "PRIMÍCIA BOLOS",
    "date": "22/08",
    "name": "Maitê Lozano Barbosa",
    "cpf": "414.861.828-01",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Henrique Sanchez",
    "cpf": "417.473.228-06",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Paula Antoniade Inglez",
    "cpf": "332.236.838-60",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Letícia Barbosa dos Santos",
    "cpf": "412.120.808-07",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Guilherme Ribas Cezar",
    "cpf": "366.230.048-66",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "José Rafael Felipe da Silva",
    "cpf": "414.562.798-90",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Bruno Alves dos Santos",
    "cpf": "403.682.958-00",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Renzo Zamparini",
    "cpf": "181.344.778-01",
    "status": "Pendente",
    "entryTime": ""
  },
  {
    "exhibitor": "COZINHA VALENTINO",
    "date": "22/08",
    "name": "Ricardo Zanin",
    "cpf": "293.918.468-23",
    "status": "Pendente",
    "entryTime": ""
  }
];

// Combined official dataset (119 attendees total)
export const INITIAL_DATASET_RAW = [
  ...DATASET_DAY_21.map((item, idx) => ({
    ...item,
    id: 'att-21-' + (idx + 1),
    legacyId: 'att-' + (idx + 1),
    rowIndex: idx + 2,
  })),
  ...DATASET_DAY_22.map((item, idx) => ({
    ...item,
    id: 'att-22-' + (idx + 1),
    legacyId: 'att-d22-' + (idx + 1),
    rowIndex: idx + 2,
  })),
];

function normalizeString(str: any): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseIsCheckedIn(item: any): boolean {
  if (!item) return false;

  // 1. Direct boolean flags
  if (
    item.is_checked_in === true ||
    item.isCheckedIn === true ||
    item.liberado === true ||
    item.checked_in === true ||
    item.checkin === true
  ) {
    return true;
  }

  // 2. String boolean representations
  const stringBooleans = ['true', 't', '1', 'sim', 's', 'yes', 'y'];
  if (stringBooleans.includes(String(item.is_checked_in ?? '').toLowerCase().trim())) return true;
  if (stringBooleans.includes(String(item.liberado ?? '').toLowerCase().trim())) return true;
  if (stringBooleans.includes(String(item.checked_in ?? '').toLowerCase().trim())) return true;
  if (stringBooleans.includes(String(item.checkin ?? '').toLowerCase().trim())) return true;

  // 3. Status strings (case-insensitive & accent-insensitive)
  const rawStatus = normalizeString(
    item.status ||
    item.situacao ||
    item.estado ||
    item.liberacao ||
    item.validacao ||
    ''
  );

  const checkedStatuses = [
    'entrou',
    'liberado',
    'liberada',
    'presente',
    'ok',
    'confirmado',
    'confirmada',
    'check-in',
    'checkin',
    'validado',
    'validada',
    'autorizado',
    'autorizada',
    'pago',
    'paga',
    '1',
    'true',
    'sim',
  ];

  if (checkedStatuses.includes(rawStatus)) {
    return true;
  }

  // 4. If entry time is specified and non-empty
  const timeVal =
    item.entry_time ||
    item.entryTime ||
    item.horario_entrada ||
    item.horario ||
    item.hora ||
    item.hora_entrada ||
    item.data_hora_entrada ||
    item.checked_in_at ||
    item.checkedInAt;

  if (
    timeVal &&
    String(timeVal).trim().length > 0 &&
    String(timeVal).trim() !== 'null' &&
    String(timeVal).trim() !== 'undefined'
  ) {
    return true;
  }

  return false;
}

function parseDateValue(item: any): string {
  const rawDate =
    item.date ||
    item.data ||
    item.dia ||
    item.data_evento ||
    item.event_date ||
    '';

  const dateStr = normalizeEventDateInput(String(rawDate).trim());
  if (dateStr.length === 5) return ensureEventDate(dateStr, getDefaultEventDate());

  const idStr = String(item.id || '');
  const idDateMatch = idStr.match(/^att-(\d{2})-(\d{2})-/);
  if (idDateMatch) return ensureEventDate(`${idDateMatch[1]}/${idDateMatch[2]}`, getDefaultEventDate());
  if (/^att-21-/.test(idStr) || /^att-d21-/.test(idStr)) return '21/08';
  if (/^att-22-/.test(idStr) || /^att-d22-/.test(idStr)) return '22/08';

  return getDefaultEventDate();
}

export function mapRawToAttendee(item: any, index: number): Attendee {
  const isCheckedIn = parseIsCheckedIn(item);
  const dateVal = parseDateValue(item);

  const nameVal =
    item.name ||
    item.nome ||
    item.participante ||
    item.credenciado ||
    item.nome_completo ||
    'Sem Nome';

  const exhibitorVal =
    item.exhibitor ||
    item.expositor ||
    item.empresa ||
    item.stand ||
    item.estande ||
    'Sem Empresa';

  const docVal =
    item.cpf ||
    item.document ||
    item.documento ||
    item.doc ||
    '';

  const entryTimeVal =
    item.entry_time ||
    item.entryTime ||
    item.horario_entrada ||
    item.horario ||
    item.hora ||
    item.hora_entrada ||
    item.checked_in_at ||
    item.checkedInAt ||
    (isCheckedIn ? 'Registrado' : undefined);

  const checkedByVal =
    item.checked_by ||
    item.checkedBy ||
    item.operador ||
    item.responsavel ||
    undefined;

  return {
    id: String(item.id || 'att-' + (index + 1)),
    rowIndex: item.rowIndex || index + 2,
    date: dateVal,
    name: nameVal,
    exhibitor: exhibitorVal,
    document: docVal,
    role: item.role || item.cargo || 'Credenciado',
    stand: item.stand || item.estande || '',
    isCheckedIn,
    checkedInAt: isCheckedIn ? String(entryTimeVal) : undefined,
    checkedBy: isCheckedIn ? checkedByVal : undefined,
    notes: item.notes || item.observacoes || undefined,
    rawValues: [
      exhibitorVal,
      dateVal,
      nameVal,
      docVal,
      isCheckedIn ? 'Entrou' : 'Pendente',
      isCheckedIn ? String(entryTimeVal) : '',
    ],
  };
}

function getPendingQueue(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function addToPendingQueue(item: any) {
  try {
    const q = getPendingQueue();
    const filtered = q.filter((x: any) => x.id !== item.id);
    filtered.push(item);
    localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(filtered));
  } catch (_) {}
}

function clearPendingQueue() {
  localStorage.removeItem(STORAGE_KEY_PENDING_QUEUE);
}

export async function flushPendingQueue(): Promise<number> {
  const queue = getPendingQueue();
  if (queue.length === 0) return 0;

  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  try {
    const { error } = await client.from(table).upsert(queue, { onConflict: 'id' });
    if (!error) {
      clearPendingQueue();
      return queue.length;
    }
  } catch (_) {}
  return 0;
}

/**
 * Fetch attendees from Supabase table non-destructively.
 * Ensures existing check-ins (e.g. from Day 21) are NEVER overwritten.
 */
export async function fetchAttendeesFromSupabase(): Promise<{
  attendees: Attendee[];
  tableMissing?: boolean;
  error?: string;
}> {
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  await flushPendingQueue();

  try {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Supabase query error:', error.message);
      const isMissing =
        error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist');
      return { attendees: [], tableMissing: isMissing, error: error.message };
    }

    if (!data || data.length === 0) {
      return { attendees: [], tableMissing: false };
    }

    const attendees = (data || []).map((row: any, idx: number) =>
      mapRawToAttendee(row, idx)
    );
    return { attendees, tableMissing: false };
  } catch (err: any) {
    console.error('Supabase fetch exception:', err);
    return { attendees: [], error: err.message };
  }
}

/**
 * Update single attendee check-in status in Supabase.
 */
export async function updateAttendeeInSupabase(
  attendee: Attendee,
  isCheckedIn: boolean,
  paramA?: UserProfile | string,
  paramB?: string
): Promise<{ success: boolean; error?: string }> {
  let operatorStr = 'Portaria';
  let timeStr: string | null = null;

  if (typeof paramA === 'object' && paramA !== null) {
    operatorStr = paramA.roleTitle || paramA.badge || paramA.name || 'Portaria';
    timeStr = paramB || null;
  } else if (typeof paramA === 'string') {
    if (paramA.includes(':')) {
      // paramA is a time string
      timeStr = paramA;
      operatorStr = paramB || 'Portaria';
    } else {
      operatorStr = paramA;
      timeStr = paramB || null;
    }
  }

  if (isCheckedIn && !timeStr) {
    timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (!isCheckedIn) {
    timeStr = null;
  }

  const statusStr = isCheckedIn ? 'Entrou' : 'Pendente';

  const payload = {
    id: attendee.id,
    name: attendee.name,
    exhibitor: attendee.exhibitor,
    cpf: attendee.document?.trim() || null,
    date: ensureEventDate(attendee.date, getDefaultEventDate()),
    is_checked_in: isCheckedIn,
    status: statusStr,
    entry_time: timeStr,
    checked_by: operatorStr,
    updated_at: new Date().toISOString(),
  };

  // 2. Persist to Supabase
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  try {
    const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase update note, added to retry queue:', error.message);
      addToPendingQueue(payload);
      return { success: false, error: error.message };
    }

    // Optional audit log insertion
    try {
      await client.from('checkin_logs').insert({
        attendee_id: attendee.id,
        name: attendee.name,
        exhibitor: attendee.exhibitor,
        action: isCheckedIn ? 'CHECK_IN' : 'CHECK_OUT',
        status: statusStr,
        entry_time: timeStr,
        operator: operatorStr,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}

    return { success: true };
  } catch (err: any) {
    addToPendingQueue(payload);
    return { success: false, error: err.message };
  }
}

/**
 * Batch update check-in status for an entire exhibitor team
 */
export async function batchUpdateExhibitorInSupabase(
  attendees: Attendee[],
  isCheckedIn: boolean,
  operatorOrProfile?: UserProfile | string,
  explicitTime?: string
): Promise<{ success: boolean; error?: string }> {
  const operatorStr =
    typeof operatorOrProfile === 'string'
      ? operatorOrProfile
      : operatorOrProfile?.roleTitle || 'Coordenação';

  const timeStr = isCheckedIn
    ? explicitTime ||
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const statusStr = isCheckedIn ? 'Entrou' : 'Pendente';

  // Persist to Supabase
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  const updates = attendees.map((a) => ({
    id: a.id,
    name: a.name,
    exhibitor: a.exhibitor,
    cpf: a.document?.trim() || null,
    date: ensureEventDate(a.date, getDefaultEventDate()),
    is_checked_in: isCheckedIn,
    status: statusStr,
    entry_time: timeStr,
    checked_by: operatorStr,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await client.from(table).upsert(updates, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase batch note:', error.message);
      updates.forEach((u) => addToPendingQueue(u));
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    updates.forEach((u) => addToPendingQueue(u));
    return { success: false, error: err.message };
  }
}

/**
 * Specifically records Day 22 attendees into Supabase WITHOUT overwriting Day 21 data.
 * Checks for existing IDs in Supabase and only inserts missing records.
 */
export async function recordDay22ToSupabase(
  customList?: Attendee[]
): Promise<{ success: boolean; insertedCount: number; existingCount: number; error?: string }> {
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  try {
    const { data: existingRows } = await client.from(table).select('id, cpf, name, is_checked_in, entry_time');

    const existingIds = new Set<string>((existingRows || []).map((r: any) => String(r.id)));
    const existingCpfs = new Set<string>((existingRows || []).map((r: any) => String(r.cpf || '').trim()).filter(Boolean));

    const day22Attendees = (customList || INITIAL_DATASET_RAW).filter(
      (a: any) => a.date === '22/08' || String(a.id || '').startsWith('att-22-') || String(a.id || '').includes('d22')
    );

    const recordsToInsert: any[] = [];
    let alreadyExists = 0;

    day22Attendees.forEach((a: any) => {
      const doc = (a.document || a.cpf || '').trim();
      if (existingIds.has(a.id) || (doc && existingCpfs.has(doc))) {
        alreadyExists++;
      } else {
        const isChecked = Boolean(a.isCheckedIn || a.is_checked_in);
        recordsToInsert.push({
          id: a.id,
          name: a.name,
          exhibitor: a.exhibitor,
          cpf: doc,
          date: '22/08',
          is_checked_in: isChecked,
          status: isChecked ? 'Entrou' : 'Pendente',
          entry_time: a.checkedInAt || a.entry_time || null,
          checked_by: a.checkedBy || a.checked_by || null,
          updated_at: new Date().toISOString(),
        });
      }
    });

    if (recordsToInsert.length > 0) {
      const { error: insertError } = await client.from(table).upsert(recordsToInsert, { onConflict: 'id' });
      if (insertError) {
        return { success: false, insertedCount: 0, existingCount: alreadyExists, error: insertError.message };
      }
    }

    return {
      success: true,
      insertedCount: recordsToInsert.length,
      existingCount: alreadyExists,
    };
  } catch (err: any) {
    return { success: false, insertedCount: 0, existingCount: 0, error: err.message };
  }
}

/**
 * Save / Sync all attendees non-destructively to Supabase.
 */
export async function syncAllAttendeesToSupabase(
  customList?: Attendee[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const listToSync = customList && customList.length > 0 ? customList : [];
  if (listToSync.length === 0) {
    return { success: false, count: 0, error: 'Nenhuma lista fornecida para sincronizar.' };
  }
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  const records = listToSync.map((a) => ({
    id: a.id,
    name: a.name,
    exhibitor: a.exhibitor,
    cpf: a.document?.trim() || null,
    date: ensureEventDate(a.date, getDefaultEventDate()),
    is_checked_in: Boolean(a.isCheckedIn),
    status: a.isCheckedIn ? 'Entrou' : 'Pendente',
    entry_time: a.checkedInAt || null,
    checked_by: a.checkedBy || null,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await client.from(table).upsert(records, { onConflict: 'id' });
    if (error) {
      return { success: false, count: 0, error: error.message };
    }
    clearPendingQueue();
    return { success: true, count: records.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Non-destructive initial seed: Preserves any check-ins already done today!
 */
export async function seedInitialDatasetToSupabase(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  try {
    const { data: existingData } = await client.from(table).select('*');
    const existingMap = new Map<string, any>((existingData || []).map((x: any) => [String(x.id), x]));

    const records = INITIAL_DATASET_RAW.map((r) => {
      const existing = existingMap.get(r.id) || (r.legacyId ? existingMap.get(r.legacyId) : undefined);
      return {
        id: r.id,
        name: r.name,
        exhibitor: r.exhibitor,
        cpf: r.cpf?.trim() || null,
        date: ensureEventDate(r.date, getDefaultEventDate()),
        is_checked_in: existing ? existing.is_checked_in : false,
        status: existing ? existing.status : 'Pendente',
        entry_time: existing ? existing.entry_time : null,
        checked_by: existing ? existing.checked_by : null,
        updated_at: existing ? existing.updated_at : new Date().toISOString(),
      };
    });

    const { error } = await client.from(table).upsert(records, { onConflict: 'id' });

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: records.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Add or Update an attendee in Supabase safely with fallback for table column differences
 */
export async function saveOrUpdateAttendeeInSupabase(
  attData: {
    id?: string;
    name: string;
    exhibitor: string;
    document?: string;
    role?: string;
    stand?: string;
    date?: string;
    isCheckedIn: boolean;
  },
  operatorTitle: string = 'Portaria'
): Promise<{ success: boolean; attendee: Attendee; error?: string }> {
  const dateStr = ensureEventDate(attData.date, getDefaultEventDate());
  const isEditing = Boolean(attData.id);
  const targetId = attData.id || `att-${dateStr.replace('/', '-')}-m-${Date.now()}`;

  const nowTime = attData.isCheckedIn
    ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : undefined;

  const attendeeObj: Attendee = {
    id: targetId,
    rowIndex: 0,
    name: attData.name,
    exhibitor: attData.exhibitor,
    document: attData.document || '',
    role: attData.role || 'Credenciado',
    stand: attData.stand || '',
    date: dateStr,
    isCheckedIn: attData.isCheckedIn,
    checkedInAt: attData.isCheckedIn ? nowTime : undefined,
    checkedBy: attData.isCheckedIn ? operatorTitle : undefined,
    rawValues: [
      attData.exhibitor,
      dateStr,
      attData.name,
      attData.document || '',
      attData.isCheckedIn ? 'Entrou' : 'Pendente',
      attData.isCheckedIn ? nowTime || '' : '',
    ],
  };

  // Prepare Supabase payload
  const { table } = getActiveSupabaseConfig();
  const client = reinitializeSupabaseClient();

  const payloadWithDate: any = {
    id: targetId,
    name: attData.name,
    exhibitor: attData.exhibitor,
    cpf: attData.document?.trim() || null,
    date: dateStr,
    is_checked_in: Boolean(attData.isCheckedIn),
    status: attData.isCheckedIn ? 'Entrou' : 'Pendente',
    entry_time: attData.isCheckedIn ? nowTime || null : null,
    checked_by: attData.isCheckedIn ? operatorTitle : null,
    updated_at: new Date().toISOString(),
  };

  if (!isEditing) {
    payloadWithDate.created_at = new Date().toISOString();
  }

  try {
    const { error: upsertErr } = await client.from(table).upsert(payloadWithDate, { onConflict: 'id' });

    if (upsertErr) {
      // If error is about missing "date" column, retry without the date column!
      if (
        upsertErr.message.includes('date') ||
        upsertErr.message.includes('column "date"') ||
        upsertErr.code === '42703'
      ) {
        const { date: _, ...payloadWithoutDate } = payloadWithDate;
        const { error: retryErr } = await client.from(table).upsert(payloadWithoutDate, { onConflict: 'id' });
        if (retryErr) {
          console.warn('Supabase retry without date error:', retryErr.message);
          addToPendingQueue(payloadWithoutDate);
          return { success: false, attendee: attendeeObj, error: retryErr.message };
        }
        return { success: true, attendee: attendeeObj };
      }

      console.warn('Supabase upsert error:', upsertErr.message);
      addToPendingQueue(payloadWithDate);
      return { success: false, attendee: attendeeObj, error: upsertErr.message };
    }

    return { success: true, attendee: attendeeObj };
  } catch (err: any) {
    addToPendingQueue(payloadWithDate);
    return { success: false, attendee: attendeeObj, error: err.message };
  }
}

/**
 * Add a new manual attendee to Supabase
 */
export async function addAttendeeToSupabase(
  newAtt: Omit<Attendee, 'id' | 'rowIndex' | 'rawValues'>,
  operatorTitle: string = 'Portaria'
): Promise<{ success: boolean; error?: string }> {
  const res = await saveOrUpdateAttendeeInSupabase(
    {
      name: newAtt.name,
      exhibitor: newAtt.exhibitor,
      document: newAtt.document,
      role: newAtt.role,
      stand: newAtt.stand,
        date: ensureEventDate(newAtt.date, getDefaultEventDate()),
      isCheckedIn: Boolean(newAtt.isCheckedIn),
    },
    operatorTitle
  );
  return { success: res.success, error: res.error };
}

/**
 * SQL script for creating the table in Supabase
 */
export const SUPABASE_SQL_CREATION_SCRIPT = `
-- ==========================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS NO SUPABASE (SQL EDITOR)
-- Acesse: https://supabase.com/dashboard/project/myvetgtnheigkzbbhpng/sql/new
-- ==========================================================

-- 1. TABELA PRINCIPAL DE CREDENCIADOS E STATUS DE CHECK-IN
CREATE TABLE IF NOT EXISTS public.attendees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exhibitor TEXT NOT NULL,
  cpf TEXT,
  date TEXT DEFAULT '21/08',
  is_checked_in BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pendente',
  entry_time TEXT,
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.1 CPF ÚNICO POR DIA (impede credenciado duplicado no mesmo dia)
ALTER TABLE public.attendees DROP CONSTRAINT IF EXISTS attendees_cpf_date_unique;
CREATE UNIQUE INDEX IF NOT EXISTS attendees_cpf_date_unique
  ON public.attendees (cpf, date)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';

-- 2. TABELA DE AUDITORIA DE CHECK-INS / RELATÓRIO HISTÓRICO
CREATE TABLE IF NOT EXISTS public.checkin_logs (
  id BIGSERIAL PRIMARY KEY,
  attendee_id TEXT,
  name TEXT,
  exhibitor TEXT,
  action TEXT,
  status TEXT,
  entry_time TEXT,
  operator TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HABILITAR ROW LEVEL SECURITY (RLS) E LIBERAR ACESSO DA PORTARIA
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read attendees"
  ON public.attendees FOR SELECT USING (true);

CREATE POLICY "Allow public insert attendees"
  ON public.attendees FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update attendees"
  ON public.attendees FOR UPDATE USING (true);

CREATE POLICY "Allow public read checkin_logs"
  ON public.checkin_logs FOR SELECT USING (true);

CREATE POLICY "Allow public insert checkin_logs"
  ON public.checkin_logs FOR INSERT WITH CHECK (true);

-- 4. HABILITAR SINCRONIZAÇÃO EM TEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendees;

-- 5. TABELA DE CONFIGURAÇÃO COMPARTILHADA (chave/valor)
-- Guarda o link do Google Sheets da sincronização, entre outros.
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_config" ON public.app_config;
CREATE POLICY "Allow public read app_config"
  ON public.app_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert app_config" ON public.app_config;
CREATE POLICY "Allow public insert app_config"
  ON public.app_config FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update app_config" ON public.app_config;
CREATE POLICY "Allow public update app_config"
  ON public.app_config FOR UPDATE USING (true);
`;
