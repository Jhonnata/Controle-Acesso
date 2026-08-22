import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  fetchAttendeesFromSupabase,
  updateAttendeeInSupabase,
  batchUpdateExhibitorInSupabase,
  saveOrUpdateAttendeeInSupabase,
  addAttendeeToSupabase,
  seedInitialDatasetToSupabase,
  supabase,
  PROFILES,
} from './services/supabase';
import { groupAttendeesByExhibitor } from './services/sheets';
import {
  Attendee,
  FilterStatus,
  SortOption,
  UserRoleId,
} from './types';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { SearchAndFilter } from './components/SearchAndFilter';
import { ExhibitorCard } from './components/ExhibitorCard';
import { AttendeeRow } from './components/AttendeeRow';
import { ScannerModal } from './components/ScannerModal';
import { AddAttendeeModal, SaveAttendeeData } from './components/AddAttendeeModal';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { ProfileSelectorModal } from './components/ProfileSelectorModal';
import { BottomNavBar } from './components/BottomNavBar';
import {
  CheckCircle2,
  Loader2,
  Search,
  Shield,
  Sparkles,
  Ticket,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const STORAGE_KEY_ROLE = 'access_control_user_role';

export default function App() {
  // Active Operator Profile (1: Produção de Equipe, 2: Coord. de Equipe, 3: Recepção / Ingressos Gratuitos)
  const [currentRoleId, setCurrentRoleId] = useState<UserRoleId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROLE) as UserRoleId;
    return saved && PROFILES[saved] ? saved : 'producao';
  });

  const currentProfile = PROFILES[currentRoleId];

  const handleSelectProfile = (roleId: UserRoleId) => {
    setCurrentRoleId(roleId);
    localStorage.setItem(STORAGE_KEY_ROLE, roleId);
    showToast(`Operador alterado para: ${PROFILES[roleId].roleTitle}`, 'info');
  };

  // View tab in the app: 'list' (Individual Attendee Cards) or 'groups' (By Exhibitor)
  const [viewTab, setViewTab] = useState<'list' | 'groups'>('list');

  // Live attendees list from Supabase
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState(false);

  // Active updating IDs for smooth tactile feedback
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('21/08'); // 'all' | '21/08' | '22/08'
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedExhibitor, setSelectedExhibitor] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('exhibitor_asc');

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleOpenAddModal = () => {
    setEditingAttendee(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (att: Attendee) => {
    setEditingAttendee(att);
    setIsAddModalOpen(true);
  };

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'error' = 'success') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage((current) => (current?.text === text ? null : current));
      }, 3500);
    },
    []
  );

  // Load from Supabase (with fallback resilience)
  const loadAttendees = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const result = await fetchAttendeesFromSupabase();
        setAttendees(result.attendees);
        setIsTableMissing(Boolean(result.tableMissing));
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } catch (err: any) {
        console.error('Supabase load error:', err);
      } finally {
        if (!silent) setIsLoading(false);
        setIsSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAttendees();

    // Supabase Realtime Subscription
    let channel: any;
    try {
      channel = supabase
        .channel('attendees_realtime_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendees' },
          () => {
            loadAttendees(true);
          }
        )
        .subscribe();
    } catch (_) {}

    // Interval poll backup
    const interval = setInterval(() => {
      loadAttendees(true);
    }, 10000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadAttendees]);

  // Refresh handler
  const handleRefresh = async () => {
    setIsSyncing(true);
    await loadAttendees(false);
    showToast('Dados sincronizados com sucesso!');
  };

  // Toggle single attendee check-in
  const handleToggleCheckIn = async (attendee: Attendee) => {
    const newStatus = !attendee.isCheckedIn;
    const targetId = attendee.id;
    const nowTime = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Optimistic UI update
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === targetId
          ? {
              ...a,
              isCheckedIn: newStatus,
              checkedInAt: newStatus ? nowTime : undefined,
              checkedBy: newStatus ? currentProfile.badge : undefined,
            }
          : a
      )
    );

    setUpdatingIds((prev) => new Set(prev).add(targetId));

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([40]);
        } catch (_) {}
      }

      await updateAttendeeInSupabase(
        attendee,
        newStatus,
        nowTime,
        currentProfile.badge
      );

      if (newStatus) {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#10B981', '#6366F1', '#EC4899'],
        });
      }

      showToast(
        newStatus
          ? `✅ Entrada liberada (${currentProfile.badge}): ${attendee.name}`
          : `Entrada desmarcada: ${attendee.name}`,
        'success'
      );
    } catch (err: any) {
      console.error('Update failed:', err);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Batch check-in all attendees of an exhibitor
  const handleBatchToggleExhibitor = async (
    attendeesToUpdate: Attendee[],
    checkInAll: boolean
  ) => {
    const idsToUpdate = new Set(attendeesToUpdate.map((a) => a.id));
    const nowTime = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      idsToUpdate.forEach((id) => next.add(id));
      return next;
    });

    // Optimistic UI update
    setAttendees((prev) =>
      prev.map((a) =>
        idsToUpdate.has(a.id)
          ? {
              ...a,
              isCheckedIn: checkInAll,
              checkedInAt: checkInAll ? nowTime : undefined,
              checkedBy: checkInAll ? currentProfile.badge : undefined,
            }
          : a
      )
    );

    try {
      await batchUpdateExhibitorInSupabase(
        attendeesToUpdate,
        checkInAll,
        nowTime,
        currentProfile.badge
      );

      if (checkInAll) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
        });
      }

      showToast(
        checkInAll
          ? `🎉 ${attendeesToUpdate.length} credenciados liberados (${currentProfile.badge})!`
          : `Entrada da equipe cancelada.`,
        'success'
      );
    } catch (err: any) {
      console.error('Batch error:', err);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        idsToUpdate.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  // Save (Add or Edit) attendee
  const handleSaveAttendee = async (newAtt: SaveAttendeeData) => {
    const isEditing = Boolean(newAtt.id);
    const res = await saveOrUpdateAttendeeInSupabase(newAtt, currentProfile.badge);

    if (newAtt.isCheckedIn && !isEditing) {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#10B981', '#6366F1', '#EC4899'],
      });
    }

    if (!res.success && res.error) {
      showToast(`Salvo localmente (offline): ${newAtt.name}`, 'info');
    } else {
      showToast(
        isEditing
          ? `✅ Credenciado atualizado: ${newAtt.name}`
          : `🎉 Novo credenciado cadastrado: ${newAtt.name}`,
        'success'
      );
    }

    await loadAttendees(false);
  };

  // Seed Supabase from Google Sheet 86 dataset
  const handleSeedSupabase = async () => {
    await seedInitialDatasetToSupabase();
    await loadAttendees(false);
    showToast('Base oficial de 86 pessoas sincronizada com sucesso!');
  };

  // Unique list of exhibitor names
  const exhibitorNames = useMemo(() => {
    const set = new Set<string>();
    attendees.forEach((a) => {
      if (a.exhibitor && a.exhibitor.trim()) {
        set.add(a.exhibitor.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [attendees]);

  // Filter and sort attendees
  const filteredAttendees = useMemo(() => {
    let result = [...attendees];

    // Date filter (21/08, 22/08 or all)
    if (selectedDate && selectedDate !== 'all') {
      result = result.filter((a) => (a.date || '21/08') === selectedDate);
    }

    // Status filter
    if (filterStatus === 'checked_in') {
      result = result.filter((a) => a.isCheckedIn);
    } else if (filterStatus === 'pending') {
      result = result.filter((a) => !a.isCheckedIn);
    }

    // Exhibitor filter
    if (selectedExhibitor) {
      result = result.filter(
        (a) =>
          a.exhibitor.trim().toLowerCase() ===
          selectedExhibitor.trim().toLowerCase()
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.exhibitor.toLowerCase().includes(q) ||
          (a.document && a.document.toLowerCase().includes(q)) ||
          (a.stand && a.stand.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      if (sortOption === 'checked_desc') {
        return (b.isCheckedIn ? 1 : 0) - (a.isCheckedIn ? 1 : 0);
      }
      return a.exhibitor.localeCompare(b.exhibitor, 'pt-BR');
    });

    return result;
  }, [attendees, selectedDate, filterStatus, selectedExhibitor, searchQuery, sortOption]);

  // Group filtered attendees
  const exhibitorGroups = useMemo(() => {
    return groupAttendeesByExhibitor(filteredAttendees);
  }, [filteredAttendees]);

  // Count per day
  const day21Count = useMemo(
    () => attendees.filter((a) => (a.date || '21/08') === '21/08').length,
    [attendees]
  );
  const day22Count = useMemo(
    () => attendees.filter((a) => a.date === '22/08').length,
    [attendees]
  );

  // Active view count (scoped to selected date for consistent operator view)
  const activeScopedAttendees = useMemo(() => {
    if (selectedDate && selectedDate !== 'all') {
      return attendees.filter((a) => (a.date || '21/08') === selectedDate);
    }
    return attendees;
  }, [attendees, selectedDate]);

  // Summary counts
  const totalCount = activeScopedAttendees.length;
  const checkedCount = useMemo(
    () => activeScopedAttendees.filter((a) => a.isCheckedIn).length,
    [activeScopedAttendees]
  );
  const pendingCount = Math.max(0, totalCount - checkedCount);

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-900 flex flex-col font-sans pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`max-w-md w-full p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold pointer-events-auto border backdrop-blur-md ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : toastMessage.type === 'info'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <X className="w-4 h-4 text-rose-600 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1 truncate">{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header with Integrated Date & Day Pills (Above Validation Rate) */}
      <Header
        totalAttendees={totalCount}
        checkedInCount={checkedCount}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        day21Count={day21Count}
        day22Count={day22Count}
        isSyncing={isSyncing}
        onRefresh={handleRefresh}
        onOpenAddModal={handleOpenAddModal}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentProfile={currentProfile}
        onOpenProfileSelector={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-md mx-auto w-full px-4 pt-3 space-y-4 flex-1">
        {/* Table creation helper banner if table missing */}
        {isTableMissing && (
          <div
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 cursor-pointer shadow-2xs hover:bg-amber-100/70 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-[11px] font-bold truncate">
                Tabela Supabase pendente • Clique para ver Script SQL
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 shrink-0">
              Ver SQL
            </span>
          </div>
        )}

        {/* Profile / Operator Banner */}
        <div className="p-3.5 rounded-[22px] bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                currentRoleId === 'producao'
                  ? 'bg-indigo-100 text-indigo-700'
                  : currentRoleId === 'coordenacao'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-pink-100 text-pink-700'
              }`}
            >
              {currentRoleId === 'producao' ? (
                <Shield className="w-4 h-4" />
              ) : currentRoleId === 'coordenacao' ? (
                <Users className="w-4 h-4" />
              ) : (
                <Ticket className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 truncate">
                  {currentProfile.roleTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {currentProfile.description}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 transition-colors"
          >
            Trocar
          </button>
        </div>

        {/* Stats Summary with Real-time Clock and Real Attendee Hourly Distribution */}
        <StatsBar
          total={totalCount}
          checkedIn={checkedCount}
          totalExhibitors={exhibitorNames.length}
          attendees={attendees}
        />

        {/* Search, Filter & QR Scanner Bar */}
        <SearchAndFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          selectedExhibitor={selectedExhibitor}
          onSelectedExhibitorChange={setSelectedExhibitor}
          exhibitorNames={exhibitorNames}
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
          totalCount={totalCount}
          pendingCount={pendingCount}
          checkedCount={checkedCount}
          onOpenScanner={() => setIsScannerOpen(true)}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-slate-900 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">
              Carregando dados da portaria...
            </p>
          </div>
        )}

        {/* List of Attendees or Exhibitor Groups */}
        {!isLoading && (
          <div className="space-y-3">
            {filteredAttendees.length === 0 ? (
              /* Empty State */
              <div className="bg-white p-8 rounded-[28px] border border-slate-200/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Nenhum participante encontrado
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tente ajustar o termo da busca ou limpar os filtros
                    selecionados.
                  </p>
                </div>
                {(searchQuery || selectedExhibitor || filterStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedExhibitor('');
                      setFilterStatus('all');
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                  >
                    Limpar Todos os Filtros
                  </button>
                )}
              </div>
            ) : viewTab === 'groups' ? (
              /* Grouped by Exhibitor View */
              <div className="space-y-3">
                {exhibitorGroups.map((group) => (
                  <ExhibitorCard
                    key={group.name}
                    group={group}
                    onToggleCheckIn={handleToggleCheckIn}
                    onBatchCheckIn={handleBatchToggleExhibitor}
                    isUpdating={group.attendees.some((a) =>
                      updatingIds.has(a.id)
                    )}
                  />
                ))}
              </div>
            ) : (
              /* Individual Attendee Cards View */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-bold">
                  <span>
                    Exibindo {filteredAttendees.length} de {totalCount}{' '}
                    credenciados
                  </span>
                  {lastSyncTime && (
                    <span className="text-[10px] text-slate-400">
                      Atualizado às {lastSyncTime}
                    </span>
                  )}
                </div>

                {filteredAttendees.map((attendee, idx) => (
                  <AttendeeRow
                    key={attendee.id || idx}
                    attendee={attendee}
                    index={idx}
                    onToggleCheckIn={handleToggleCheckIn}
                    onEditAttendee={handleOpenEditModal}
                    isUpdating={updatingIds.has(attendee.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Profile Selector Modal */}
      <ProfileSelectorModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentRoleId={currentRoleId}
        onSelectProfile={handleSelectProfile}
      />

      {/* Bottom Floating Navigation Bar */}
      <BottomNavBar
        activeTab={viewTab}
        onTabChange={setViewTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenProfileSelector={() => setIsProfileModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentProfile={currentProfile}
      />

      {/* QR Code Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        attendees={attendees}
        onConfirmCheckIn={handleToggleCheckIn}
      />

      {/* Add New Attendee Modal */}
      <AddAttendeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        exhibitors={exhibitorNames}
        editingAttendee={editingAttendee}
        onSaveAttendee={handleSaveAttendee}
      />

      {/* Export Reports Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        attendees={attendees}
        onRefreshData={() => loadAttendees(true)}
      />

      {/* Settings & Supabase Status Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        totalAttendeesCount={totalCount}
        checkedInCount={checkedCount}
        onSeedSupabase={handleSeedSupabase}
        onRefresh={handleRefresh}
        isSyncing={isSyncing}
        isTableMissing={isTableMissing}
      />
    </div>
  );
}
