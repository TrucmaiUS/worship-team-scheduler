'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { joinService, changeRole, cancelRegistration } from '@/app/actions/schedule';
import { getDay, getDaysInMonth, startOfMonth, format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';

export default function ClientSchedule({ upcomingServices, monthlyServices, registrationsMap, userId, userName, avatarUrl, offset, currentMonthDate }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [singerRole, setSingerRole] = useState('');
  const [musicianRole, setMusicianRole] = useState('');
  const [cancelModalState, setCancelModalState] = useState<{ open: boolean }>({ open: false });
  const [modalState, setModalState] = useState<{ open: boolean, serviceId: string, currentTeam: string | null, currentRoleDetail: string | null }>({
    open: false,
    serviceId: '',
    currentTeam: null, currentRoleDetail: null
  });

  const monthDate = new Date(currentMonthDate);
  const monthName = format(monthDate, 'MMMM yyyy');
  const daysInMonth = getDaysInMonth(monthDate);
  const firstDayOfMonth = getDay(startOfMonth(monthDate)); // 0 = Sunday

  const handleNavigate = (newOffset: number) => {
    router.push(`/schedule?offset=${newOffset}`, { scroll: false });
  };

  const handleAction = async (team: string, roleDetail = '') => {
    if ((team === 'SINGER' || team === 'MUSICIAN') && !roleDetail) {
      toast.error('Please select a specific role before registering.');
      return;
    }
    setLoading(true);
    try {
      if (modalState.currentTeam) {
        await changeRole(modalState.serviceId, team, roleDetail);
        toast.success('Role changed successfully!');
      } else {
        await joinService(modalState.serviceId, team, roleDetail);
        toast.success('Successfully registered to serve!');
      }
      setModalState({ open: false, serviceId: '', currentTeam: null, currentRoleDetail: null });
    } catch (e: any) {
      toast.error('Failed to register: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setModalState(prev => ({ ...prev, open: false }));
    setCancelModalState({ open: true });
  };

  const confirmCancel = async () => {
    setLoading(true);
    try {
      await cancelRegistration(modalState.serviceId);
      toast.success('Registration cancelled successfully!');
      setModalState({ open: false, serviceId: '', currentTeam: null, currentRoleDetail: null });
    } catch (e: any) {
      toast.error('Failed to cancel registration: ' + e.message);
    } finally {
      setLoading(false);
      setCancelModalState({ open: false });
    }
  };

  const renderServiceCard = (service: any, showDate = true) => {
    const regs = registrationsMap[service.id] || [];
    const userReg = regs.find((r: any) => r.user_id === userId);
    
    const sounds = regs.filter((r: any) => r.team === 'SOUND');
    const singers = regs.filter((r: any) => r.team === 'SINGER');
    const musicians = regs.filter((r: any) => r.team === 'MUSICIAN');

    const isCovered = sounds.length >= 1 && singers.length >= 1 && musicians.length >= 1;

    return (
      <div key={service.id} className="bg-brand-cream border-2 border-brand-black/40 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 relative flex flex-col justify-between">
        {isCovered ? (
          <div className="absolute -top-3 -right-3 bg-brand-pink text-brand-white font-bold px-2 py-1 text-xs border-2 border-brand-black rounded-full rotate-3 z-10">
            FULFILLED
          </div>
        ) : (
          <div className="absolute -top-3 -right-3 bg-brand-red text-brand-white font-bold px-2 py-1 text-xs border-2 border-brand-black rounded-full rotate-3 z-10">
            NEEDS PEOPLE
          </div>
        )}
        
        <div>
          {showDate && (
            <h3 className="font-bold uppercase tracking-widest text-brand-blue mb-1">
              {format(new Date(service.date), 'EEEE, MMM do')}
            </h3>
          )}
          <h2 className="editorial-heading text-2xl mb-1 leading-tight">{service.title}</h2>
          <p className="font-bold opacity-80 mb-4 text-sm">{service.start_time} - {service.end_time}</p>
        </div>

        <div className="border-t-2 border-brand-black/10 pt-3 flex flex-col gap-3 mt-auto">
          <div className="text-xs space-y-1.5 opacity-90">
            <p>
              <span className="font-bold inline-block w-16">Sound:</span> 
              {sounds.length > 0 ? sounds.map((s:any) => s.role_detail ? ` ()` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
            </p>
            <p>
              <span className="font-bold inline-block w-16">Singers:</span> 
              {singers.length > 0 ? singers.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
            </p>
            <p>
              <span className="font-bold inline-block w-16">Band:</span> 
              {musicians.length > 0 ? musicians.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
            </p>
          </div>
          {userReg ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="font-bold bg-brand-blue text-brand-white px-3 py-1 text-sm border-2 border-brand-black rounded-md flex-1 text-center truncate">
                {userReg.team}
              </span>
              <Button variant="outline" size="sm" className="px-2" onClick={() => setModalState({ open: true, serviceId: service.id, currentTeam: userReg.team, currentRoleDetail: userReg.role_detail })}>
                EDIT
              </Button>
            </div>
          ) : (
            <Button variant="sticker" className="w-full mt-2 text-sm" onClick={() => setModalState({ open: true, serviceId: service.id, currentTeam: null, currentRoleDetail: null })}>
              JOIN
            </Button>
          )}
        </div>
      </div>
    );
  };

  const activeModalRegs = modalState.serviceId ? registrationsMap[modalState.serviceId] || [] : [];
  const activeSounds = activeModalRegs.filter((r: any) => r.team === 'SOUND');
  const activeSingers = activeModalRegs.filter((r: any) => r.team === 'SINGER');
  const activeMusicians = activeModalRegs.filter((r: any) => r.team === 'MUSICIAN');

  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col items-center text-center mb-12">
        <Avatar name={userName} imgUrl={avatarUrl} className="w-20 h-20 text-3xl mb-4 shadow-[4px_4px_0_0_#111111]" />
        <h1 className="editorial-heading text-3xl sm:text-5xl text-brand-pink mb-2 opacity-90">WELCOME, {userName?.split(' ')[0]?.toUpperCase() || 'VOLUNTEER'}!</h1>
        <p className="font-bold text-brand-black/50 uppercase tracking-widest">Find your place to serve</p>
      </div>

      <section className="mb-24 relative">
        <h2 className="editorial-heading text-3xl mb-6 bg-brand-black text-brand-white inline-block px-4 py-2 rounded-lg">
          UPCOMING EVENTS
        </h2>
        {upcomingServices.filter((s: any) => !s.title.toLowerCase().includes('vietnamese service') && !s.title.toLowerCase().includes('combine')).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-brand-black/20 rounded-xl">
            <p className="font-bold text-xl opacity-50">No upcoming events scheduled.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(
              upcomingServices
                .filter((s: any) => !s.title.toLowerCase().includes('vietnamese service') && !s.title.toLowerCase().includes('combine'))
                .reduce((groups: any, service: any) => {
                  const serviceDate = new Date(service.date);
                  const label = format(serviceDate, 'MMMM yyyy').toUpperCase();
                  
                  if (!groups[label]) groups[label] = [];
                  groups[label].push(service);
                  return groups;
                }, {})
            ).map(([label, services]: any) => (
              <div key={label}>
                <h3 className="font-bold uppercase tracking-widest text-brand-black/50 mb-4 pb-2 border-b border-brand-black/20 text-lg">{label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map((service: any) => renderServiceCard(service))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION DIVIDER */}
      <div className="flex justify-center items-center mb-24 opacity-30">
        <div className="h-[2px] bg-brand-black w-1/3"></div>
        <div className="mx-4 font-bold tracking-widest uppercase">Calendar</div>
        <div className="h-[2px] bg-brand-black w-1/3"></div>
      </div>

      {/* MONTHLY CALENDAR SECTION */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6 bg-brand-cream border-2 border-brand-pink rounded-xl p-3 sm:p-4 shadow-sm">
          <Button variant="ghost" onClick={() => handleNavigate(offset - 1)}>&larr; Prev</Button>
          <div className="text-center">
            <h2 className="editorial-heading text-2xl sm:text-3xl text-brand-blue">{monthName.toUpperCase()}</h2>
          </div>
          <div className="flex gap-2">
            {offset !== 0 && <Button variant="outline" onClick={() => handleNavigate(0)} className="text-xs sm:text-sm">THIS MONTH</Button>}
            <Button variant="ghost" onClick={() => handleNavigate(offset + 1)}>Next &rarr;</Button>
          </div>
        </div>

        <div className="bg-brand-cream border-2 border-brand-pink rounded-xl p-2 md:p-6 shadow-sm">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold uppercase tracking-widest text-xs md:text-sm mb-2 border-b-2 border-brand-pink/20 pb-2 text-brand-black/60">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] md:min-h-[120px] bg-brand-cream/10 rounded-md border border-transparent"></div>
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
              const dayStr = format(dateObj, 'yyyy-MM-dd');
              const dayServices = monthlyServices.filter((s: any) => s.date === dayStr);
              
              const isToday = isSameDay(dateObj, new Date());

              return (
                <div key={day} className={`min-h-[80px] md:min-h-[120px] border border-brand-pink/20 rounded-md p-1 md:p-2 relative flex flex-col ${isToday ? 'bg-brand-yellow/20 border-brand-yellow' : 'bg-brand-white/50'}`}>
                  <span className="font-bold text-sm sm:text-lg inline-block mb-1">{day}</span>
                  <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                    {dayServices.map((s: any) => {
                      const isUserServing = registrationsMap[s.id]?.some((r: any) => r.user_id === userId);
                      const sounds = registrationsMap[s.id]?.filter((r: any) => r.team === 'SOUND').map((r:any) => r.role_detail ? `${r.user_name} (${r.role_detail})` : r.user_name).join(', ') || 'None';
                      const singers = registrationsMap[s.id]?.filter((r: any) => r.team === 'SINGER').map((r:any) => r.role_detail ? `${r.user_name} (${r.role_detail})` : r.user_name).join(', ') || 'None';
                      const musicians = registrationsMap[s.id]?.filter((r: any) => r.team === 'MUSICIAN').map((r:any) => r.role_detail ? `${r.user_name} (${r.role_detail})` : r.user_name).join(', ') || 'None';
                      const hoverText = `Sound: ${sounds}\nSingers: ${singers}\nBand: ${musicians}`;

                      return (
                        <div key={s.id} 
                             title={hoverText}
                             className={`text-[10px] md:text-xs font-bold leading-tight border border-brand-pink/30 rounded p-1 truncate cursor-pointer hover:bg-brand-pink/10 transition-colors ${isUserServing ? 'bg-brand-blue text-brand-white border-brand-blue' : 'bg-white text-brand-black/70'}`}
                             onClick={() => {
                               const rReg = isUserServing ? registrationsMap[s.id].find((r:any) => r.user_id === userId) : null;
                               setModalState({ open: true, serviceId: s.id, currentTeam: rReg ? rReg.team : null, currentRoleDetail: rReg ? rReg.role_detail : null })
                             }}
                        >
                          {s.start_time} {s.title}
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modal */}
      {modalState.open && (
        <div className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-brand-black/20 rounded-2xl p-8 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="editorial-heading text-3xl mb-6">Choose your serving role</h2>
            
            <div className="space-y-6 mb-8">
              <div>
                <Button 
                  variant={modalState.currentTeam === 'SOUND' ? 'primary' : 'outline'} 
                  className="w-full text-left justify-start text-lg h-14"
                  disabled={loading}
                  onClick={() => handleAction('SOUND')}
                >
                  SOUND TEAM
                </Button>
                <div className="mt-2 text-sm text-brand-black/60 pl-3 border-l-2 border-brand-black/20">
                  <span className="font-bold">Serving:</span> {activeSounds.length > 0 ? activeSounds.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
                </div>
              </div>
              
              <div>
                <div className="flex flex-col gap-2">
                  <select 
                    className="w-full border-4 border-brand-black bg-brand-cream font-bold px-4 rounded-none shadow-[4px_4px_0_0_#111111] focus:outline-none h-12 cursor-pointer hover:shadow-[4px_4px_0_0_#0038FF] transition-all outline-none"
                    onChange={(e) => setSingerRole(e.target.value)}
                    value={singerRole || (modalState.currentTeam === 'SINGER' ? (modalState.currentRoleDetail || '') : '')}
                  >
                    <option value="">— Chọn vai trò ca sỹ —</option>
                    <option value="Vocal 1">Vocal 1</option>
                    <option value="Vocal 2">Vocal 2</option>
                    <option value="Vocal 3">Vocal 3</option>
                  </select>
                  <Button 
                    variant={modalState.currentTeam === 'SINGER' ? 'primary' : 'outline'} 
                    className="w-full text-left justify-start text-lg h-14"
                    disabled={loading}
                    onClick={() => handleAction('SINGER', singerRole || (modalState.currentTeam === 'SINGER' ? (modalState.currentRoleDetail || '') : ''))}
                  >
                    SINGER
                  </Button>
                </div>
                <div className="mt-2 text-sm text-brand-black/60 pl-3 border-l-2 border-brand-black/20">
                  <span className="font-bold">Serving:</span> {activeSingers.length > 0 ? activeSingers.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
                </div>
              </div>
              
              <div>
                <div className="flex flex-col gap-2">
                  <select 
                    className="w-full border-4 border-brand-black bg-brand-cream font-bold px-4 rounded-none shadow-[4px_4px_0_0_#111111] focus:outline-none h-12 cursor-pointer hover:shadow-[4px_4px_0_0_#0038FF] transition-all outline-none"
                    onChange={(e) => setMusicianRole(e.target.value)}
                    value={musicianRole || (modalState.currentTeam === 'MUSICIAN' ? (modalState.currentRoleDetail || '') : '')}
                  >
                    <option value="">— Chọn nhạc cụ —</option>
                    <option value="E-Guitar">E-Guitar</option>
                    <option value="Acoustic Guitar">Acoustic Guitar</option>
                    <option value="Bass">Bass</option>
                    <option value="Drum">Drum</option>
                    <option value="Piano">Piano</option>
                  </select>
                  <Button 
                    variant={modalState.currentTeam === 'MUSICIAN' ? 'primary' : 'outline'} 
                    className="w-full text-left justify-start text-lg h-14"
                    disabled={loading}
                    onClick={() => handleAction('MUSICIAN', musicianRole || (modalState.currentTeam === 'MUSICIAN' ? (modalState.currentRoleDetail || '') : ''))}
                  >
                    MUSICIAN
                  </Button>
                </div>
                <div className="mt-2 text-sm text-brand-black/60 pl-3 border-l-2 border-brand-black/20">
                  <span className="font-bold">Serving:</span> {activeMusicians.length > 0 ? activeMusicians.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
                </div>
              </div>
            </div>

            <div className="flex justify-between border-t-2 border-brand-black/10 pt-6">
              {modalState.currentTeam ? (
                <Button variant="ghost" className="text-brand-red hover:bg-brand-red/10" disabled={loading} onClick={handleCancel}>
                  CANCEL REGISTRATION
                </Button>
              ) : <div></div>}
              <Button variant="ghost" disabled={loading} onClick={() => setModalState({ open: false, serviceId: '', currentTeam: null, currentRoleDetail: null })}>
                CLOSE
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL REGISTRATION MODAL */}
      <Dialog.Root open={cancelModalState.open} onOpenChange={(open) => !open && setCancelModalState({ open: false })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none">
            <Dialog.Title className="editorial-heading text-3xl mb-4 text-brand-red">CANCEL REGISTRATION</Dialog.Title>
            <Dialog.Description className="text-lg font-bold mb-8">
              Are you sure you want to cancel your serving registration?
            </Dialog.Description>
            <div className="flex justify-end gap-4">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={loading}>BACK</Button>
              </Dialog.Close>
              <Button variant="primary" className="bg-brand-red shadow-[4px_4px_0_0_#111111]" onClick={confirmCancel} disabled={loading}>
                YES, CANCEL
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}


