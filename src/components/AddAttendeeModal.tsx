import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Building2,
  User,
  IdCard,
  Briefcase,
  Check,
  Calendar,
  Edit3,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Attendee } from '../types';

export interface SaveAttendeeData {
  id?: string;
  name: string;
  exhibitor: string;
  document?: string;
  role?: string;
  stand?: string;
  date: string; // '21/08' | '22/08'
  isCheckedIn: boolean;
}

export const maskCpf = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

interface AddAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  exhibitorNames?: string[];
  exhibitors?: string[];
  defaultExhibitor?: string;
  defaultDate?: string;
  editingAttendee?: Attendee | null;
  onSaveAttendee: (attendeeData: SaveAttendeeData) => Promise<void>;
}

export const AddAttendeeModal: React.FC<AddAttendeeModalProps> = ({
  isOpen,
  onClose,
  exhibitorNames = [],
  exhibitors = [],
  defaultExhibitor = '',
  defaultDate = '21/08',
  editingAttendee = null,
  onSaveAttendee,
}) => {
  const allExhibitors = Array.from(
    new Set([...exhibitorNames, ...exhibitors].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const isEditing = Boolean(editingAttendee);

  const [name, setName] = useState('');
  const [exhibitor, setExhibitor] = useState('');
  const [isCustomExhibitor, setIsCustomExhibitor] = useState(false);
  const [customExhibitor, setCustomExhibitor] = useState('');
  const [document, setDocument] = useState('');
  const [role, setRole] = useState('Credenciado');
  const [date, setDate] = useState('21/08');
  const [markEnteredNow, setMarkEnteredNow] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state when opened or editingAttendee changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (editingAttendee) {
      setName(editingAttendee.name || '');
      setDocument(editingAttendee.document || '');
      setRole(editingAttendee.role || 'Credenciado');
      setDate(editingAttendee.date || defaultDate || '21/08');
      setMarkEnteredNow(Boolean(editingAttendee.isCheckedIn));

      const existingExhibitor = editingAttendee.exhibitor || '';
      if (allExhibitors.includes(existingExhibitor)) {
        setExhibitor(existingExhibitor);
        setIsCustomExhibitor(false);
        setCustomExhibitor('');
      } else {
        setExhibitor('');
        setIsCustomExhibitor(true);
        setCustomExhibitor(existingExhibitor);
      }
    } else {
      setName('');
      setDocument('');
      setRole('Credenciado');
      setDate(defaultDate === '22/08' ? '22/08' : '21/08');
      setMarkEnteredNow(true);

      if (defaultExhibitor && allExhibitors.includes(defaultExhibitor)) {
        setExhibitor(defaultExhibitor);
        setIsCustomExhibitor(false);
        setCustomExhibitor('');
      } else if (defaultExhibitor) {
        setIsCustomExhibitor(true);
        setCustomExhibitor(defaultExhibitor);
      } else {
        setExhibitor('');
        setIsCustomExhibitor(false);
        setCustomExhibitor('');
      }
    }
  }, [isOpen, editingAttendee, defaultExhibitor, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalExhibitor = isCustomExhibitor ? customExhibitor.trim() : exhibitor.trim();
    if (!name.trim()) {
      setError('Por favor, informe o nome do participante.');
      return;
    }
    if (!finalExhibitor) {
      setError('Por favor, informe ou selecione a empresa expositora.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveAttendee({
        id: editingAttendee?.id,
        name: name.trim(),
        exhibitor: finalExhibitor,
        document: document.trim() || undefined,
        role: role.trim() || 'Credenciado',
        date: date || '21/08',
        isCheckedIn: markEnteredNow,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar credenciado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[18px] bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
              {isEditing ? (
                <Edit3 className="w-5 h-5 text-indigo-400" />
              ) : (
                <UserPlus className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isEditing ? 'Editar Credenciado' : 'Novo Credenciado'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Atualização em tempo real no Supabase' : 'Gravação instantânea no banco de dados'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Dia do Evento (21/08 ou 22/08) */}
          <div>
            <label className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-pink-600" />
              <span>Dia do Evento *</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDate('21/08')}
                className={`py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 border ${
                  date === '21/08'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-emerald-500/40'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${date === '21/08' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                <span>21/08 (Hoje / Sexta)</span>
              </button>

              <button
                type="button"
                onClick={() => setDate('22/08')}
                className={`py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 border ${
                  date === '22/08'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-indigo-500/40'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${date === '22/08' ? 'bg-indigo-400' : 'bg-slate-400'}`} />
                <span>22/08 (Sábado)</span>
              </button>
            </div>
          </div>

          {/* Empresa / Expositor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Empresa / Expositor *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomExhibitor(!isCustomExhibitor);
                  if (!isCustomExhibitor) {
                    setCustomExhibitor(exhibitor);
                  }
                }}
                className="text-[11px] font-black text-indigo-600 hover:underline"
              >
                {isCustomExhibitor ? 'Escolher da lista' : '+ Digitar nova empresa'}
              </button>
            </div>

            {isCustomExhibitor ? (
              <input
                type="text"
                value={customExhibitor}
                onChange={(e) => setCustomExhibitor(e.target.value)}
                placeholder="Nome da empresa expositora..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            ) : (
              <select
                value={exhibitor}
                onChange={(e) => setExhibitor(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              >
                <option value="">Selecione a empresa ou estande...</option>
                {allExhibitors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nome Completo */}
          <div>
            <label className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Nome do Credenciado *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo de Souza"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              required
            />
          </div>

          {/* CPF & Cargo */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                <IdCard className="w-4 h-4 text-slate-500" />
                <span>CPF / Documento</span>
              </label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(maskCpf(e.target.value))}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-500" />
                <span>Função / Cargo</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Expositor"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Check-in now toggle */}
          <div
            onClick={() => setMarkEnteredNow(!markEnteredNow)}
            className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition-colors"
          >
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className={`w-4 h-4 ${markEnteredNow ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{isEditing ? 'Marcar como Liberado / Presente' : 'Liberar entrada imediatamente'}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                {markEnteredNow ? 'Registra entrada na portaria com horário atual' : 'Ficará como Pendente de entrada'}
              </div>
            </div>

            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all ${
                markEnteredNow
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                  : 'border-slate-300 bg-white text-transparent'
              }`}
            >
              {markEnteredNow && <Check className="w-4 h-4 stroke-[3]" />}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 shadow-md shadow-slate-900/15"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : isEditing ? (
                <>
                  <Edit3 className="w-4 h-4 text-indigo-300" />
                  <span>Salvar Alterações</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-emerald-300" />
                  <span>Salvar Credenciado</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
