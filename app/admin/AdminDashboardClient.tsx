'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { adminAssignMember, adminRemoveAssignment, adminDeleteUser, adminDeleteService } from './actions';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';

const ROSTER_GROUPS = [
  {
    name: 'SINGER',
    headerBg: 'bg-brand-pink text-brand-white',
    slots: [
      { key: 'vocal_1', label: 'Vocal 1', team: 'SINGER', roleDetail: 'Vocal 1' },
      { key: 'vocal_2', label: 'Vocal 2', team: 'SINGER', roleDetail: 'Vocal 2' },
      { key: 'vocal_3', label: 'Vocal 3', team: 'SINGER', roleDetail: 'Vocal 3' },
    ]
  },
  {
    name: 'MUSICIAN',
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
    name: 'SOUND TEAM',
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
  const [deleteEventModal, setDeleteEventModal] = useState<{ open: boolean, serviceId: string, eventTitle: string, eventDate: string }>({
    open: false,
    serviceId: '',
    eventTitle: '',
    eventDate: ''
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

  const currentModalService = gridData.find((s: any) => s.id === modalState.serviceId);

  const getAssignedRoleInModal = (userId: string) => {
    if (!currentModalService) return null;
    const inSound = currentModalService.sound?.find((m: any) => m.id === userId);
    if (inSound) return inSound.role_detail ? `Sound (${inSound.role_detail})` : 'Sound';
    const inSinger = currentModalService.singer?.find((m: any) => m.id === userId);
    if (inSinger) return inSinger.role_detail || 'Singer';
    const inMusician = currentModalService.musician?.find((m: any) => m.id === userId);
    if (inMusician) return inMusician.role_detail || 'Musician';
    return null;
  };

  const takenSingerRoles = (currentModalService?.singer || [])
    .map((s: any) => (s.role_detail || '').toLowerCase())
    .filter(Boolean);

  const takenMusicianRoles = (currentModalService?.musician || [])
    .map((m: any) => (m.role_detail || '').toLowerCase())
    .filter(Boolean);

  const handleAssign = async (userId: string) => {
    const existingRole = getAssignedRoleInModal(userId);
    if (existingRole) {
      toast.error('This member is already assigned to this service!');
      return;
    }
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
      toast.success(`Assigned ${slot.label} successfully!`);
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

  const confirmDeleteEvent = async () => {
    try {
      setLoading(true);
      const res = await adminDeleteService(deleteEventModal.serviceId);
      if (res?.error) throw new Error(res.error);
      toast.success('Event deleted successfully!');
      if (manageServiceId === deleteEventModal.serviceId) {
        setManageServiceId(null);
      }
    } catch (e: any) {
      toast.error('Failed to delete event: ' + e.message);
    } finally {
      setLoading(false);
      setDeleteEventModal({ open: false, serviceId: '', eventTitle: '', eventDate: '' });
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
                  className="w-4 h-4 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors shrink-0 ml-1"
                  title="Remove"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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

  // Upcoming Special Events (Next 1 month, not 'Vietnamese Service')
  const specialEvents = gridData.filter((s: any) => {
    if (s.title.toLowerCase().includes('vietnamese service')) return false;
    if (s.title.toLowerCase().includes('combine')) return false;
    if (s.date < todayStr) return false;
    
    // Check if within 1 month
    const eventDate = new Date(s.date + 'T00:00:00');
    const oneMonthFromNow = new Date(localDate);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    
    return eventDate <= oneMonthFromNow;
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
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h3 className="font-bold uppercase tracking-widest text-brand-pink text-xs">
                                {new Date(service.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </h3>
                              <button
                                onClick={() => setDeleteEventModal({
                                  open: true,
                                  serviceId: service.id,
                                  eventTitle: service.title,
                                  eventDate: service.date
                                })}
                                className="w-5 h-5 rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white flex items-center justify-center transition-colors shrink-0"
                                title="Delete Event"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
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
                            <div className="w-1/4 p-4 border-r-4 border-brand-black bg-brand-cream flex flex-col justify-between">
                              <div>
                                <h3 className="font-bold text-brand-blue uppercase tracking-widest">{new Date(service.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                                <p className="font-black text-xl">{service.start_time}</p>
                                <p className="text-sm font-bold opacity-70 mt-1">{service.title}</p>
                              </div>
                              <button
                                onClick={() => setDeleteEventModal({
                                  open: true,
                                  serviceId: service.id,
                                  eventTitle: service.title,
                                  eventDate: service.date
                                })}
                                className="mt-3 text-xs font-bold text-brand-red hover:underline flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity w-fit"
                                title="Delete Event"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Event
                              </button>
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
                  (Click to edit)
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
                    <th className="p-2 border-r-2 border-brand-black w-1/5">Event</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/6">Date</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/4">Singer</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/4">Musician</th>
                    <th className="p-2 border-r-2 border-brand-black w-1/6">Sound</th>
                    <th className="p-2 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGridData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center font-bold opacity-50">No events found</td>
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
                          className="border-b border-brand-black last:border-b-0 hover:bg-brand-pink/10 transition-colors group"
                        >
                          <td className="p-2 border-r border-brand-black font-bold cursor-pointer" onClick={() => setManageServiceId(s.id)} title="Click to edit">
                            <div className="flex items-center justify-between gap-2">
                              <span>{s.title || ''}</span>
                              <span className="text-[10px] bg-brand-pink text-white font-extrabold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-[1px_1px_0_0_#111111]">
                                Edit
                              </span>
                            </div>
                          </td>
                          <td className="p-2 border-r border-brand-black text-center whitespace-nowrap cursor-pointer" onClick={() => setManageServiceId(s.id)} title="Click to edit">{dateStr}</td>
                          <td className="p-2 border-r border-brand-black cursor-pointer" onClick={() => setManageServiceId(s.id)} title="Click to edit">{singers || <span className="opacity-40 italic">None</span>}</td>
                          <td className="p-2 border-r border-brand-black cursor-pointer" onClick={() => setManageServiceId(s.id)} title="Click to edit">{musicians || <span className="opacity-40 italic">None</span>}</td>
                          <td className="p-2 border-r border-brand-black cursor-pointer" onClick={() => setManageServiceId(s.id)} title="Click to edit">{sounds || <span className="opacity-40 italic">None</span>}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteEventModal({
                                  open: true,
                                  serviceId: s.id,
                                  eventTitle: s.title,
                                  eventDate: s.date
                                });
                              }}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white transition-colors"
                              title="Delete Event"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
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
                    <td className="p-3 sm:p-4 border-r-4 border-brand-black">
                      <div className="flex items-center gap-3">
                        <Avatar 
                          name={u.full_name} 
                          imgUrl={u.avatar_url} 
                          className="w-10 h-10 text-xs sm:text-sm shrink-0 shadow-[2px_2px_0_0_#111111]" 
                        />
                        <span className="truncate">{u.full_name}</span>
                      </div>
                    </td>
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
            <div className="mb-4">
              <Dialog.Title className="editorial-heading text-2xl">Assign to {modalState.team}</Dialog.Title>
              {currentModalService && (
                <p className="font-bold text-xs text-brand-black/70 mt-1">
                  {currentModalService.title} • {new Date(currentModalService.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ({currentModalService.start_time} - {currentModalService.end_time})
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto border-4 border-brand-black bg-brand-white p-2 mb-4 space-y-2">
              {assignableUsers.map((u: any) => {
                const assignedRole = getAssignedRoleInModal(u.id);
                const isAssigned = !!assignedRole;

                return (
                  <div 
                    key={u.id} 
                    className={`flex justify-between items-center p-2 border-b-2 border-brand-black last:border-0 transition-colors ${
                      isAssigned ? 'bg-brand-black/5 opacity-50' : 'hover:bg-brand-cream'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Avatar 
                        name={u.full_name} 
                        imgUrl={u.avatar_url} 
                        className="w-7 h-7 text-[10px] shrink-0 shadow-[1px_1px_0_0_#111111]" 
                      />
                      <span className={`font-bold ${isAssigned ? 'text-brand-black/60' : 'text-brand-black'}`}>
                        {u.full_name}
                      </span>
                      {isAssigned && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-brand-black/10 text-brand-black/70 border border-brand-black/20 shrink-0">
                          {assignedRole}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      {modalState.team === 'SINGER' && (
                        <select 
                          disabled={isAssigned || loading}
                          className="border-2 border-brand-black px-2 py-1 text-xs font-bold bg-brand-white shadow-[2px_2px_0_0_#111111] hover:shadow-[2px_2px_0_0_#0038FF] focus:outline-none focus:shadow-[2px_2px_0_0_#FFA6C9] transition-all cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none" 
                          value={roleDetails[u.id] || ''} 
                          onChange={e => setRoleDetails({...roleDetails, [u.id]: e.target.value})}
                        >
                          <option value="">-Select-</option>
                          <option value="Vocal 1" disabled={takenSingerRoles.includes('vocal 1')}>
                            Vocal 1 {takenSingerRoles.includes('vocal 1') ? '(Taken)' : ''}
                          </option>
                          <option value="Vocal 2" disabled={takenSingerRoles.includes('vocal 2')}>
                            Vocal 2 {takenSingerRoles.includes('vocal 2') ? '(Taken)' : ''}
                          </option>
                          <option value="Vocal 3" disabled={takenSingerRoles.includes('vocal 3')}>
                            Vocal 3 {takenSingerRoles.includes('vocal 3') ? '(Taken)' : ''}
                          </option>
                        </select>
                      )}
                      {modalState.team === 'MUSICIAN' && (
                        <select 
                          disabled={isAssigned || loading}
                          className="border-2 border-brand-black px-2 py-1 text-xs font-bold bg-brand-white shadow-[2px_2px_0_0_#111111] hover:shadow-[2px_2px_0_0_#0038FF] focus:outline-none focus:shadow-[2px_2px_0_0_#FFA6C9] transition-all cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none" 
                          value={roleDetails[u.id] || ''} 
                          onChange={e => setRoleDetails({...roleDetails, [u.id]: e.target.value})}
                        >
                          <option value="">-Select-</option>
                          <option value="E-Guitar" disabled={takenMusicianRoles.includes('e-guitar')}>
                            E-Guitar {takenMusicianRoles.includes('e-guitar') ? '(Taken)' : ''}
                          </option>
                          <option value="Acoustic Guitar" disabled={takenMusicianRoles.includes('acoustic guitar')}>
                            Acoustic Guitar {takenMusicianRoles.includes('acoustic guitar') ? '(Taken)' : ''}
                          </option>
                          <option value="Bass" disabled={takenMusicianRoles.includes('bass')}>
                            Bass {takenMusicianRoles.includes('bass') ? '(Taken)' : ''}
                          </option>
                          <option value="Drum" disabled={takenMusicianRoles.includes('drum')}>
                            Drum {takenMusicianRoles.includes('drum') ? '(Taken)' : ''}
                          </option>
                          <option value="Piano" disabled={takenMusicianRoles.includes('piano')}>
                            Piano {takenMusicianRoles.includes('piano') ? '(Taken)' : ''}
                          </option>
                        </select>
                      )}
                      <Button 
                        size="sm" 
                        onClick={() => handleAssign(u.id)} 
                        disabled={loading || isAssigned}
                        variant={isAssigned ? "outline" : "primary"}
                        className={isAssigned ? "opacity-50 cursor-not-allowed border-2 border-brand-black/30 text-xs h-7 pointer-events-none" : "text-xs h-7"}
                      >
                        {isAssigned ? 'Assigned' : 'Assign'}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
                <div className="mb-4 pb-3 border-b-2 border-brand-black flex justify-between items-start gap-2">
                  <div>
                    <Dialog.Title className="editorial-heading text-2xl text-brand-black">
                      MANAGE ROSTER
                    </Dialog.Title>
                    <p className="font-bold text-xs text-brand-black/70 mt-0.5">
                      {selectedManageService.title} • {(() => {
                        const d = new Date(selectedManageService.date + 'T00:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                      })()} ({selectedManageService.start_time} - {selectedManageService.end_time})
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteEventModal({
                      open: true,
                      serviceId: selectedManageService.id,
                      eventTitle: selectedManageService.title,
                      eventDate: selectedManageService.date
                    })}
                    className="border-2 border-brand-red text-brand-red hover:bg-brand-red hover:text-white text-xs h-7 px-2 font-bold shrink-0"
                  >
                    Delete Event
                  </Button>
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
                        <div className={`${group.headerBg} px-3.5 py-2 uppercase tracking-wide flex items-center justify-between border-b-2 border-brand-black`}>
                          <span className="text-base sm:text-lg font-bold">{group.name}</span>
                          <span className="text-xs font-bold opacity-85">
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
                                  <Avatar 
                                    name={assignee.full_name} 
                                    imgUrl={assignee.avatar_url} 
                                    className="w-6 h-6 text-[10px] shrink-0 shadow-[1px_1px_0_0_#111111]" 
                                  />
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
                                  title="Remove"
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
                                    <option value="">Select</option>
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
                                    Assign
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
                      <div className="bg-brand-black text-white px-3.5 py-2 uppercase tracking-wide border-b-2 border-brand-black">
                        <span className="text-base sm:text-lg font-bold">OTHER MEMBERS</span>
                      </div>
                      <div className="p-2.5 sm:p-3 space-y-2 bg-brand-cream/30">
                        {extraMembers.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between bg-white border-2 border-brand-black px-3 py-2 rounded-lg shadow-[2px_2px_0_0_#111111]">
                            <div className="flex items-center gap-2 truncate">
                              <Avatar 
                                name={u.full_name} 
                                imgUrl={u.avatar_url} 
                                className="w-6 h-6 text-[10px] shrink-0 shadow-[1px_1px_0_0_#111111]" 
                              />
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
                              title="Remove"
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
                    <Button variant="ghost">CLOSE</Button>
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

      {/* DELETE EVENT MODAL */}
      <Dialog.Root open={deleteEventModal.open} onOpenChange={(open) => !open && setDeleteEventModal({ open: false, serviceId: '', eventTitle: '', eventDate: '' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[80] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[80] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            <Dialog.Title className="editorial-heading text-3xl mb-4 text-brand-red">DELETE EVENT</Dialog.Title>
            <Dialog.Description className="text-base font-bold mb-8">
              Are you sure you want to delete <span className="text-brand-red font-black">"{deleteEventModal.eventTitle}"</span> ({deleteEventModal.eventDate})? This will permanently remove the event and all assigned roles. This action cannot be undone.
            </Dialog.Description>
            <div className="flex justify-end gap-4">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={loading}>CANCEL</Button>
              </Dialog.Close>
              <Button 
                variant="primary" 
                className="bg-brand-red shadow-[4px_4px_0_0_#111111]" 
                disabled={loading}
                onClick={confirmDeleteEvent}
              >
                {loading ? 'DELETING...' : 'YES, DELETE EVENT'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}


