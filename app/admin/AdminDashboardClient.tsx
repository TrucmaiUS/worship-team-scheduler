'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminAssignMember, adminRemoveAssignment } from './actions';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';

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
  const [roleDetails, setRoleDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    await adminAssignMember(modalState.serviceId, userId, modalState.team, detail);
    setModalState({ open: false, serviceId: '', team: '' });
    setRoleDetails({});
    setLoading(false);
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

  const renderTeamCell = (service: any, teamName: string, members: any[]) => {
    return (
      <div className="flex-1 p-4 border-r-4 border-brand-black last:border-r-0 min-w-[200px]">
        <h4 className="font-bold border-b-2 border-brand-black pb-1 mb-2">{teamName}</h4>
        <div className="space-y-1 mb-4">
          {members.length === 0 ? (
            <div className="text-sm font-bold text-brand-red">⚠ --</div>
          ) : (
            members.map(u => (
              <div key={u.id} className="text-sm font-bold flex justify-between group">
                  <span>✓ {u.role_detail ? `${u.full_name} (${u.role_detail})` : u.full_name}</span>
                <button 
                  onClick={() => handleRemove(service.id, u.id)}
                  className="text-brand-red opacity-0 group-hover:opacity-100 hover:underline"
                >
                  X
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

  return (
    <div>
      {/* HEADER: TABS (Left) & FILTERS (Right) */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        {/* TABS */}
        <div className="flex gap-4">
          <Button 
            variant={activeTab === 'SCHEDULE' ? 'primary' : 'outline'} 
            className={`border-4 ${activeTab === 'SCHEDULE' ? 'rotate-1 shadow-[4px_4px_0_0_#111111]' : ''}`}
            onClick={() => setActiveTab('SCHEDULE')}
          >
            SCHEDULE
          </Button>
          <Button 
            variant={activeTab === 'TABLE' ? 'primary' : 'outline'} 
            className={`border-4 ${activeTab === 'TABLE' ? 'rotate-1 shadow-[4px_4px_0_0_#111111]' : ''}`}
            onClick={() => setActiveTab('TABLE')}
          >
            TABLE VIEW
          </Button>
          <Button 
            variant={activeTab === 'MEMBERS' ? 'sticker' : 'outline'}
            className={`border-4 ${activeTab === 'MEMBERS' ? '-rotate-1 shadow-[4px_4px_0_0_#111111]' : ''}`}
            onClick={() => setActiveTab('MEMBERS')}
          >
            MEMBERS
          </Button>
        </div>

        {/* FILTERS */}
        {(activeTab === 'SCHEDULE' || activeTab === 'TABLE') && (
          <div className="flex gap-4 items-center bg-brand-white px-4 py-2 border-4 border-brand-black shadow-[4px_4px_0_0_#111111]">
            <button 
              onClick={handlePrevMonth}
              className="font-black text-xl hover:text-brand-blue hover:scale-110 transition-transform"
            >
              &lt;
            </button>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-transparent font-bold text-lg outline-none cursor-pointer uppercase text-center min-w-[140px]"
            >
              {/* Ensure selected month is in options even if no data */}
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
            <button 
              onClick={handleNextMonth}
              className="font-black text-xl hover:text-brand-blue hover:scale-110 transition-transform"
            >
              &gt;
            </button>
          </div>
        )}
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
                              <div className="flex flex-wrap gap-1">
                                {service.sound.length > 0 ? service.sound.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1 bg-brand-cream px-1.5 py-0.5 border border-brand-black text-sm font-bold">
                                    {s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}
                                    <button onClick={() => handleRemove(service.id, s.id)} className="text-brand-red ml-0.5 hover:scale-125 transition-transform" title="Remove">✕</button>
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
                              <div className="flex flex-wrap gap-1">
                                {service.singer.length > 0 ? service.singer.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1 bg-brand-cream px-1.5 py-0.5 border border-brand-black text-sm font-bold">
                                    {s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}
                                    <button onClick={() => handleRemove(service.id, s.id)} className="text-brand-red ml-0.5 hover:scale-125 transition-transform" title="Remove">✕</button>
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
                              <div className="flex flex-wrap gap-1">
                                {service.musician.length > 0 ? service.musician.map((s:any) => (
                                  <span key={s.id} className="inline-flex items-center gap-1 bg-brand-cream px-1.5 py-0.5 border border-brand-black text-sm font-bold">
                                    {s.role_detail ? `${s.full_name} (${s.role_detail})` : s.full_name}
                                    <button onClick={() => handleRemove(service.id, s.id)} className="text-brand-red ml-0.5 hover:scale-125 transition-transform" title="Remove">✕</button>
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
          <h2 className="editorial-heading text-2xl mb-6">MONTHLY OVERVIEW</h2>
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
            <h2 className="text-xl font-bold text-center mb-4 uppercase">
              Schedule {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
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
                        <tr key={s.id} className="border-b border-brand-black last:border-b-0">
                          <td className="p-2 border-r border-brand-black font-bold">{s.title || ''}</td>
                          <td className="p-2 border-r border-brand-black text-center">{dateStr}</td>
                          <td className="p-2 border-r border-brand-black">{singers}</td>
                          <td className="p-2 border-r border-brand-black">{musicians}</td>
                          <td className="p-2">{sounds}</td>
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
            <table className="w-full text-left">
              <thead className="bg-brand-pink text-brand-white font-bold uppercase tracking-widest border-b-8 border-brand-black">
                <tr>
                  <th className="p-4 border-r-4 border-brand-black">Name</th>
                  <th className="p-4 border-r-4 border-brand-black">Email</th>
                  <th className="p-4">Role</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {allUsers.map((u: any) => (
                  <tr key={u.id} className="border-b-4 border-brand-black last:border-b-0 hover:bg-brand-cream transition-colors">
                    <td className="p-4 border-r-4 border-brand-black">{u.full_name}</td>
                    <td className="p-4 border-r-4 border-brand-black opacity-70">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 border-2 border-brand-black ${u.role === 'ADMIN' ? 'bg-brand-blue text-brand-white' : 'bg-brand-white'}`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      {/* REMOVE MODAL */}
      <Dialog.Root open={removeModalState.open} onOpenChange={(open) => !open && setRemoveModalState({ open: false, serviceId: '', userId: '' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
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

    </div>
  );
}


