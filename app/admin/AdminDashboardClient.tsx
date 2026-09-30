'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminAssignMember, adminRemoveAssignment } from './actions';

export default function AdminDashboardClient({ gridData, allUsers }: any) {
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'TABLE' | 'MEMBERS'>('SCHEDULE');
  const [modalState, setModalState] = useState<{ open: boolean, serviceId: string, team: string }>({
    open: false,
    serviceId: '',
    team: ''
  });
  const [loading, setLoading] = useState(false);

  // Determine current month in YYYY-MM based on the NEXT upcoming service
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingService = gridData.find((s: any) => s.date >= todayStr);
  const defaultMonthStr = upcomingService ? upcomingService.date.slice(0, 7) : todayStr.slice(0, 7);
  
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr);

  const handleAssign = async (userId: string) => {
    setLoading(true);
    await adminAssignMember(modalState.serviceId, userId, modalState.team);
    setModalState({ open: false, serviceId: '', team: '' });
    setLoading(false);
  };

  const handleRemove = async (serviceId: string, userId: string) => {
    if (confirm('Remove this member from the service?')) {
      await adminRemoveAssignment(serviceId, userId);
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
                <span>✓ {u.full_name}</span>
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
    const d = new Date(selectedMonth + '-01T00:00:00');
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const d = new Date(selectedMonth + '-01T00:00:00');
    d.setMonth(d.getMonth() + 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

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
                    <div className="overflow-x-auto bg-brand-white border-8 border-brand-black shadow-[12px_12px_0_0_#111111] pt-6">
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
                      const singers = s.singer.map((u: any) => u.full_name).join(', ');
                      const musicians = s.musician.map((u: any) => u.full_name).join(', ');
                      const sounds = s.sound.map((u: any) => u.full_name).join(', ');
                      
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
      {modalState.open && (
        <div className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border-8 border-brand-black p-8 max-w-md w-full shadow-[12px_12px_0_0_#FF2E93] max-h-[80vh] flex flex-col">
            <h2 className="editorial-heading text-2xl mb-4">Assign to {modalState.team}</h2>
            <div className="flex-1 overflow-y-auto border-4 border-brand-black bg-brand-white p-2 mb-4 space-y-2">
              {allUsers.map((u: any) => (
                <div key={u.id} className="flex justify-between items-center p-2 hover:bg-brand-cream border-b-2 border-brand-black last:border-0">
                  <span className="font-bold">{u.full_name}</span>
                  <Button size="sm" onClick={() => handleAssign(u.id)} disabled={loading}>Assign</Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setModalState({ open: false, serviceId: '', team: '' })}>
                CLOSE
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
