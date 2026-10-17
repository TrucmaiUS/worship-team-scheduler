'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { joinService, changeRole, cancelRegistration } from '@/app/actions/schedule';
import { getDay, getDaysInMonth, startOfMonth, format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, Check } from 'lucide-react';

export default function ClientSchedule({ upcomingServices, monthlyServices, registrationsMap, userId, userName, avatarUrl, offset, currentMonthDate }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<'SINGER' | 'MUSICIAN' | null>(null);
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

  const handleOpenModal = (serviceId: string, currentTeam: string | null = null, currentRoleDetail: string | null = null) => {
    setExpandedTeam(currentTeam === 'SINGER' ? 'SINGER' : currentTeam === 'MUSICIAN' ? 'MUSICIAN' : null);
    setModalState({ open: true, serviceId, currentTeam, currentRoleDetail });
  };

  const closeModal = () => {
    setModalState({ open: false, serviceId: '', currentTeam: null, currentRoleDetail: null });
    setExpandedTeam(null);
  };

  const getExistingAssignee = (team: string, roleDetail = '') => {
    if (!modalState.serviceId) return null;
    const regs = registrationsMap[modalState.serviceId] || [];
    if (team === 'SOUND') {
      const found = regs.find((r: any) => r.team === 'SOUND' && r.user_id !== userId);
      return found ? found.user_name : null;
    }
    const found = regs.find(
      (r: any) => r.team === team && (r.role_detail || '').toLowerCase() === roleDetail.toLowerCase() && r.user_id !== userId
    );
    return found ? found.user_name : null;
  };

  const handleAction = async (team: string, roleDetail = '') => {
    if ((team === 'SINGER' || team === 'MUSICIAN') && !roleDetail) {
      toast.error('Please select a specific role before registering.');
      return;
    }

    const existingUser = getExistingAssignee(team, roleDetail);
    if (existingUser) {
      const roleName = roleDetail || (team === 'SOUND' ? 'Sound Team' : team);
      toast.warning(`${roleName} is already taken by ${existingUser}!`);
      return;
    }

    if (modalState.currentTeam === team && (modalState.currentRoleDetail || '') === roleDetail) {
      closeModal();
      return;
    }

    setLoading(true);
    try {
      if (modalState.currentTeam) {
        const res = await changeRole(modalState.serviceId, team, roleDetail);
        if (res?.error) {
          toast.warning(res.error);
          return;
        }
        toast.success('Role changed successfully!');
      } else {
        const res = await joinService(modalState.serviceId, team, roleDetail);
        if (res?.error) {
          toast.warning(res.error);
          return;
        }
        toast.success('Successfully registered to serve!');
      }
      closeModal();
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
      closeModal();
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
              {format(new Date(service.date.includes('T') ? service.date : `${service.date}T00:00:00`), 'EEEE, MMM do')}
            </h3>
          )}
          <h2 className="editorial-heading text-2xl mb-1 leading-tight">{service.title}</h2>
          <p className="font-bold opacity-80 mb-4 text-sm">{service.start_time} - {service.end_time}</p>
        </div>

        <div className="border-t-2 border-brand-black/10 pt-3 flex flex-col gap-3 mt-auto">
          <div className="text-xs space-y-1.5 opacity-90">
            <p>
              <span className="font-bold inline-block w-16">Sound:</span> 
              {sounds.length > 0 ? sounds.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
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
              <Button variant="outline" size="sm" className="px-2" onClick={() => handleOpenModal(service.id, userReg.team, userReg.role_detail)}>
                EDIT
              </Button>
            </div>
          ) : (
            <Button variant="sticker" className="w-full mt-2 text-sm" onClick={() => handleOpenModal(service.id, null, null)}>
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
                  const serviceDate = new Date(service.date.includes('T') ? service.date : `${service.date}T00:00:00`);
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
          <div className="flex-1 flex justify-start">
            <Button variant="ghost" onClick={() => handleNavigate(offset - 1)}>&larr; Prev</Button>
          </div>
          <div className="flex-1 flex justify-center text-center">
            <h2 className="editorial-heading text-2xl sm:text-3xl text-brand-blue">{monthName.toUpperCase()}</h2>
          </div>
          <div className="flex-1 flex justify-end gap-2">
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
                               handleOpenModal(s.id, rReg ? rReg.team : null, rReg ? rReg.role_detail : null);
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
              {/* SOUND TEAM */}
              <div>
                {(() => {
                  const soundUser = getExistingAssignee('SOUND');
                  const isCurrent = modalState.currentTeam === 'SOUND';
                  return (
                    <>
                      <Button 
                        variant={isCurrent ? 'primary' : 'outline'} 
                        className="w-full text-left justify-start text-lg h-14"
                        disabled={loading}
                        onClick={() => {
                          if (soundUser) {
                            toast.warning(`Sound Team is already taken by ${soundUser}!`);
                            return;
                          }
                          handleAction('SOUND');
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>SOUND TEAM</span>
                          {soundUser ? (
                            <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded border border-amber-300">
                              Taken: {soundUser}
                            </span>
                          ) : isCurrent ? (
                            <span className="text-xs bg-white text-brand-blue font-black px-2 py-0.5 border border-brand-black">
                              CURRENT
                            </span>
                          ) : null}
                        </div>
                      </Button>
                      <div className="mt-2 text-sm text-brand-black/60 pl-3 border-l-2 border-brand-black/20">
                        <span className="font-bold">Serving:</span> {activeSounds.length > 0 ? activeSounds.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
                      </div>
                    </>
                  );
                })()}
              </div>
              
              {/* SINGER */}
              <div>
                <div className="flex flex-col">
                  <Button 
                    variant={modalState.currentTeam === 'SINGER' ? 'primary' : 'outline'} 
                    className="w-full text-left justify-between text-lg h-14"
                    disabled={loading}
                    onClick={() => setExpandedTeam(prev => prev === 'SINGER' ? null : 'SINGER')}
                  >
                    <div className="flex items-center gap-2">
                      <span>SINGER</span>
                      {modalState.currentTeam === 'SINGER' && modalState.currentRoleDetail && (
                        <span className="text-xs bg-white text-brand-pink font-bold px-2 py-0.5 border border-brand-black">
                          {modalState.currentRoleDetail}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandedTeam === 'SINGER' ? 'rotate-180' : ''}`} />
                  </Button>

                  {expandedTeam === 'SINGER' && (
                    <div className="mt-2 p-2.5 flex flex-col gap-2 bg-brand-cream/60 border-2 border-brand-black rounded-lg animate-in fade-in-50 duration-150">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-black/70 px-1">
                        Select your vocal role:
                      </p>
                      {['Vocal 1', 'Vocal 2', 'Vocal 3'].map((role) => {
                        const user = getExistingAssignee('SINGER', role);
                        const isCurrent = modalState.currentTeam === 'SINGER' && modalState.currentRoleDetail === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (user) {
                                toast.warning(`${role} is already taken by ${user}!`);
                                return;
                              }
                              handleAction('SINGER', role);
                            }}
                            className={`w-full flex items-center justify-between p-3 font-bold text-sm border-2 border-brand-black transition-all text-left ${
                              isCurrent
                                ? 'bg-brand-pink text-white shadow-[2px_2px_0_0_#111111]'
                                : user
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'
                                : 'bg-white hover:bg-brand-pink/20 hover:translate-x-1 shadow-[2px_2px_0_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isCurrent && <Check className="w-4 h-4 text-white" />}
                              {role}
                            </span>
                            {user ? (
                              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 border border-amber-300 rounded">
                                Taken: {user}
                              </span>
                            ) : isCurrent ? (
                              <span className="text-xs bg-white text-brand-pink font-black px-2 py-0.5 border border-brand-black">
                                CURRENT
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm text-brand-black/60 pl-3 border-l-2 border-brand-black/20">
                  <span className="font-bold">Serving:</span> {activeSingers.length > 0 ? activeSingers.map((s:any) => s.role_detail ? `${s.user_name} (${s.role_detail})` : s.user_name).join(', ') : <span className="opacity-50 italic">None</span>}
                </div>
              </div>
              
              {/* MUSICIAN */}
              <div>
                <div className="flex flex-col">
                  <Button 
                    variant={modalState.currentTeam === 'MUSICIAN' ? 'primary' : 'outline'} 
                    className="w-full text-left justify-between text-lg h-14"
                    disabled={loading}
                    onClick={() => setExpandedTeam(prev => prev === 'MUSICIAN' ? null : 'MUSICIAN')}
                  >
                    <div className="flex items-center gap-2">
                      <span>MUSICIAN</span>
                      {modalState.currentTeam === 'MUSICIAN' && modalState.currentRoleDetail && (
                        <span className="text-xs bg-white text-brand-blue font-bold px-2 py-0.5 border border-brand-black">
                          {modalState.currentRoleDetail}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandedTeam === 'MUSICIAN' ? 'rotate-180' : ''}`} />
                  </Button>

                  {expandedTeam === 'MUSICIAN' && (
                    <div className="mt-2 p-2.5 flex flex-col gap-2 bg-brand-cream/60 border-2 border-brand-black rounded-lg animate-in fade-in-50 duration-150">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-black/70 px-1">
                        Select your instrument:
                      </p>
                      {['Acoustic Guitar', 'E-Guitar', 'Bass', 'Piano', 'Drum'].map((role) => {
                        const user = getExistingAssignee('MUSICIAN', role);
                        const isCurrent = modalState.currentTeam === 'MUSICIAN' && modalState.currentRoleDetail === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (user) {
                                toast.warning(`${role} is already taken by ${user}!`);
                                return;
                              }
                              handleAction('MUSICIAN', role);
                            }}
                            className={`w-full flex items-center justify-between p-3 font-bold text-sm border-2 border-brand-black transition-all text-left ${
                              isCurrent
                                ? 'bg-brand-blue text-white shadow-[2px_2px_0_0_#111111]'
                                : user
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'
                                : 'bg-white hover:bg-brand-blue/15 hover:translate-x-1 shadow-[2px_2px_0_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isCurrent && <Check className="w-4 h-4 text-white" />}
                              {role}
                            </span>
                            {user ? (
                              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 border border-amber-300 rounded">
                                Taken: {user}
                              </span>
                            ) : isCurrent ? (
                              <span className="text-xs bg-white text-brand-blue font-black px-2 py-0.5 border border-brand-black">
                                CURRENT
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
              <Button variant="ghost" disabled={loading} onClick={closeModal}>
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


