import { useEffect, useRef, type ReactNode } from 'react';
import { X, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDialogElement>(null); const { t } = useTranslation(); useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []); return <dialog ref={ref} onCancel={onClose}><header><h2>{title}</h2><button className="icon" aria-label={t('close')} onClick={onClose}><X /></button></header>{children}</dialog>; }
export function Portrait({ url, alt, className = '' }: {
    url?: string;
    alt: string;
    className?: string;
}) { if (url?.startsWith('seed:')) {
    const index = Number(url.split(':')[1]) % 6;
    return <div role="img" aria-label={alt} className={`portrait fictional ${className}`} style={{ backgroundImage: 'url(/assets/fictional-portraits.png)', backgroundSize: '300% 200%', backgroundPosition: `${(index % 3) * 50}% ${index >= 3 ? 100 : 0}%` }}/>;
} return url ? <img className={`portrait ${className}`} src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer"/> : <div className={`portrait placeholder ${className}`}><ImageOff aria-label={alt}/></div>; }
export function Empty({ title, children }: {
    title: string;
    children?: ReactNode;
}) { return <div className="empty"><span className="orbit">✧</span><h2>{title}</h2>{children}</div>; }
export function Loading() { const { t } = useTranslation(); return <div role="status" aria-label={t('loading')} className="skeleton"/>; }
