import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Attendee, ExhibitorGroup } from '../types';
import { AttendeeRow } from './AttendeeRow';

interface ExhibitorCardProps {
  group: ExhibitorGroup;
  onToggleCheckIn: (attendee: Attendee) => void;
  onBatchCheckIn: (attendees: Attendee[], isCheckedIn: boolean) => void;
  onEditAttendee?: (attendee: Attendee) => void;
  isUpdating?: boolean;
}

export const ExhibitorCard: React.FC<ExhibitorCardProps> = ({
  group,
  onToggleCheckIn,
  onBatchCheckIn,
  onEditAttendee,
  isUpdating = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const isAllCheckedIn =
    group.attendees.length > 0 &&
    group.attendees.every((a) => a.isCheckedIn);

  const percentage =
    group.totalAttendees > 0
      ? Math.round((group.checkedInCount / group.totalAttendees) * 100)
      : 0;

  return (
    <div className="bg-white rounded-[26px] border border-slate-200/80 shadow-xs overflow-hidden transition-all">
      {/* Group Header */}
      <div className="p-4 bg-[#F8FAFC]/80 border-b border-slate-150/60 flex items-center justify-between gap-3">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 select-none"
        >
          <div className="w-10 h-10 rounded-[16px] bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
            <Building2 className="w-5 h-5 text-pink-300" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 truncate">
                {group.name}
              </h3>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isAllCheckedIn
                    ? 'bg-[#DCFCE7] text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {group.checkedInCount}/{group.totalAttendees}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {percentage}% da equipe presente
            </p>
          </div>
        </div>

        {/* Action zone: Liberar Todos + Accordion toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onBatchCheckIn(group.attendees, !isAllCheckedIn)}
            disabled={isUpdating}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow-2xs ${
              isAllCheckedIn
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isAllCheckedIn ? 'Desmarcar toda a equipe' : 'Liberar entrada de todos'}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isAllCheckedIn ? 'Desmarcar' : 'Liberar Todos'}
            </span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 text-slate-500 flex items-center justify-center hover:bg-slate-100"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Group Attendees List */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {group.attendees.map((attendee, idx) => (
            <AttendeeRow
              key={attendee.id || idx}
              attendee={attendee}
              index={idx}
              onToggleCheckIn={onToggleCheckIn}
              onEditAttendee={onEditAttendee}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
};
