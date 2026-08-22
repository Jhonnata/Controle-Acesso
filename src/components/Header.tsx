import React from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  totalAttendees: number;
  checkedInCount: number;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  day21Count: number;
  day22Count: number;
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  currentProfile: UserProfile;
  onOpenProfileSelector: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalAttendees,
  checkedInCount,
  selectedDate,
  onSelectedDateChange,
  day21Count,
  day22Count,
  isSyncing,
  onRefresh,
  onOpenAddModal,
  onOpenExport,
  onOpenSettings,
  currentProfile,
  onOpenProfileSelector,
}) => {
  // Title text depending on selected date
  const dateTitle =
    selectedDate === '21/08'
      ? 'Sexta-feira, 21 Ago'
      : 'Sábado, 22 Ago';

  const dateSubtitle =
    selectedDate === '21/08'
      ? `${day21Count} Credenciados (Hoje)`
      : `${day22Count} Credenciados`;

  return (
    <header className="sticky top-0 z-30 bg-[#F4F7FA]/95 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-slate-200/40">
      <div className="max-w-md mx-auto space-y-3">
        {/* Top Bar: Greeting & Operator Avatar */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                Olá, {currentProfile.name}
              </h1>
              <span className="text-lg">👋</span>
            </div>
            <button
              onClick={onOpenProfileSelector}
              className="inline-flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition-colors text-left"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-700">
                {currentProfile.roleTitle}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Right Action Icons: Profile Avatar with badge & sync */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="w-10 h-10 rounded-[18px] bg-white border border-slate-200/60 shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
              title="Sincronizar com Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Operator Avatar Button with notification dot */}
            <button
              onClick={onOpenProfileSelector}
              className="relative w-11 h-11 rounded-[20px] bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center font-black text-xs text-slate-800 hover:scale-105 active:scale-95 transition-all"
              title="Alternar Operador / Perfil"
            >
              <div
                className={`w-9 h-9 rounded-[16px] flex items-center justify-center font-black text-xs ${currentProfile.avatarBg} ${currentProfile.avatarText}`}
              >
                {currentProfile.name
                  .replace(/[^a-zA-ZÀ-ÿ ]/g, '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((word) => word[0].toUpperCase())
                  .join('')}
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-pink-500 border-2 border-white" />
            </button>
          </div>
        </div>

        {/* Date Selector Row - Google Calendar Style */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>{dateTitle}</span>
              <span className="text-slate-400 font-medium">• {dateSubtitle}</span>
            </div>
            <button
              onClick={onOpenAddModal}
              className="w-6 h-6 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-700 flex items-center justify-center active:scale-95 transition-all shadow-2xs font-bold"
              title="Adicionar Credenciado"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Interactive Days Pills Row: Centered on Today (21) */}
          <div className="grid grid-cols-5 gap-1.5 text-center select-none pt-0.5">
            {/* 1. Dia 19 (Qua) - Inativo */}
            <div className="py-2 px-1 rounded-2xl bg-white/40 border border-slate-200/30 text-slate-300 flex flex-col items-center justify-center opacity-40 cursor-not-allowed">
              <div className="text-[9px] uppercase font-bold text-slate-400">Qua</div>
              <div className="text-xs font-bold text-slate-400 mt-0.5">19</div>
              <div className="w-1.5 h-1.5 rounded-full bg-transparent mt-1" />
            </div>

            {/* 2. Dia 20 (Qui) - Inativo */}
            <div className="py-2 px-1 rounded-2xl bg-white/40 border border-slate-200/30 text-slate-300 flex flex-col items-center justify-center opacity-40 cursor-not-allowed">
              <div className="text-[9px] uppercase font-bold text-slate-400">Qui</div>
              <div className="text-xs font-bold text-slate-400 mt-0.5">20</div>
              <div className="w-1.5 h-1.5 rounded-full bg-transparent mt-1" />
            </div>

            {/* 3. Dia 21 (Sex - Hoje) - CENTRALIZADO */}
            <button
              type="button"
              onClick={() => onSelectedDateChange('21/08')}
              className={`py-2 px-1 rounded-2xl transition-all flex flex-col items-center justify-center ${
                selectedDate === '21/08'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ring-emerald-500 scale-[1.03]'
                  : 'bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs'
              }`}
            >
              <div
                className={`text-[8px] uppercase font-black tracking-wider leading-none ${
                  selectedDate === '21/08' ? 'text-pink-400' : 'text-slate-400'
                }`}
              >
                Hoje
              </div>
              <div className="text-sm font-black mt-0.5 leading-none">21</div>
              {/* Google Calendar style event dot */}
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                  selectedDate === '21/08' ? 'bg-emerald-400' : 'bg-emerald-500'
                }`}
              />
            </button>

            {/* 4. Dia 22 (Sáb) - Ativo */}
            <button
              type="button"
              onClick={() => onSelectedDateChange('22/08')}
              className={`py-2 px-1 rounded-2xl transition-all flex flex-col items-center justify-center ${
                selectedDate === '22/08'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ring-indigo-500 scale-[1.03]'
                  : 'bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs'
              }`}
            >
              <div
                className={`text-[8px] uppercase font-black tracking-wider leading-none ${
                  selectedDate === '22/08' ? 'text-indigo-300' : 'text-slate-400'
                }`}
              >
                Sáb
              </div>
              <div className="text-sm font-black mt-0.5 leading-none">22</div>
              {/* Google Calendar style event dot */}
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                  selectedDate === '22/08' ? 'bg-indigo-400' : 'bg-indigo-500'
                }`}
              />
            </button>

            {/* 5. Dia 23 (Dom) - Inativo */}
            <div className="py-2 px-1 rounded-2xl bg-white/40 border border-slate-200/30 text-slate-300 flex flex-col items-center justify-center opacity-40 cursor-not-allowed">
              <div className="text-[9px] uppercase font-bold text-slate-400">Dom</div>
              <div className="text-xs font-bold text-slate-400 mt-0.5">23</div>
              <div className="w-1.5 h-1.5 rounded-full bg-transparent mt-1" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
