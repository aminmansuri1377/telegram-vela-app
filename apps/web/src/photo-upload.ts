import { api, ApiError } from './api';

// Resize before transmission: phone photos need not consume server RAM or upload bandwidth.
export async function preparePhoto(file: File): Promise<File> {
    if (!file.size) throw new ApiError('INVALID_IMAGE', 400);
    if (file.size > 25 * 1024 * 1024) throw new ApiError('IMAGE_TOO_LARGE', 413);
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new ApiError('INVALID_IMAGE', 400)), 15000);
            img.onload = () => { clearTimeout(timer); resolve(); };
            img.onerror = () => { clearTimeout(timer); reject(new ApiError('INVALID_IMAGE', 400)); };
            img.src = url;
        });
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new ApiError('INVALID_IMAGE', 400);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) throw new ApiError('INVALID_IMAGE', 400);
        if (blob.size > 5 * 1024 * 1024) throw new ApiError('IMAGE_TOO_LARGE', 413);
        return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    } finally { URL.revokeObjectURL(url); }
}
export async function uploadPhoto(file: File, purpose: 'PROFILE' | 'CHAT') {
    const photo = await preparePhoto(file);
    const form = new FormData(); form.append('purpose', purpose); form.append('file', photo);
    try { return await api('photos', 'POST', form); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('UPLOAD_NETWORK', 0); }
}
