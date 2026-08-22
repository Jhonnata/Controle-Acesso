import React from 'react';
import {
  RefreshCw,
  Plus,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getDefaultEventDate,
  getCurrentWeekDates,
  getEventDateDetails,
  sortEventDates,
} from '../services/eventDates';

interface HeaderProps {
  totalAttendees: number;
  checkedInCount: number;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  availableDates: string[];
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenConfig: () => void;
  currentProfile: UserProfile;
  onOpenProfileSelector: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalAttendees,
  checkedInCount,
  selectedDate,
  onSelectedDateChange,
  availableDates,
  isSyncing,
  onRefresh,
  onOpenAddModal,
  onOpenConfig,
  currentProfile,
  onOpenProfileSelector,
}) => {
  const sortedDates = sortEventDates(availableDates);
  const fallbackDate = sortedDates[sortedDates.length - 1] || getDefaultEventDate();
  const activeDate = sortedDates.includes(selectedDate) ? selectedDate : fallbackDate;
  const activeDetails = getEventDateDetails(activeDate);
  const weekDates = getCurrentWeekDates();
  const dateTitle = activeDetails.title;
  const activeCount = totalAttendees;
  const dateSubtitle = activeDetails.isToday
    ? `${activeCount} Credenciados (Hoje)`
    : `${activeCount} Credenciados`;

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

            <button
              onClick={onOpenConfig}
              className="w-10 h-10 rounded-[18px] bg-white border border-slate-200/60 shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
              title="Configurações"
            >
              <Settings className="w-4 h-4 text-emerald-600" />
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

          <div className="grid grid-cols-7 gap-1 text-center select-none pt-0.5">
            {weekDates.map((weekItem) => {
              const details = getEventDateDetails(weekItem.eventDate);
              const isSelected = selectedDate === weekItem.eventDate;
              const isEnabled = sortedDates.includes(weekItem.eventDate);

              return (
                <button
                  key={weekItem.eventDate}
                  type="button"
                  onClick={() => isEnabled && onSelectedDateChange(weekItem.eventDate)}
                  disabled={!isEnabled}
                  className={`min-w-0 py-1.5 px-1 rounded-2xl transition-all flex flex-col items-center justify-center ${
                    !isEnabled
                      ? 'bg-white/60 border border-slate-200/60 text-slate-300 opacity-70 cursor-not-allowed'
                      : isSelected
                      ? `bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ${details.selectedRingClass} scale-[1.03]`
                      : 'bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs'
                  }`}
                  title={
                    isEnabled
                      ? `${weekItem.fullWeekday}, ${weekItem.eventDate}`
                      : `${weekItem.fullWeekday}, ${weekItem.eventDate} sem registros`
                  }
                >
                  <div
                    className={`text-[8px] uppercase font-black tracking-wide leading-none ${
                      !isEnabled
                        ? 'text-slate-300'
                        : isSelected
                        ? details.accentTextClass
                        : 'text-slate-400'
                    }`}
                  >
                    {weekItem.shortWeekday}
                  </div>
                  <div className="text-xs font-black mt-0.5 leading-none">{weekItem.dayNumber}</div>
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      !isEnabled
                        ? 'bg-slate-200'
                        : isSelected
                        ? details.selectedDotClass
                        : details.idleDotClass
                    }`}
                  />
                  {weekItem.isToday && (
                    <div className="text-[7px] font-black mt-1 leading-none text-emerald-500">Hoje</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
