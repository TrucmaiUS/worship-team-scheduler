'use client';

import { useState } from 'react';
import { Button } from './Button';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';

export function ProfileNameForm({ initialName, updateAction }: { initialName: string, updateAction: (name: string) => Promise<any> }) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (name.trim() === initialName) {
      setIsEditing(false);
      return;
    }
    setLoading(true);
    const result = await updateAction(name);
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Name updated successfully!');
      setIsEditing(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-xl tracking-normal">{initialName}</span>
        <button onClick={() => setIsEditing(true)} className="text-brand-blue font-bold text-xs uppercase hover:underline">Edit</button>
      </div>

      <Dialog.Root open={isEditing} onOpenChange={setIsEditing}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] bg-brand-cream border-8 border-brand-black p-8 shadow-[12px_12px_0_0_#FFA6C9] flex flex-col outline-none">
            <Dialog.Title className="editorial-heading text-3xl mb-2 text-brand-black">EDIT PROFILE NAME</Dialog.Title>
            <Dialog.Description className="text-sm font-bold mb-6 opacity-70">
              Enter your new name below.
            </Dialog.Description>
            
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="border-4 border-brand-black px-4 py-3 font-bold text-lg outline-none w-full shadow-[4px_4px_0_0_#111111] focus:shadow-[4px_4px_0_0_#0038FF] transition-all mb-8 bg-brand-white"
              disabled={loading}
              placeholder="Your full name"
            />

            <div className="flex justify-end gap-4">
              <Button variant="ghost" onClick={() => { setName(initialName); setIsEditing(false); }} disabled={loading}>
                CANCEL
              </Button>
              <Button variant="primary" className="bg-brand-blue text-brand-white shadow-[4px_4px_0_0_#111111]" onClick={handleSave} disabled={loading}>
                SAVE NAME
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}