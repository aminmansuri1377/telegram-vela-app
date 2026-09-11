import { useEffect, useRef, useId, useState, type ReactNode } from 'react';
import { X, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDialogElement>(null); const titleId = useId(); const { t } = useTranslation(); useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []); return <dialog aria-labelledby={titleId} ref={ref} onCancel={onClose}><header><h2 id={titleId}>{title}</h2><button className="icon" aria-label={t('close')} onClick={onClose}><X /></button></header>{children}</dialog>; }
export function Portrait({ url, alt, className = '' }: {
    url?: string;
    alt: string;
    className?: string;
}) { const [failedUrl, setFailedUrl] = useState<string>(); if (url?.startsWith('seed:')) {
    const index = ((Number(url.split(':')[1]) || 0) % 6 + 6) % 6;
    return <div role="img" aria-label={alt} className={`portrait fictional ${className}`} style={{ backgroundImage: 'url(/assets/fictional-portraits.png)', backgroundSize: '300% 200%', backgroundPosition: `${(index % 3) * 50}% ${index >= 3 ? 100 : 0}%` }}/>;
} return url && url !== failedUrl ? <img onError={() => setFailedUrl(url)} className={`portrait ${className}`} src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer"/> : <div role="img" aria-label={alt} className={`portrait placeholder ${className}`}><ImageOff aria-hidden="true"/></div>; }
export function Empty({ title, children }: {
    title: string;
    children?: ReactNode;
}) { return <div className="empty"><span className="orbit">✧</span><h2>{title}</h2>{children}</div>; }
export function Loading() { const { t } = useTranslation(); return <div role="status" aria-label={t('loading')} className="skeleton"/>; }
