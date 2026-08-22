import React from 'react';
import {
  CheckCircle2,
  Clock,
  User,
  Building2,
  FileText,
  ShieldCheck,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { Attendee } from '../types';

interface AttendeeRowProps {
  attendee: Attendee;
  index: number;
  onToggleCheckIn: (attendee: Attendee) => void;
  onEditAttendee?: (attendee: Attendee) => void;
  isUpdating?: boolean;
}

export const AttendeeRow: React.FC<AttendeeRowProps> = ({
  attendee,
  index,
  onToggleCheckIn,
  onEditAttendee,
  isUpdating = false,
}) => {
  // Extract initials
  const initials = attendee.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[22px] bg-white border transition-all duration-200 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs hover:shadow-sm ${
        attendee.isCheckedIn
          ? 'border-emerald-200/80 bg-emerald-50/20'
          : 'border-slate-200/70 hover:border-slate-300'
      }`}
    >
      {/* Left zone: Avatar + Attendee Details (Clicking details opens Edit) */}
      <div
        onClick={() => onEditAttendee && onEditAttendee(attendee)}
        className={`flex items-center gap-3 min-w-0 flex-1 ${
          onEditAttendee ? 'cursor-pointer group' : ''
        }`}
        title={onEditAttendee ? 'Clique para ver/editar dados do credenciado' : undefined}
      >
        {/* Avatar / Index */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[18px] flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
            attendee.isCheckedIn
              ? 'bg-[#DCFCE7] text-emerald-800 border border-emerald-300/50'
              : 'bg-[#F1F5F9] text-slate-700 border border-slate-200/60'
          }`}
        >
          {attendee.isCheckedIn ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <span>{initials || index + 1}</span>
          )}
        </div>

        {/* Name and Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-black text-slate-900 leading-snug truncate group-hover:text-indigo-600 transition-colors">
              {attendee.name}
            </h4>
            {attendee.date && (
              <span
                className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                  attendee.date === '22/08'
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200/60'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                }`}
              >
                {attendee.date}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs flex-wrap">
            {/* Exhibitor */}
            <span className="font-bold text-slate-600 truncate max-w-[140px]">
              {attendee.exhibitor}
            </span>

            {/* Document / CPF */}
            {attendee.document && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-mono text-[9px] font-bold">
                {attendee.document}
              </span>
            )}
          </div>

          {/* If checked in, show check-in stamp & operator */}
          {attendee.isCheckedIn && (
            <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-600" />
                <span>Entrou às {attendee.checkedInAt || '21/08'}</span>
              </span>
              {attendee.checkedBy && (
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px]">
                  por {attendee.checkedBy}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right zone: Edit button + Action Check-in Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onEditAttendee && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditAttendee(attendee);
            }}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="Editar dados"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => onToggleCheckIn(attendee)}
          disabled={isUpdating}
          className={`h-10 px-3.5 sm:px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs ${
            attendee.isCheckedIn
              ? 'bg-[#DCFCE7] hover:bg-emerald-200 text-emerald-900 border border-emerald-300/80'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
          title={attendee.isCheckedIn ? 'Clique para desmarcar' : 'Validar entrada'}
        >
          {isUpdating ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : attendee.isCheckedIn ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Entrou</span>
            </>
          ) : (
            <span>Liberar</span>
          )}
        </button>
      </div>
    </div>
  );
};
