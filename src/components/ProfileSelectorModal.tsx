import React from 'react';
import { X, Check, Users, Shield, Ticket, Sparkles } from 'lucide-react';
import { UserProfile, UserRoleId } from '../types';
import { PROFILES } from '../services/supabase';

interface ProfileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoleId: UserRoleId;
  onSelectProfile: (roleId: UserRoleId) => void;
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  isOpen,
  onClose,
  currentRoleId,
  onSelectProfile,
}) => {
  if (!isOpen) return null;

  const profilesList = Object.values(PROFILES);

  const getProfileIcon = (id: UserRoleId) => {
    switch (id) {
      case 'producao':
        return <Shield className="w-5 h-5 text-indigo-600" />;
      case 'coordenacao':
        return <Users className="w-5 h-5 text-emerald-600" />;
      case 'recepcao':
        return <Ticket className="w-5 h-5 text-pink-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100/80">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Controle de Acesso
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">
              Selecionar Operador / Perfil
            </h3>
            <p className="text-xs text-slate-500">
              Escolha quem está operando o check-in neste momento:
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profiles List */}
        <div className="p-5 space-y-3">
          {profilesList.map((profile) => {
            const isSelected = profile.id === currentRoleId;

            return (
              <button
                key={profile.id}
                onClick={() => {
                  onSelectProfile(profile.id);
                  onClose();
                }}
                className={`w-full text-left p-4 rounded-[24px] transition-all flex items-center gap-3.5 border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
                    : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 border-slate-200/60'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-[20px] flex items-center justify-center font-black text-sm shrink-0 ${
                    isSelected
                      ? 'bg-white/10 text-white border border-white/20'
                      : profile.id === 'producao'
                      ? 'bg-indigo-100 text-indigo-700'
                      : profile.id === 'coordenacao'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-pink-100 text-pink-700'
                  }`}
                >
                  {getProfileIcon(profile.id)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm font-black truncate ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {profile.roleTitle}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {profile.badge}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {profile.description}
                  </p>
                </div>

                <div className="shrink-0">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300" />
                  )}
                </div>
              </button>
            );
          })}

          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-indigo-900 text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong>Sincronização em Tempo Real:</strong> Cada entrada registrada salvará a assinatura do operador no <strong>Supabase</strong> para que todos os 3 celulares vejam os dados atualizados simultaneamente!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50/60">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs shadow-sm transition-all"
          >
            Confirmar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
