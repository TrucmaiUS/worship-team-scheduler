'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { addService } from '@/app/actions/admin';

export function AddEventButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const result = await addService(formData);
    
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        className="bg-brand-blue text-brand-white px-6 py-2 border-4 border-brand-black shadow-[4px_4px_0_0_#111111] transform -rotate-1 hover:rotate-0 transition-transform"
      >
        + ADD EVENT
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-brand-white border-8 border-brand-black p-8 max-w-md w-full shadow-[12px_12px_0_0_#FFA6C9] transform rotate-1">
            <h2 className="editorial-heading text-2xl mb-6 text-brand-pink">ADD NEW EVENT</h2>
            
            {error && <div className="bg-brand-red text-brand-white p-3 mb-4 border-2 border-brand-black font-bold">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-bold mb-2 uppercase tracking-widest text-sm opacity-70">Event Title</label>
                <input 
                  name="title" 
                  type="text" 
                  required 
                  placeholder="e.g. Sunday Service" 
                  className="w-full p-3 border-4 border-brand-black focus:outline-none focus:ring-4 focus:ring-brand-pink/30 bg-brand-cream"
                />
              </div>
              
              <div>
                <label className="block font-bold mb-2 uppercase tracking-widest text-sm opacity-70">Date</label>
                <input 
                  name="date" 
                  type="date" 
                  required 
                  className="w-full p-3 border-4 border-brand-black focus:outline-none focus:ring-4 focus:ring-brand-pink/30 bg-brand-cream"
                />
              </div>

              <div>
                <label className="block font-bold mb-2 uppercase tracking-widest text-sm opacity-70">Start Time</label>
                <input 
                  name="start_time" 
                  type="time" 
                  required 
                  defaultValue="09:00"
                  className="w-full p-3 border-4 border-brand-black focus:outline-none focus:ring-4 focus:ring-brand-pink/30 bg-brand-cream"
                />
              </div>

              <div>
                <label className="block font-bold mb-2 uppercase tracking-widest text-sm opacity-70">End Time</label>
                <input 
                  name="end_time" 
                  type="time" 
                  required 
                  defaultValue="11:00"
                  className="w-full p-3 border-4 border-brand-black focus:outline-none focus:ring-4 focus:ring-brand-pink/30 bg-brand-cream"
                />
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  CANCEL
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-brand-pink text-brand-white"
                >
                  {isSubmitting ? 'SAVING...' : 'SAVE EVENT'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
