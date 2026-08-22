import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react';
import { Attendee } from '../types';

interface StatsBarProps {
  total: number;
  checkedIn: number;
  totalExhibitors: number;
  attendees?: Attendee[];
}

export const StatsBar: React.FC<StatsBarProps> = ({
  total,
  checkedIn,
  totalExhibitors,
  attendees = [],
}) => {
  const pending = Math.max(0, total - checkedIn);
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  // Real-time clock for display (e.g. 21:13)
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentHour(now.getHours());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep the current hour centered in the scrollable chart
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const col = el.querySelector<HTMLElement>(`[data-hour="${currentHour}"]`);
    if (!col) return;
    el.scrollTo({
      left: col.offsetLeft - el.clientWidth / 2 + col.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [currentHour]);

  // One bucket per hour of the day
  const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}h`,
    hour: h,
  }));

  // Count attendees per exact hour of check-in
  const hourlyCounts = hourlyBuckets.map((bucket) => ({
    ...bucket,
    count: attendees.filter((a) => {
      if (!a.isCheckedIn || !a.checkedInAt) return false;
      const match = String(a.checkedInAt).match(/(\d{1,2}):/);
      return match ? parseInt(match[1], 10) === bucket.hour : false;
    }).length,
  }));

  const maxHourlyCount = Math.max(1, ...hourlyCounts.map((b) => b.count), checkedIn > 0 ? 1 : 1);

  return (
    <div className="space-y-3.5">
      {/* Main Validation / Presence Card */}
      <div className="bg-white p-5 rounded-[28px] border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Taxa de Validação da Portaria
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-base font-black text-slate-900 leading-tight">
              {checkedIn} de {total} Credenciados
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Horário</div>
              <div className="text-xs font-black text-slate-900 font-mono">{currentTimeStr}</div>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white shadow-xs">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-black">{percentage}%</span>
            </div>
          </div>
        </div>

        {/* Dynamic Hourly Distribution Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Entradas por hora
            </span>
            <span className="text-[9px] font-bold text-slate-400 hidden sm:inline">
              arraste para ver outros horários →
            </span>
          </div>

          <div
            ref={scrollRef}
            className="overflow-x-auto pb-1 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="flex items-end gap-1 h-16 pt-2 px-1 min-w-max w-full">
              {hourlyCounts.map((bucket) => {
                const heightPct = Math.max(
                  10,
                  Math.round((bucket.count / maxHourlyCount) * 85)
                );
                const hasCheckins = bucket.count > 0;
                const isCurrentHour = bucket.hour === currentHour;

                return (
                  <div
                    key={bucket.label}
                    data-hour={bucket.hour}
                    className={`w-8 shrink-0 flex flex-col items-center gap-1 h-full justify-end rounded-lg transition-all ${
                      isCurrentHour ? 'bg-emerald-50 ring-1 ring-emerald-300/70' : ''
                    }`}
                  >
                    <div className="relative h-full w-full flex flex-col items-center justify-end">
                      {hasCheckins && (
                        <span className="absolute -top-4 text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 rounded-sm shadow-2xs whitespace-nowrap">
                          {bucket.count}
                        </span>
                      )}
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          hasCheckins
                            ? isCurrentHour
                              ? 'bg-emerald-600 shadow-xs'
                              : 'bg-slate-900 shadow-xs'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-[8px] leading-none pb-0.5 ${
                        isCurrentHour
                          ? 'font-black text-emerald-700'
                          : hasCheckins
                          ? 'font-black text-slate-900'
                          : 'font-bold text-slate-400'
                      }`}
                    >
                      {bucket.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/50">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold px-0.5">
              <span>0% (Início)</span>
              <span>
                {pending === 0 && total > 0 ? '🎉 100% Presentes!' : `Faltam ${pending} pessoas`}
              </span>
              <span>100% (Meta)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pastel Activity / Status Cards */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-800">
            Resumo Operacional
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {currentTimeStr} • Atualização contínua
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Card 1: Entraram (Pastel Lavender / Purple) */}
          <div className="bg-[#EDE9FE] p-3.5 rounded-[24px] border border-purple-200/60 flex flex-col justify-between h-28 transition-all hover:scale-[1.02] shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-[14px] bg-white/90 text-purple-700 flex items-center justify-center shadow-2xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-purple-700 bg-white/80 px-1.5 py-0.5 rounded-full">
                {percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-black text-purple-950 leading-none">
                {checkedIn}
              </div>
              <div className="text-[11px] font-bold text-purple-800/90 mt-1">
                Liberados
              </div>
            </div>
          </div>

          {/* Card 2: Pendentes (Pastel Sky / Cyan) */}
          <div className="bg-[#E0F2FE] p-3.5 rounded-[24px] border border-sky-200/60 flex flex-col justify-between h-28 transition-all hover:scale-[1.02] shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-[14px] bg-white/90 text-sky-700 flex items-center justify-center shadow-2xs font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-sky-700 bg-white/80 px-1.5 py-0.5 rounded-full">
                {100 - percentage}%
              </span>
            </div>
            <div>
              <div className="text-xl font-black text-sky-950 leading-none">
                {pending}
              </div>
              <div className="text-[11px] font-bold text-sky-800/90 mt-1">
                Pendentes
              </div>
            </div>
          </div>

          {/* Card 3: Total (Pastel Mint / Green) */}
          <div className="bg-[#DCFCE7] p-3.5 rounded-[24px] border border-emerald-200/60 flex flex-col justify-between h-28 transition-all hover:scale-[1.02] shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-[14px] bg-white/90 text-emerald-700 flex items-center justify-center shadow-2xs font-bold">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-emerald-700 bg-white/80 px-1.5 py-0.5 rounded-full">
                {totalExhibitors} emp.
              </span>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-950 leading-none">
                {total}
              </div>
              <div className="text-[11px] font-bold text-emerald-800/90 mt-1">
                Base Total
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
