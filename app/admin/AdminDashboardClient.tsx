'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminAssignMember, adminRemoveAssignment } from './actions';

export default function AdminDashboardClient({ gridData, allUsers }: any) {
  const [modalState, setModalState] = useState<{ open: boolean, serviceId: string, team: string }>({
    open: false,
    serviceId: '',
    team: ''
  });
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="overflow-x-auto bg-brand-white border-8 border-brand-black shadow-[12px_12px_0_0_#111111]">
      <div className="min-w-[800px]">
        {gridData.map((service: any) => (
          <div key={service.id} className="flex border-b-4 border-brand-black last:border-b-0">
            <div className="w-1/4 p-4 border-r-4 border-brand-black bg-brand-cream/50 flex flex-col justify-center">
              <h3 className="font-bold text-brand-blue uppercase tracking-widest">{new Date(service.date).toLocaleDateString('en-US', { weekday: 'long' })}</h3>
              <p className="font-bold">{service.start_time}</p>
              <p className="text-sm font-bold opacity-70">{service.title}</p>
            </div>
            
            {renderTeamCell(service, 'SOUND', service.sound)}
            {renderTeamCell(service, 'SINGER', service.singer)}
            {renderTeamCell(service, 'MUSICIAN', service.musician)}
          </div>
        ))}
      </div>

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
