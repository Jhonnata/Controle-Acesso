import React from 'react';
import {
  Search,
  X,
  QrCode,
  Building2,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Users,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { FilterStatus, SortOption } from '../types';

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  selectedExhibitor: string;
  onSelectedExhibitorChange: (exhibitor: string) => void;
  exhibitorNames: string[];
  sortOption: SortOption;
  onSortOptionChange: (sort: SortOption) => void;
  totalCount: number;
  pendingCount: number;
  checkedCount: number;
  onOpenScanner: () => void;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  selectedExhibitor,
  onSelectedExhibitorChange,
  exhibitorNames,
  sortOption,
  onSortOptionChange,
  totalCount,
  pendingCount,
  checkedCount,
  onOpenScanner,
}) => {
  return (
    <div className="space-y-3">
      {/* Search Input Bar + Scan Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, expositor, CPF..."
            className="w-full pl-10 pr-9 py-3 bg-white border border-slate-200/80 rounded-[22px] text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 transition-all shadow-xs font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={onOpenScanner}
          className="h-11 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-[22px] flex items-center gap-1.5 text-xs font-black shadow-sm active:scale-95 transition-all shrink-0"
          title="Ler QR Code ou Código de Barras"
        >
          <QrCode className="w-4 h-4 text-pink-300" />
          <span className="hidden sm:inline">Escanear</span>
        </button>
      </div>

      {/* Segmented Tab Filter (Status) */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200/60 shadow-2xs flex items-center gap-1">
        <button
          onClick={() => onFilterStatusChange('all')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>Todos</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filterStatus === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => onFilterStatusChange('pending')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            filterStatus === 'pending'
              ? 'bg-[#E0F2FE] text-sky-900 shadow-xs border border-sky-300/60'
              : 'text-slate-500 hover:text-sky-700 bg-transparent'
          }`}
        >
          <span>Pendentes</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filterStatus === 'pending' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => onFilterStatusChange('checked_in')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            filterStatus === 'checked_in'
              ? 'bg-[#DCFCE7] text-emerald-900 shadow-xs border border-emerald-300/60'
              : 'text-slate-500 hover:text-emerald-700 bg-transparent'
          }`}
        >
          <span>Entraram</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filterStatus === 'checked_in'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {checkedCount}
          </span>
        </button>
      </div>

      {/* Horizontal Exhibitor Chips Carousel */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 font-bold">
          <span>Filtrar por Empresa ({exhibitorNames.length})</span>
          {selectedExhibitor && (
            <button
              onClick={() => onSelectedExhibitorChange('')}
              className="text-pink-600 font-bold hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          <button
            onClick={() => onSelectedExhibitorChange('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all border ${
              !selectedExhibitor
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200/80 shadow-2xs'
            }`}
          >
            Todos Expositores
          </button>

          {exhibitorNames.map((name) => {
            const isSelected = selectedExhibitor === name;
            return (
              <button
                key={name}
                onClick={() => onSelectedExhibitorChange(name)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
