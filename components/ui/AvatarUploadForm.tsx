'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';

export function AvatarUploadForm({ uploadAction }: { uploadAction: (formData: FormData) => Promise<any> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl);
    }
    // reset input value so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      setIsUploading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Failed to crop image");
      
      const file = new File([croppedImageBlob], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append('avatar', file);
      
      const result = await uploadAction(formData);
      if (result?.error) {
        toast.error('Upload failed: ' + result.error);
      } else {
        setImageSrc(null); // Close the cropper on success
      }
    } catch (e: any) {
      toast.error('An error occurred during upload: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <input 
        ref={fileInputRef}
        type="file" 
        name="avatar" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange}
      />
      <Button 
        type="button" 
        variant="sticker" 
        size="sm" 
        className="text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        Upload Avatar
      </Button>

      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white p-4 rounded-xl shadow-xl w-full max-w-md m-4">
            <h3 className="text-lg font-bold mb-4 text-center">Cắt ảnh đại diện</h3>
            <div className="relative w-full h-64 bg-gray-200 mb-4 rounded-md overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-4 mb-6 px-2">
              <span className="text-sm font-medium">Zoom:</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setImageSrc(null)}>Hủy</Button>
              <Button type="button" onClick={showCroppedImage} disabled={isUploading}>
                {isUploading ? 'Đang xử lý...' : 'Lưu ảnh'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string), false);
    reader.readAsDataURL(file);
  });
}
