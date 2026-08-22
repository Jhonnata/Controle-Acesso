export type UserRoleId = 'producao' | 'coordenacao' | 'recepcao';

export interface UserProfile {
  id: UserRoleId;
  name: string;
  roleTitle: string;
  badge: string;
  avatarBg: string;
  avatarText: string;
  description: string;
}

export interface Attendee {
  id: string; // row index or unique id
  rowIndex: number; // 1-based row number in Google Sheets
  date?: string; // '21/08' | '22/08'
  name: string;
  exhibitor: string;
  document?: string; // CPF/RG/Badge ID
  role?: string; // Cargo, Função, Tipo
  email?: string;
  phone?: string;
  stand?: string; // Número do Estande / Pavilhão
  isCheckedIn: boolean;
  checkedInAt?: string; // Formatted time
  checkedBy?: string; // Who checked this in ('Produção', 'Coordenação', 'Recepção (Gratuito)')
  notes?: string;
  rawValues: (string | number | boolean | null)[];
}

export interface ExhibitorGroup {
  name: string;
  stand?: string;
  totalAttendees: number;
  checkedInCount: number;
  attendees: Attendee[];
}

export interface ColumnMapping {
  exhibitorIndex: number;
  nameIndex: number;
  statusIndex: number;
  timestampIndex: number;
  documentIndex: number;
  roleIndex: number;
  standIndex: number;
  emailIndex: number;
  phoneIndex: number;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface SheetInfo {
  id: string;
  title: string;
  tabs: SheetTabInfo[];
  activeTab: string;
  activeSheetId?: number;
}

export type FilterStatus = 'all' | 'checked_in' | 'pending';
export type SortOption = 'exhibitor_asc' | 'name_asc' | 'checked_desc' | 'stand_asc';
