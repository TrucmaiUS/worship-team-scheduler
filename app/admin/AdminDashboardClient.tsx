'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminAssignMember, adminRemoveAssignment, adminDeleteUser } from './actions';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';

const ROSTER_GROUPS = [
  {
    name: '🎤 CA SỸ (SINGERS)',
    headerBg: 'bg-brand-pink text-brand-white',
    slots: [
      { key: 'vocal_1', label: 'Vocal 1', team: 'SINGER', roleDetail: 'Vocal 1' },
      { key: 'vocal_2', label: 'Vocal 2', team: 'SINGER', roleDetail: 'Vocal 2' },
      { key: 'vocal_3', label: 'Vocal 3', team: 'SINGER', roleDetail: 'Vocal 3' },
    ]
  },
  {
    name: '🎸 NHẠC CÔNG (MUSICIANS)',
    headerBg: 'bg-brand-blue text-brand-white',
    slots: [
      { key: 'piano', label: 'Piano', team: 'MUSICIAN', roleDetail: 'Piano' },
      { key: 'acoustic', label: 'Acoustic Guitar', team: 'MUSICIAN', roleDetail: 'Acoustic Guitar' },
      { key: 'eguitar', label: 'E-Guitar', team: 'MUSICIAN', roleDetail: 'E-Guitar' },
      { key: 'bass', label: 'Bass', team: 'MUSICIAN', roleDetail: 'Bass' },
      { key: 'drum', label: 'Drum', team: 'MUSICIAN', roleDetail: 'Drum' },
    ]
  },
  {
    name: '🎧 ÂM THANH (SOUND TEAM)',
    headerBg: 'bg-brand-black text-brand-white',
    slots: [
      { key: 'sound', label: 'Sound Team', team: 'SOUND', roleDetail: null },
    ]
  }
];

export default function AdminDashboardClient({ gridData, allUsers }: any) {
  const assignableUsers = allUsers.filter((u: any) => u.role !== 'ADMIN');
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'TABLE' | 'MEMBERS'>('SCHEDULE');
  const [modalState, setModalState] = useState<{ open: boolean, serviceId: string, team: string }>({
    open: false,
    serviceId: '',
    team: ''
  });
  const [removeModalState, setRemoveModalState] = useState<{ open: boolean, serviceId: string, userId: string }>({
    open: false,
    serviceId: '',
    userId: ''
  });
  const [deleteUserModal, setDeleteUserModal] = useState<{ open: boolean, userId: string, userName: string }>({
    open: false,
    userId: '',
    userName: ''
  });
  const [roleDetails, setRoleDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Table View Manage Service Modal State
  const [manageServiceId, setManageServiceId] = useState<string | null>(null);
  const [slotAssigns, setSlotAssigns] = useState<Record<string, string>>({});

  // Determine current month in YYYY-MM based on the NEXT upcoming service
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
  const localDate = new Date(now.getTime() - tzOffset);
  const todayStr = localDate.toISOString().slice(0, 10);
  
  const upcomingService = gridData.find((s: any) => s.date >= todayStr);
  const defaultMonthStr = upcomingService ? upcomingService.date.slice(0, 7) : todayStr.slice(0, 7);
  
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr);

  const handleAssign = async (userId: string) => {
    const detail = roleDetails[userId] || null;
    if (!detail && (modalState.team === 'SINGER' || modalState.team === 'MUSICIAN')) {
      toast.error('Please select a specific role before assigning.');
      return;
    }
    setLoading(true);
    const res = await adminAssignMember(modalState.serviceId, userId, modalState.team, detail);
    setLoading(false);
    
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Assigned successfully!');
      setModalState({ open: false, serviceId: '', team: '' });
      setRoleDetails({});
    }
  };

  const handleSlotAssign = async (slot: any) => {
    const userId = slotAssigns[slot.key];
    if (!userId || !manageServiceId) return;
    setLoading(true);
    const res = await adminAssignMember(manageServiceId, userId, slot.team, slot.roleDetail);
    setLoading(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(`Đã phân công ${slot.label}!`);
      setSlotAssigns(prev => ({ ...prev, [slot.key]: '' }));
    }
  };

  const handleRemove = (serviceId: string, userId: string) => {
    setRemoveModalState({ open: true, serviceId, userId });
  };

  const confirmRemove = async () => {
    try {
      await adminRemoveAssignment(removeModalState.serviceId, removeModalState.userId);
      toast.success('Member removed!');
    } catch (e: any) {
      toast.error('Failed to remove member: ' + e.message);
    } finally {
      setRemoveModalState({ open: false, serviceId: '', userId: '' });
    }
  };

  const confirmDeleteUser = async () => {
    try {
      const res = await adminDeleteUser(deleteUserModal.userId);
      if (res?.error) throw new Error(res.error);
      toast.success('User deleted successfully!');
    } catch (e: any) {
      toast.error('Failed to delete user: ' + e.message);
    } finally {
      setDeleteUserModal({ open: false, userId: '', userName: '' });
    }
  };

  const renderTeamCell = (service: any, teamName: string, members: any[]) => {
    return (
      <div className="flex-1 p-4 border-r-4 border-brand-black last:border-r-0 min-w-[200px]">
        <h4 className="font-bold border-b-2 border-brand-black pb-1 mb-2">{teamName}</h4>
        <div className="space-y-1 mb-4">
          {members.length === 0 ? (
            <div className="text-sm font-bold text-brand-red">⚠ --</div>
          ) : (
            members.map(u => (
              <div key={u.id} className="text-xs font-bold flex justify-between items-center group bg-brand-white border border-brand-black/30 px-2 py-1 rounded shadow-[1px_1px_0_0_#111111] mb-1.5">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="text-brand-black">✓ {u.full_name}</span>
                  {u.role_detail && (
                    <span className="bg-brand-black/5 text-brand-black/70 px-1.5 py-0.2 rounded text-[10px] font-extrabold border border-brand-black/15">
                      {u.role_detail}
                    </span>
                  )}
                </span>
                <button 
                  onClick={() => handleRemove(service.id, u.id)}
                  className="w-3.5 h-3.5 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                  title="Remove"
                >
                  <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs h-7 w-full border-2 border-dashed"
          onClick={() => setModalState({ open: true, serviceId: service.id, team: teamName })}
        >
          + Add
        </Button>
      </div>
    );
  };

  // All available months in data
  const allAvailableMonths = Array.from(new Set(gridData.map((s: any) => s.date.slice(0, 7)))).sort() as string[];
  
  // Fallback to current month if selected is not in data
  const filteredGridData = gridData.filter((s: any) => s.date.startsWith(selectedMonth));

  // Group filtered data by Week (1-5)
  const groupedByWeek = [1, 2, 3, 4, 5].map(weekNum => {
    return {
      weekNum,
      services: filteredGridData.filter((s: any) => {
        const d = new Date(s.date + 'T00:00:00');
        const w = Math.ceil(d.getDate() / 7);
        return w === weekNum;
      })
    };
  });

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(`${newYear}-${newMonth.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setSelectedMonth(`${newYear}-${newMonth.toString().padStart(2, '0')}`);
  };

  // Upcoming Special Events (Next 3 months, not 'Vietnamese Service')
  const specialEvents = gridData.filter((s: any) => {
    if (s.title.toLowerCase().includes('vietnamese service')) return false;
    if (s.title.toLowerCase().includes('combine')) return false;
    if (s.date < todayStr) return false;
    
    // Check if within 3 months
    const eventDate = new Date(s.date + 'T00:00:00');
    const threeMonthsFromNow = new Date(localDate);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    return eventDate <= threeMonthsFromNow;
  });

  const selectedManageService = gridData.find((s: any) => s.id === manageServiceId);
  const assignedUserIds = selectedManageService 
    ? [...selectedManageService.sound, ...selectedManageService.singer, ...selectedManageService.musician].map((u: any) => u.id)
    : [];
  const availableUsers = assignableUsers.filter((u: any) => !assignedUserIds.includes(u.id));

  // Determine extra members if any (members whose roleDetail doesn't match standard slots)
  const allKnownIds = new Set<string>();
  if (selectedManageService) {
    ROSTER_GROUPS.forEach(g => {
      g.slots.forEach(slot => {
        let a: any = null;
        if (slot.team === 'SOUND') a = selectedManageService.sound[0];
        else if (slot.team === 'SINGER') a = selectedManageService.singer.find((s: any) => s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase());
        else if (slot.team === 'MUSICIAN') a = selectedManageService.musician.find((s: any) => s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase());
        if (a) allKnownIds.add(a.id);
      });
    });
  }

  const extraMembers = selectedManageService
    ? [...selectedManageService.sound, ...selectedManageService.singer, ...selectedManageService.musician].filter((u: any) => !allKnownIds.has(u.id))
    : [];

  return (
    <div>
      {/* HEADER: TABS (Left) & FILTERS (Right) */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8">
        
        {/* TABS */}
        <div className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto border-4 border-brand-black bg-brand-white shadow-[4px_4px_0_0_#111111] overflow-hidden">
          {[
            { id: 'SCHEDULE', label: 'SCHEDULE' },
            { id: 'TABLE', label: 'TABLE VIEW' },
            { id: 'MEMBERS', label: 'MEMBERS' },
            { id: 'STATISTICS', label: 'STATISTICS' }
          ].map((tab, i) => {
            let borderClasses = '';
            if (i === 0) borderClasses = 'border-r-4 border-b-4 md:border-b-0 border-brand-black';
            if (i === 1) borderClasses = 'border-b-4 md:border-b-0 md:border-r-4 border-brand-black';
            if (i === 2) borderClasses = 'border-r-4 border-brand-black';
            if (i === 3) borderClasses = '';

            return (
              <button 
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'STATISTICS') {
                    window.location.href = '/admin/statistics';
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`px-2 sm:px-4 py-3 font-bold uppercase tracking-widest text-xs sm:text-sm transition-colors text-center
                  ${borderClasses} 
                  ${activeTab === tab.id ? 'bg-brand-pink text-brand-white' : 'hover:bg-brand-cream text-brand-black'}
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

      </div>

      {activeTab === 'SCHEDULE' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          
          {/* SPECIAL EVENTS SECTION */}
          {specialEvents.length > 0 && (
            <div className="mb-12">
              <h2 className="editorial-heading text-2xl mb-6 text-brand-pink border-b-4 border-brand-pink inline-block pr-4">★ UPCOMING SPECIAL EVENTS</h2>
              <div className="space-y-8">
                {Object.entries(
                  specialEvents.reduce((groups: any, service: any) => {
                    const d = new Date(service.date + 'T00:00:00');
                    const month = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
                    if (!groups[month]) groups[month] = [];
                    groups[month].push(service);
                    return groups;
                  }, {})
                ).map(([monthName, services]: any) => (
                  <div key={monthName}>
                    <h3 className="font-bold uppercase tracking-widest text-brand-black/50 mb-4 pb-2 border-b border-brand-black/20 text-lg">{monthName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {services.map((service: any) => (
                        <div key={service.id} className="bg-brand-white border-2 border-brand-black p-4 relative flex flex-col justify-between shadow-[4px_4px_0_0_#FFA6C9] transition-transform hover:-translate-y-1">
                          <div>
                            <h3 className="font-bold uppercase tracking-widest text-brand-pink text-xs mb-1">
                              {new Date(service.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </h3>
                            <h2 className="editorial-heading text-xl mb-1 leading-tight text-brand-black">{service.title}</h2>
                            <p className="font-bold opacity-80 mb-3 text-xs">{service.start_time} - {service.end_time}</p>
                          </div>

                          <div className="border-t-2 border-brand-black pt-3 flex flex-col gap-3 mt-auto">
                            {/* Sounds */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold uppercase tracking-widest text-sm">Sound</span>
                                <button className="text-brand-blue font-bold text-sm hover:underline" onClick={() => setModalState({ open: true, serviceId: service.id, team: 'SOUND' })}>+ Add</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {service.sound.length > 0 ? service.sound.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1.5 bg-brand-white border-2 border-brand-black px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_0_#111111] rounded-md transition-transform hover:-translate-y-0.5">
                                    <span className="text-brand-black">{s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}</span>
                                    <button 
                                      onClick={() => handleRemove(service.id, s.id)} 
                                      className="w-4 h-4 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors ml-0.5" 
                                      title="Remove"
                                    >
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                )) : <span className="opacity-50 italic text-sm font-bold">None</span>}
                              </div>
                            </div>
                            
                            {/* Singers */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold uppercase tracking-widest text-sm">Singer</span>
                                <button className="text-brand-blue font-bold text-sm hover:underline" onClick={() => setModalState({ open: true, serviceId: service.id, team: 'SINGER' })}>+ Add</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {service.singer.length > 0 ? service.singer.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1.5 bg-brand-white border-2 border-brand-black px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_0_#111111] rounded-md transition-transform hover:-translate-y-0.5">
                                    <span className="text-brand-black">{s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}</span>
                                    <button 
                                      onClick={() => handleRemove(service.id, s.id)} 
                                      className="w-4 h-4 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors ml-0.5" 
                                      title="Remove"
                                    >
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                )) : <span className="opacity-50 italic text-sm font-bold">None</span>}
                              </div>
                            </div>

                            {/* Musicians */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold uppercase tracking-widest text-sm">Musician</span>
                                <button className="text-brand-blue font-bold text-sm hover:underline" onClick={() => setModalState({ open: true, serviceId: service.id, team: 'MUSICIAN' })}>+ Add</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {service.musician.length > 0 ? service.musician.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1.5 bg-brand-white border-2 border-brand-black px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_0_#111111] rounded-md transition-transform hover:-translate-y-0.5">
                                    <span className="text-brand-black">{s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}</span>
                                    <button 
                                      onClick={() => handleRemove(service.id, s.id)} 
                                      className="w-4 h-4 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors ml-0.5" 
                                      title="Remove"
                                    >
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                )) : <span className="opacity-50 italic text-sm font-bold">None</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REGULAR MONTHLY SCHEDULE */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 className="editorial-heading text-2xl">MONTHLY OVERVIEW</h2>
            <div className="flex justify-between items-center bg-brand-white px-4 py-2 border-4 border-brand-black shadow-[4px_4px_0_0_#111111] min-w-[280px]">
              <button 
                onClick={handlePrevMonth}
                className="font-black text-2xl hover:text-brand-blue hover:scale-110 transition-transform px-2"
              >
                &lt;
              </button>
              <div className="flex-1 flex justify-center">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-none bg-transparent font-bold text-lg outline-none cursor-pointer uppercase text-center"
                >
                  {Array.from(new Set([...allAvailableMonths, selectedMonth])).sort().map((m: any) => {
                    const [year, month] = m.split('-');
                    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return (
                      <option key={m} value={m}>
                        {dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button 
                onClick={handleNextMonth}
                className="font-black text-2xl hover:text-brand-blue hover:scale-110 transition-transform px-2"
              >
                &gt;
              </button>
            </div>
          </div>
          <div className="space-y-12">
            {filteredGridData.length === 0 ? (
              <div className="p-8 text-center font-bold text-xl opacity-50 border-4 border-brand-black bg-brand-white border-dashed">
                No events found for this month.
              </div>
            ) : (
              groupedByWeek.map(week => {
                if (week.services.length === 0) return null;
                
                return (
                  <div key={week.weekNum} className="relative">
                    <h3 className="absolute -top-4 left-4 bg-brand-blue text-brand-white font-bold px-4 py-1 border-4 border-brand-black z-10 shadow-[4px_4px_0_0_#111111] transform -rotate-1">
                      WEEK {week.weekNum}
                    </h3>
                    <div className="overflow-x-auto bg-brand-white border-4 border-brand-black shadow-[6px_6px_0_0_#111111] pt-6">
                      <div className="min-w-[800px]">
                        {week.services.map((service: any) => (
                          <div key={service.id} className="flex border-b-4 border-brand-black last:border-b-0 hover:bg-brand-cream/20 transition-colors">
                            <div className="w-1/4 p-4 border-r-4 border-brand-black bg-brand-cream flex flex-col justify-center">
                              <h3 className="font-bold text-brand-blue uppercase tracking-widest">{new Date(service.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                              <p className="font-black text-xl">{service.start_time}</p>
                              <p className="text-sm font-bold opacity-70 mt-1">{service.title}</p>
                            </div>
                            
                            {renderTeamCell(service, 'SOUND', service.sound)}
                            {renderTeamCell(service, 'SINGER', service.singer)}
                            {renderTeamCell(service, 'MUSICIAN', service.musician)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'TABLE' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white overflow-hidden p-4 border-2 border-brand-black">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold uppercase">
                  Schedule {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <p className="text-xs font-bold text-brand-black/60 mt-1">
                  (Bấm vào để chỉnh sửa)
                </p>
              </div>
              <div className="flex justify-between items-center bg-brand-white px-4 py-2 border-4 border-brand-black shadow-[4px_4px_0_0_#111111] min-w-[280px]">
                <button 
                  onClick={handlePrevMonth}
                  className="font-black text-2xl hover:text-brand-blue hover:scale-110 transition-transform px-2"
                >
                  &lt;
                </button>
                <div className="flex-1 flex justify-center">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border-none bg-transparent font-bold text-lg outline-none cursor-pointer uppercase text-center"
                  >
                    {Array.from(new Set([...allAvailableMonths, selectedMonth])).sort().map((m: any) => {
                      const [year, month] = m.split('-');
                      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
                      return (
                        <option key={m} value={m}>
                          {dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button 
                  onClick={handleNextMonth}
                  className="font-black text-2xl hover:text-brand-blue hover:scale-110 transition-transform px-2"
                >
                  &gt;
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-brand-black">
                    <th className="p-2 border-r-2 border-brand-black w-1/5">Sự kiện</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/6">Ngày</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/4">Ca sỹ</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/4">Nhạc công</th>
                    <th className="p-2 w-1/6">Âm thanh</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGridData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center font-bold opacity-50">No events found</td>
                    </tr>
                  ) : (
                    filteredGridData.map((s: any) => {
                      const dateObj = new Date(s.date + 'T00:00:00');
                      const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
                      const singers = s.singer.map((u: any) => u.role_detail ? `${u.full_name} (${u.role_detail})` : u.full_name).join(', ');
                      const musicians = s.musician.map((u: any) => u.role_detail ? `${u.full_name} (${u.role_detail})` : u.full_name).join(', ');
                      const sounds = s.sound.map((u: any) => u.role_detail ? `${u.full_name} (${u.role_detail})` : u.full_name).join(', ');
                      
                      return (
                        <tr 
                          key={s.id} 
                          onClick={() => setManageServiceId(s.id)}
                          className="border-b border-brand-black last:border-b-0 hover:bg-brand-pink/10 transition-colors cursor-pointer group"
                          title="Bấm để phân công & chỉnh sửa"
                        >
                          <td className="p-2 border-r border-brand-black font-bold">
                            <div className="flex items-center justify-between gap-2">
                              <span>{s.title || ''}</span>
                              <span className="text-[10px] bg-brand-pink text-white font-extrabold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-[1px_1px_0_0_#111111]">
                                ✏️ Edit
                              </span>
                            </div>
                          </td>
                          <td className="p-2 border-r border-brand-black text-center whitespace-nowrap">{dateStr}</td>
                          <td className="p-2 border-r border-brand-black">{singers || <span className="opacity-40 italic">None</span>}</td>
                          <td className="p-2 border-r border-brand-black">{musicians || <span className="opacity-40 italic">None</span>}</td>
                          <td className="p-2">{sounds || <span className="opacity-40 italic">None</span>}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 text-center opacity-70 font-bold text-sm">
            (You can easily take a screenshot of this table)
          </div>
        </div>
      )}

      {activeTab === 'MEMBERS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-brand-white border-4 border-brand-black overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-brand-pink text-brand-white font-bold uppercase tracking-widest border-b-8 border-brand-black">
                <tr>
                  <th className="p-3 sm:p-4 border-r-4 border-brand-black">Name</th>
                  <th className="p-3 sm:p-4 border-r-4 border-brand-black">Email</th>
                  <th className="p-3 sm:p-4 border-r-4 border-brand-black">Role</th>
                  <th className="p-3 sm:p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {allUsers.map((u: any) => (
                  <tr key={u.id} className="border-b-4 border-brand-black last:border-b-0 hover:bg-brand-cream transition-colors">
                    <td className="p-3 sm:p-4 border-r-4 border-brand-black">{u.full_name}</td>
                    <td className="p-3 sm:p-4 border-r-4 border-brand-black opacity-70 text-sm">{u.email}</td>
                    <td className="p-3 sm:p-4 border-r-4 border-brand-black">
                      <span className={`px-2 py-1 border-2 border-brand-black ${u.role === 'ADMIN' ? 'bg-brand-blue text-brand-white' : 'bg-brand-white'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4">
                      {u.role !== 'ADMIN' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-7 border-2 border-brand-red text-brand-red hover:bg-brand-red hover:text-brand-white"
                          onClick={() => setDeleteUserModal({ open: true, userId: u.id, userName: u.full_name })}
                        >
                          DELETE
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <Dialog.Root open={modalState.open} onOpenChange={(open) => !open && setModalState({ open: false, serviceId: '', team: '' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-[95vw] max-w-xl translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] max-h-[80vh] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            <Dialog.Title className="editorial-heading text-2xl mb-4">Assign to {modalState.team}</Dialog.Title>
            <div className="flex-1 overflow-y-auto border-4 border-brand-black bg-brand-white p-2 mb-4 space-y-2">
              {assignableUsers.map((u: any) => (
                <div key={u.id} className="flex justify-between items-center p-2 hover:bg-brand-cream border-b-2 border-brand-black last:border-0">
                  <span className="font-bold">{u.full_name}</span>
                  <div className="flex gap-2 items-center">
                    {modalState.team === 'SINGER' && (
                      <select className="border-2 border-brand-black px-2 py-1 text-xs font-bold bg-brand-white shadow-[2px_2px_0_0_#111111] hover:shadow-[2px_2px_0_0_#0038FF] focus:outline-none focus:shadow-[2px_2px_0_0_#FFA6C9] transition-all cursor-pointer outline-none" value={roleDetails[u.id] || ''} onChange={e => setRoleDetails({...roleDetails, [u.id]: e.target.value})}>
                        <option value="">-Select-</option>
                        <option value="Vocal 1">Vocal 1</option>
                        <option value="Vocal 2">Vocal 2</option>
                        <option value="Vocal 3">Vocal 3</option>
                      </select>
                    )}
                    {modalState.team === 'MUSICIAN' && (
                      <select className="border-2 border-brand-black px-2 py-1 text-xs font-bold bg-brand-white shadow-[2px_2px_0_0_#111111] hover:shadow-[2px_2px_0_0_#0038FF] focus:outline-none focus:shadow-[2px_2px_0_0_#FFA6C9] transition-all cursor-pointer outline-none" value={roleDetails[u.id] || ''} onChange={e => setRoleDetails({...roleDetails, [u.id]: e.target.value})}>
                        <option value="">-Select-</option>
                        <option value="E-Guitar">E-Guitar</option>
                        <option value="Acoustic Guitar">Acoustic Guitar</option>
                        <option value="Bass">Bass</option>
                        <option value="Drum">Drum</option>
                        <option value="Piano">Piano</option>
                      </select>
                    )}
                    <Button size="sm" onClick={() => handleAssign(u.id)} disabled={loading}>Assign</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Dialog.Close asChild>
                <Button variant="ghost">CLOSE</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* MANAGE SERVICE MODAL (FROM TABLE VIEW) */}
      <Dialog.Root open={!!manageServiceId} onOpenChange={(open) => {
        if (!open) {
          setManageServiceId(null);
          setSlotAssigns({});
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-[95vw] max-w-lg translate-x-[-50%] translate-y-[-50%] bg-white border-4 border-brand-black p-6 shadow-[8px_8px_0_0_#111111] max-h-[85vh] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            {selectedManageService && (
              <>
                <div className="mb-4 pb-3 border-b-2 border-brand-black">
                  <Dialog.Title className="editorial-heading text-2xl text-brand-black">
                    QUẢN LÝ PHÂN CÔNG
                  </Dialog.Title>
                  <p className="font-bold text-xs text-brand-black/70 mt-0.5">
                    {selectedManageService.title} • {(() => {
                      const d = new Date(selectedManageService.date + 'T00:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                    })()} ({selectedManageService.start_time} - {selectedManageService.end_time})
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {ROSTER_GROUPS.map((group) => {
                    const assignedInGroup = group.slots.filter(slot => {
                      if (slot.team === 'SOUND') return selectedManageService.sound.length > 0;
                      if (slot.team === 'SINGER') return selectedManageService.singer.some((s: any) => s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase());
                      if (slot.team === 'MUSICIAN') return selectedManageService.musician.some((s: any) => s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase());
                      return false;
                    }).length;

                    return (
                      <div key={group.name} className="border-2 border-brand-black bg-white rounded-lg overflow-hidden shadow-[2px_2px_0_0_#111111]">
                        <div className={`${group.headerBg} px-3.5 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between border-b-2 border-brand-black`}>
                          <span>{group.name}</span>
                          <span className="text-[11px] font-extrabold opacity-80">
                            ({assignedInGroup}/{group.slots.length})
                          </span>
                        </div>
                        <div className="p-2.5 sm:p-3 space-y-2 bg-brand-cream/30">
                          {group.slots.map((slot) => {
                            let assignee: any = null;
                            if (slot.team === 'SOUND') {
                              assignee = selectedManageService.sound[0] || null;
                            } else if (slot.team === 'SINGER') {
                              assignee = selectedManageService.singer.find((s: any) => 
                                s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase()
                              ) || null;
                            } else if (slot.team === 'MUSICIAN') {
                              assignee = selectedManageService.musician.find((s: any) => 
                                s.role_detail?.toLowerCase() === slot.roleDetail?.toLowerCase()
                              ) || null;
                            }

                            return assignee ? (
                              /* ASSIGNED CARD (MATCHING USER SCREENSHOT) */
                              <div 
                                key={slot.key} 
                                className="flex items-center justify-between bg-white border-2 border-brand-black px-3 py-2 rounded-lg shadow-[2px_2px_0_0_#111111]"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="font-black text-sm text-brand-black flex items-center gap-1.5 truncate">
                                    <span>✓</span>
                                    <span>{assignee.full_name}</span>
                                  </span>
                                  <span className="bg-brand-black/5 text-brand-black/70 px-2 py-0.5 rounded text-[11px] font-extrabold border border-brand-black/15 shrink-0">
                                    {slot.roleDetail || slot.label}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => handleRemove(selectedManageService.id, assignee.id)}
                                  className="w-5 h-5 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors ml-2 shrink-0"
                                  title="Gỡ người này"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              /* EMPTY SLOT */
                              <div 
                                key={slot.key} 
                                className="flex items-center justify-between bg-white/70 border-2 border-dashed border-brand-black/25 px-3 py-1.5 rounded-lg"
                              >
                                <span className="font-bold text-xs text-brand-black/60">
                                  {slot.label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <select
                                    className="border-2 border-brand-black text-xs font-bold py-1 px-2 bg-white rounded shadow-[1px_1px_0_0_#111111] max-w-[140px] sm:max-w-[180px] focus:outline-none"
                                    value={slotAssigns[slot.key] || ''}
                                    onChange={(e) => setSlotAssigns(prev => ({ ...prev, [slot.key]: e.target.value }))}
                                  >
                                    <option value="">-- Chọn người --</option>
                                    {availableUsers.map((u: any) => (
                                      <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    disabled={loading || !slotAssigns[slot.key]}
                                    onClick={() => handleSlotAssign(slot)}
                                    className="text-xs h-7 px-2.5 font-bold shadow-[1px_1px_0_0_#111111] rounded"
                                  >
                                    Gán
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* EXTRA MEMBERS (IF ANY) */}
                  {extraMembers.length > 0 && (
                    <div className="border-2 border-brand-black bg-white rounded-lg overflow-hidden shadow-[2px_2px_0_0_#111111]">
                      <div className="bg-brand-black text-white px-3.5 py-2 font-black text-xs uppercase tracking-wider border-b-2 border-brand-black">
                        THÀNH VIÊN KHÁC
                      </div>
                      <div className="p-2.5 sm:p-3 space-y-2 bg-brand-cream/30">
                        {extraMembers.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between bg-white border-2 border-brand-black px-3 py-2 rounded-lg shadow-[2px_2px_0_0_#111111]">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-black text-sm text-brand-black flex items-center gap-1.5 truncate">
                                <span>✓</span>
                                <span>{u.full_name}</span>
                              </span>
                              {u.role_detail && (
                                <span className="bg-brand-black/5 text-brand-black/70 px-2 py-0.5 rounded text-[11px] font-extrabold border border-brand-black/15 shrink-0">
                                  {u.role_detail}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleRemove(selectedManageService.id, u.id)}
                              className="w-5 h-5 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors ml-2 shrink-0"
                              title="Gỡ người này"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t-2 border-brand-black mt-4">
                  <Dialog.Close asChild>
                    <Button variant="ghost">ĐÓNG</Button>
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* REMOVE MODAL */}
      <Dialog.Root open={removeModalState.open} onOpenChange={(open) => !open && setRemoveModalState({ open: false, serviceId: '', userId: '' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[70] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[70] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            <Dialog.Title className="editorial-heading text-3xl mb-4 text-brand-red">CONFIRM REMOVAL</Dialog.Title>
            <Dialog.Description className="text-lg font-bold mb-8">
              Are you sure you want to remove this member from the service? This action cannot be undone.
            </Dialog.Description>
            <div className="flex justify-end gap-4">
              <Dialog.Close asChild>
                <Button variant="ghost">CANCEL</Button>
              </Dialog.Close>
              <Button variant="primary" className="bg-brand-red shadow-[4px_4px_0_0_#111111]" onClick={confirmRemove}>
                YES, REMOVE
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* DELETE USER MODAL */}
      <Dialog.Root open={deleteUserModal.open} onOpenChange={(open) => !open && setDeleteUserModal({ open: false, userId: '', userName: '' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[70] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[70] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            <Dialog.Title className="editorial-heading text-3xl mb-4 text-brand-red">DELETE USER</Dialog.Title>
            <Dialog.Description className="text-lg font-bold mb-8">
              Are you sure you want to delete {deleteUserModal.userName}? This will remove all their registrations and cannot be undone.
            </Dialog.Description>
            <div className="flex justify-end gap-4">
              <Dialog.Close asChild>
                <Button variant="ghost">CANCEL</Button>
              </Dialog.Close>
              <Button variant="primary" className="bg-brand-red shadow-[4px_4px_0_0_#111111]" onClick={confirmDeleteUser}>
                YES, DELETE
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}


