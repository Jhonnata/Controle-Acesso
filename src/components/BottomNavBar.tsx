import React from 'react';
import {
  Users,
  Building2,
  QrCode,
  UserCircle,
  Database,
} from 'lucide-react';
import { UserProfile } from '../types';

interface BottomNavBarProps {
  activeTab: 'list' | 'groups';
  onTabChange: (tab: 'list' | 'groups') => void;
  onOpenScanner: () => void;
  onOpenProfileSelector: () => void;
  onOpenSettings: () => void;
  currentProfile: UserProfile;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenProfileSelector,
  onOpenSettings,
  currentProfile,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 p-2.5 pb-5 sm:pb-3 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around gap-1">
        {/* Tab 1: Todos Credenciados */}
        <button
          onClick={() => onTabChange('list')}
          className={`flex-1 py-1.5 px-2 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${
            activeTab === 'list'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-bold">Check-in</span>
        </button>

        {/* Tab 2: Por Empresa */}
        <button
          onClick={() => onTabChange('groups')}
          className={`flex-1 py-1.5 px-2 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${
            activeTab === 'groups'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span className="text-[10px] font-bold">Empresas</span>
        </button>

        {/* Action Center: QR Scanner Button */}
        <button
          onClick={onOpenScanner}
          className="w-12 h-12 -mt-5 rounded-full bg-slate-900 text-white border-4 border-[#F4F7FA] shadow-md flex items-center justify-center active:scale-95 transition-all"
          title="Ler QR Code"
        >
          <QrCode className="w-5 h-5 text-pink-300" />
        </button>

        {/* Tab 3: Perfil / Operador */}
        <button
          onClick={onOpenProfileSelector}
          className="flex-1 py-1.5 px-2 rounded-2xl flex flex-col items-center gap-0.5 text-slate-600 hover:text-slate-900 transition-all"
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${currentProfile.avatarBg} ${currentProfile.avatarText}`}
          >
            <UserCircle className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-bold truncate max-w-[70px]">
            {currentProfile.badge}
          </span>
        </button>

        {/* Tab 4: Banco / Supabase */}
        <button
          onClick={onOpenSettings}
          className="flex-1 py-1.5 px-2 rounded-2xl flex flex-col items-center gap-0.5 text-slate-500 hover:text-slate-900 transition-all"
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] font-bold">Supabase</span>
        </button>
      </div>
    </div>
  );
};
