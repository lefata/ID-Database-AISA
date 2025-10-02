import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedImageUrl: string) => void;
}

// Function to generate the cropped image from a canvas
function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = crop.width;
    canvas.height = crop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return Promise.reject(new Error('Canvas context not available'));
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
    );

    return new Promise((resolve) => {
        // Use JPEG for smaller file size, with high quality
        resolve(canvas.toDataURL('image/jpeg', 0.9));
    });
}

const ASPECT_RATIO = 1;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onClose, onCropComplete }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isSaving, setIsSaving] = useState(false);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const crop = makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            ASPECT_RATIO,
            width,
            height
        );
        const centeredCrop = centerCrop(crop, width, height);
        setCrop(centeredCrop);
    }
    
    const handleSaveCrop = async () => {
        if (!completedCrop || !imgRef.current) {
            return;
        }
        setIsSaving(true);
        try {
            const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop);
            onCropComplete(croppedImageUrl);
        } catch (error) {
            console.error("Error cropping image:", error);
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-slate-800">Crop Image</h2>
                    <p className="text-sm text-slate-500">Adjust the image to fit the profile picture frame.</p>
                </div>
                <div className="p-6 flex justify-center items-center bg-slate-100">
                   {imageSrc && (
                     <ReactCrop
                       crop={crop}
                       onChange={(_, percentCrop) => setCrop(percentCrop)}
                       onComplete={(c) => setCompletedCrop(c)}
                       aspect={ASPECT_RATIO}
                       minWidth={100}
                       circularCrop
                     >
                       <img 
                         ref={imgRef}
                         src={imageSrc} 
                         alt="Crop preview" 
                         style={{ maxHeight: '70vh' }}
                         onLoad={onImageLoad}
                       />
                     </ReactCrop>
                   )}
                </div>
                <div className="p-6 bg-slate-50 flex justify-end space-x-3 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSaveCrop} disabled={isSaving || !completedCrop} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-300 flex items-center justify-center w-28">
                        {isSaving ? <SpinnerIcon /> : 'Save Crop'}
                    </button>
                </div>
            </div>
        </div>
    );
};
