import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { Heart, Compass, MessageCircle, UserRound, SlidersHorizontal, X, ArrowUpRight, ChevronLeft, Send, Paperclip, Shield, LogOut, Sparkles, Check, Settings as SettingsIcon } from 'lucide-react';
import './i18n';
import { changeLanguage, languageNames } from './i18n';
import { api, base, setCsrf, getCsrf, ApiError } from './api';
import { tg } from './telegram';
import { Portrait, Modal, Empty, Loading } from './ui';
import { ProfileEditor } from './profile';
import { Admin } from './admin';
import './styles.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 10000, refetchOnWindowFocus: false } } });
export const errorKey = (e: unknown) => { const code = e instanceof ApiError ? e.code : ''; return ({ AUTH_EXPIRED: 'reopen', REOPEN_TELEGRAM: 'reopen', VALIDATION_ERROR: 'validation', DAILY_LIMIT: 'limit', PREMIUM_REQUIRED: 'locked', PROFILE_INCOMPLETE: 'photoRequired', STORAGE_NOT_CONFIGURED: 'storageMissing', TELEGRAM_NOT_CONFIGURED: 'paymentMissing', CHAT_UNAVAILABLE: 'chatUnavailable' } as Record<string, string>)[code] || 'error'; };
export function Language({ onChange }: {
    onChange?: (s: string) => void;
}) { const { t, i18n } = useTranslation(); return <label className="language"><span>{t('language')}</span><select value={i18n.language} onChange={e => { changeLanguage(e.target.value); onChange?.(e.target.value); }}>{Object.entries(languageNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>; }
function Legal({ kind, onClose }: {
    kind: string;
    onClose: () => void;
}) { const { t, i18n } = useTranslation(); const q = useQuery({ queryKey: ['content', kind, i18n.language], queryFn: async () => await api(`content/${kind}.${i18n.language}`) || await api(`content/${kind}`) }); return <Modal title={t(kind)} onClose={onClose}><p>{t('legalDraft')}</p><div className="legal">{q.isLoading ? t('loading') : q.data?.value || t('safetyBody')}</div></Modal>; }
function Welcome({ onLogin, notice }: {
    onLogin: () => void;
    notice: (s: string) => void;
}) {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(localStorage.getItem('vela_test_user') || 'test-man-01');
    const [busy, setBusy] = useState(false);
    const [legal, setLegal] = useState<string | null>(new URLSearchParams(location.search).get('legal'));
    const dev = import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN_ENABLED === 'true';
    const q = useQuery({ queryKey: ['dev-users'], queryFn: () => api<any[]>('auth/dev-users'), enabled: dev });
    async function login(test = false) { setBusy(true); try {
        if (!test && !tg()?.initData) {
            notice(t('openTelegram'));
            return;
        }
        const result = await api(test ? 'auth/dev' : 'auth/telegram', 'POST', test ? { telegramId: selected } : { initData: tg()!.initData });
        setCsrf(result.csrf);
        if (test)
            localStorage.setItem('vela_test_user', selected);
        onLogin();
    }
    catch (e) {
        notice(t(errorKey(e)));
    }
    finally {
        setBusy(false);
    } }
    return <main className="welcome"><div className="welcome-top"><a className="wordmark" href="/">kisser<span>✳</span></a><span className="pill">18+</span></div><Language /><div className="welcome-art"><Portrait url="seed:0" alt={t('fictional')}/><Portrait url="seed:3" alt={t('fictional')}/><span className="spark">✳</span></div><p className="eyebrow">{t('tagline')}</p><h1>{t('welcome')}</h1><p className="muted">{t('welcomeBody')}</p><button className="primary wide" disabled={busy} onClick={() => void login()}>{busy ? t('loading') : t('login')}<ArrowUpRight /></button>{dev && <div className="dev-box"><small>{t('testMode')}</small><label>{t('testAccount')}<select value={selected} onChange={e => setSelected(e.target.value)}>{q.data?.map(u => <option key={u.telegramId} value={u.telegramId}>{u.firstName} · {u.telegramId}</option>)}</select></label><button className="secondary wide" disabled={busy || !q.data?.length} onClick={() => void login(true)}>{t('testLogin')}</button></div>}<footer><p>{t('adult')}</p><button onClick={() => setLegal('terms')}>{t('terms')}</button><span> · </span><button onClick={() => setLegal('privacy')}>{t('privacy')}</button></footer>{legal && <Legal kind={legal} onClose={() => setLegal(null)}/>}</main>;
}
function Discover({ notice, openProfile, openChat }: {
    notice: (s: string) => void;
    openProfile: () => void;
    openChat: (id: string) => void;
}) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [cursor, setCursor] = useState<string | null | undefined>();
    const q = useQuery({ queryKey: ['discovery', cursor], queryFn: () => api('discovery' + (cursor ? `?cursor=${cursor}` : '')) });
    const [index, setIndex] = useState(0), [imageIndex, setImageIndex] = useState(0), [busy, setBusy] = useState(false), [match, setMatch] = useState<string | null>(null);
    const pointer = useRef<number | null>(null);
    const card = q.data?.items?.[index];
    useEffect(() => { setIndex(0); setImageIndex(0); }, [cursor]);
    async function swipe(kind: string) { if (!card || busy)
        return; setBusy(true); try {
        const r = await api('swipes', 'POST', { toId: card.id, kind });
        tg()?.HapticFeedback?.impactOccurred('light');
        setIndex(i => i + 1);
        setImageIndex(0);
        qc.invalidateQueries({ queryKey: ['likes'] });
        if (r.match) {
            setMatch(r.match);
            qc.invalidateQueries({ queryKey: ['conversations'] });
        }
    }
    catch (e) {
        notice(t(errorKey(e)));
    }
    finally {
        setBusy(false);
    } }
    return <section><div className="section-head"><div><p className="eyebrow">{t('tagline')}</p><h1>{t('discover')}<span className="accent">.</span></h1></div><button className="icon" aria-label={t('filters')} onClick={openProfile}><SlidersHorizontal /></button></div>{q.isLoading ? <Loading /> : q.error ? <Empty title={t(errorKey(q.error))}><button className="secondary" onClick={openProfile}>{t('editProfile')}</button></Empty> : card ? <><article className="discovery-card" tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowRight')
        void swipe('LIKE'); if (e.key === 'ArrowLeft')
        void swipe('PASS'); }} onPointerDown={e => { pointer.current = e.clientX; }} onPointerUp={e => { if (pointer.current !== null && Math.abs(e.clientX - pointer.current) > 80)
        void swipe(e.clientX > pointer.current ? 'LIKE' : 'PASS'); pointer.current = null; }}><Portrait url={card.photos[imageIndex]?.url} alt={card.displayName}/><div className="photo-dots">{card.photos.map((p: any, i: number) => <button key={p.id} aria-label={`${t('photo')} ${i + 1}`} className={i === imageIndex ? 'selected' : ''} onClick={() => setImageIndex(i)}/>)}</div><span className="card-label">{card.isTest ? t('fictional') : t(card.goal)}</span><div className="card-copy"><span className="pill glass">{card.city}{card.distance !== null ? ` · ${card.distance} ${t('km')}` : ''}</span><h2>{card.displayName}<span>, {card.age}</span></h2><p>{card.bio}</p>{card.fetish && <p><strong>{t('fetish')}: </strong>{card.fetish}</p>}<div className="chips">{card.interests.slice(0, 4).map((v: string) => <span key={v}>{v}</span>)}</div></div></article><div className="swipe-actions"><button disabled={busy} className="pass" aria-label={t('pass')} onClick={() => void swipe('PASS')}><X size={30}/></button><span>{t('DATING')} · {t('FRIENDSHIP')}</span><button disabled={busy} className="like" aria-label={t('like')} onClick={() => void swipe('LIKE')}><Heart size={29}/></button></div></> : <Empty title={t('noPeople')}><p>{t('noPeopleBody')}</p><button className="secondary" onClick={() => { if (q.data?.nextCursor)
        setCursor(q.data.nextCursor);
    else
        openProfile(); }}>{t(q.data?.nextCursor ? 'next' : 'filters')}</button></Empty>}{match && <Modal title={t('matchTitle')} onClose={() => setMatch(null)}><div className="match-art"><Heart size={70}/></div><p>{t('matchBody')}</p><button className="primary wide" onClick={() => openChat(match)}>{t('startChat')}</button><button className="text-button wide" onClick={() => setMatch(null)}>{t('keepExploring')}</button></Modal>}</section>;
}
function Likes({ me, onPremium, notice }: {
    me: any;
    onPremium: () => void;
    notice: (s: string) => void;
}) { const { t } = useTranslation(); const qc = useQueryClient(); const q = useQuery({ queryKey: ['likes'], queryFn: () => api<any[]>('likes'), enabled: !!me.entitlements.seeLikes }); return <section><h1>{t('likes')}<span className="accent">.</span></h1>{!me.entitlements.seeLikes ? <div className="paywall"><Heart size={64}/><h2>{t('locked')}</h2><p>{t('premiumBody')}</p><button className="primary" onClick={onPremium}>{t('premium')}</button></div> : q.isLoading ? <Loading /> : q.error ? <Empty title={t('error')}/> : !q.data?.length ? <Empty title={t('noLikes')}/> : <div className="likes-grid">{q.data.map(u => <article key={u.id}><Portrait url={u.photos[0]?.url} alt={u.displayName}/><h3>{u.displayName}, {u.age}</h3><button className="secondary wide" onClick={() => void api('swipes', 'POST', { toId: u.id, kind: 'LIKE' }).then(() => qc.invalidateQueries()).catch(e => notice(t(errorKey(e))))}><Heart size={18}/>{t('like')}</button></article>)}</div>}</section>; }
function Premium({ me, notice }: {
    me: any;
    notice: (s: string) => void;
}) { const { t } = useTranslation(); const qc = useQueryClient(); const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<any[]>('plans') }); const history = useQuery({ queryKey: ['payments'], queryFn: () => api<any[]>('payments') }); const [busy, setBusy] = useState(false); async function buy(planId: string) { setBusy(true); try {
    const p = await api('payments/invoice', 'POST', { planId });
    if (tg()?.openInvoice)
        tg()!.openInvoice!(p.url, (status) => { notice(t(status === 'paid' ? 'paymentPending' : 'paymentCancelled')); void qc.invalidateQueries({ queryKey: ['me'] }); void qc.invalidateQueries({ queryKey: ['payments'] }); });
    else
        window.open(p.url, '_blank', 'noopener,noreferrer');
}
catch (e) {
    notice(t(errorKey(e)));
}
finally {
    setBusy(false);
} } return <section className="premium-page"><span className="pill premium-label"><Sparkles size={16}/> {t('premium')}</span><h1>{t('premiumTitle')}</h1><p className="muted">{t('premiumBody')}</p>{me.premiumUntil && <p>{t('activeUntil')}: {new Date(me.premiumUntil).toLocaleDateString()}</p>}<ul className="benefits">{['likes', 'dailyStarts', 'discover'].map(k => <li key={k}><Check size={18}/>{t(k)}</li>)}</ul>{plans.data?.map((p, i) => <button key={p.id} disabled={busy} className={`plan ${i === 1 ? 'featured' : ''}`} onClick={() => void buy(p.id)}><div><small>{p.id}</small><strong>{p.days} {t('days')}</strong></div><div><strong>★ {p.stars}</strong><span>{t('stars')}</span></div><ArrowUpRight /></button>)}<p className="muted">{t('oneTime')}</p><button className="secondary" onClick={() => void qc.invalidateQueries()}>{t('refresh')}</button><h2>{t('payments')}</h2>{history.data?.map(p => <div className="row" key={p.id}><span>{p.planId} · ★ {p.stars}</span><span className="muted">{t(p.status)}</span></div>)}</section>; }
function Inbox({ openChat }: {
    openChat: (id: string) => void;
}) { const { t } = useTranslation(); const q = useQuery({ queryKey: ['conversations'], queryFn: () => api<any[]>('conversations'), refetchInterval: 15000 }); return <section><h1>{t('chats')}<span className="accent">.</span></h1>{q.isLoading ? <Loading /> : q.error ? <Empty title={t('error')}/> : !q.data?.length ? <Empty title={t('noChats')}/> : q.data.map(c => <button className="chat-row" key={c.id} onClick={() => openChat(c.id)}><Portrait url={c.other?.photos[0]?.url} alt={c.other?.displayName || ''}/><div><h3>{c.other?.displayName}</h3><p>{c.last?.body || t(c.last?.photoId ? 'photo' : 'startChat')}</p></div>{c.last && (!c.readAt || c.last.createdAt > c.readAt) && <span className="unread"/>}<ArrowUpRight /></button>)}</section>; }
function Chat({ id, me, notice, onClose }: {
    id: string;
    me: any;
    notice: (s: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [body, setBody] = useState(''), [busy, setBusy] = useState(false), [report, setReport] = useState(false), [reason, setReason] = useState('SPAM'), [note, setNote] = useState(''), [older, setOlder] = useState<any[]>([]), [cursor, setCursor] = useState<string | undefined>();
    const [typing, setTyping] = useState(false);
    const pending = useRef<{
        body: string;
        clientId: string;
        photoId?: string;
    } | null>(null);
    const scroll = useRef<HTMLDivElement>(null);
    const q = useQuery({ queryKey: ['messages', id], queryFn: () => api(`conversations/${id}/messages`), refetchInterval: 6000 });
    const chats = useQuery({ queryKey: ['conversations'], queryFn: () => api<any[]>('conversations') });
    const c = chats.data?.find(x => x.id === id);
    useEffect(() => { void api(`conversations/${id}/read`, 'POST').catch(() => { }); scroll.current?.scrollIntoView({ behavior: 'smooth' }); }, [id, q.data?.items?.[0]?.id]);
    useEffect(() => { const s = io(base || location.origin, { withCredentials: true, auth: { csrf: getCsrf() } }); let timer: ReturnType<typeof setTimeout>; s.on('typing', (p) => { if (p.conversationId === id) {
        setTyping(true);
        clearTimeout(timer);
        timer = setTimeout(() => setTyping(false), 2500);
    } }); const inputHandler = () => s.emit('typing', { conversationId: id }); document.addEventListener('vela-typing', inputHandler); return () => { clearTimeout(timer); document.removeEventListener('vela-typing', inputHandler); s.disconnect(); }; }, [id]);
    async function send(photoId?: string) { if (busy || !body.trim() && !photoId)
        return; setBusy(true); const data = pending.current?.body === body && pending.current?.photoId === photoId ? pending.current : { body, photoId, clientId: crypto.randomUUID() }; pending.current = data; try {
        await api(`conversations/${id}/messages`, 'POST', data);
        pending.current = null;
        setBody('');
        await qc.invalidateQueries({ queryKey: ['messages', id] });
        await qc.invalidateQueries({ queryKey: ['conversations'] });
    }
    catch (e) {
        notice(t(errorKey(e)));
    }
    finally {
        setBusy(false);
    } }
    async function attach(file: File) { setBusy(true); try {
        const f = new FormData();
        f.append('file', file);
        f.append('purpose', 'CHAT');
        const p = await api('photos', 'POST', f);
        const data = { body: '', photoId: p.id, clientId: crypto.randomUUID() };
        await api(`conversations/${id}/messages`, 'POST', data);
        await qc.invalidateQueries({ queryKey: ['messages', id] });
    }
    catch (e) {
        notice(t(errorKey(e)));
    }
    finally {
        setBusy(false);
    } }
    const all = [...new Map([...older, ...(q.data?.items || [])].map(m => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return <section className="chat-page"><header className="chat-header"><button className="icon" aria-label={t('back')} onClick={onClose}><ChevronLeft /></button><Portrait url={c?.other?.photos[0]?.url} alt={c?.other?.displayName || ''}/><div><h2>{c?.other?.displayName}</h2><small>{typing ? t('typing') : t('chats')}</small></div><button className="icon" aria-label={t('report')} onClick={() => setReport(true)}><Shield /></button></header><div className="messages">{q.error ? <Empty title={t(errorKey(q.error))}/> : q.isLoading ? <Loading /> : <>{(cursor === undefined ? q.data?.nextCursor : cursor) && <button className="text-button" onClick={() => void api(`conversations/${id}/messages?cursor=${cursor === undefined ? q.data.nextCursor : cursor}`).then(p => { setOlder(x => [...x, ...p.items]); setCursor(p.nextCursor); }).catch(e => notice(t(errorKey(e))))}>{t('loadOlder')}</button>}{all.map(m => <div className={`bubble ${m.senderId === me.id ? 'mine' : ''}`} key={m.id}>{m.image && <img src={m.image} alt={t('photo')}/>}<p>{m.body}</p><small>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {m.senderId === me.id ? t(c?.otherReadAt && c.otherReadAt >= m.createdAt ? 'seen' : 'sent') : ''}</small></div>)}<div ref={scroll}/></>}</div><form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="icon"><Paperclip /><span className="sr-only">{t('attach')}</span><input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e => { if (e.target.files?.[0])
        void attach(e.target.files[0]); e.target.value = ''; }}/></label><input value={body} maxLength={2000} aria-label={t('message')} placeholder={t('message')} onChange={e => { setBody(e.target.value); document.dispatchEvent(new Event('vela-typing')); }}/><button className="icon primary" disabled={busy || !body.trim()} aria-label={t('send')}><Send size={20}/></button></form>{report && <Modal title={t('safety')} onClose={() => setReport(false)}><label>{t('reportReason')}<select value={reason} onChange={e => setReason(e.target.value)}>{['SPAM', 'HARASSMENT', 'UNDERAGE', 'FAKE', 'OTHER'].map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label><label>{t('reportNote')}<textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)}/></label><button className="primary wide" onClick={() => void api('reports', 'POST', { toId: c?.other?.id, reason, note }).then(onClose).catch(e => notice(t(errorKey(e))))}>{t('report')}</button><button className="secondary wide" onClick={() => { if (confirm(t('confirmAction')))
        void api(`blocks/${c?.other?.id}`, 'POST').then(onClose).catch(e => notice(t(errorKey(e)))); }}>{t('block')}</button><button className="text-button wide" onClick={() => { if (confirm(t('confirmAction')))
        void api(`conversations/${id}`, 'DELETE').then(onClose).catch(e => notice(t(errorKey(e)))); }}>{t('unmatch')}</button></Modal>}</section>;
}
function Account({ me, notice, onEdit, onPremium, onLogout, onAdmin }: {
    me: any;
    notice: (s: string) => void;
    onEdit: () => void;
    onPremium: () => void;
    onLogout: () => void;
    onAdmin: () => void;
}) { const { t } = useTranslation(); const qc = useQueryClient(); const [legal, setLegal] = useState<string | null>(null), [del, setDel] = useState(false), [confirmText, setConfirmText] = useState(''); const blocked = useQuery({ queryKey: ['blocks'], queryFn: () => api<any[]>('blocks') }); const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark'); async function update(data: unknown) { try {
    await api('settings', 'PUT', data);
    await qc.invalidateQueries({ queryKey: ['me'] });
}
catch (e) {
    notice(t(errorKey(e)));
} } return <section><div className="section-head"><h1>{t('profile')}</h1><SettingsIcon /></div><div className="account-card"><Portrait url={me.photos?.[0]?.url} alt={me.profile?.displayName || me.firstName}/><h2>{me.profile?.displayName || me.firstName}</h2><p className="muted">{me.profile?.city}</p><button className="secondary" onClick={onEdit}>{t('editProfile')}</button></div><button className="premium-banner" onClick={onPremium}><Sparkles /><div><h3>{t('premium')}</h3><p>{t('premiumTitle')}</p></div><ArrowUpRight /></button>{me.entitlements.dailyStarts === 3 && <p className="muted">{t('freeRule')}</p>}<Language onChange={locale => void update({ locale })}/><label>{t('theme')}<select value={theme} onChange={e => { setTheme(e.target.value); document.documentElement.dataset.theme = e.target.value; localStorage.setItem('vela_theme', e.target.value); }}><option value="dark">{t('dark')}</option><option value="light">{t('light')}</option></select></label><label className="check"><input type="checkbox" checked={me.notifications} onChange={e => { const checked = e.target.checked; if (checked && tg()?.requestWriteAccess)
    tg()!.requestWriteAccess!(ok => { if (ok)
        void update({ notifications: true }); });
else
    void update({ notifications: checked }); }}/>{t('notifications')}</label><h3>{t('safety')}</h3><p className="muted">{t('safetyBody')}</p><div className="row">{['terms', 'privacy', 'safety'].map(k => <button className="text-button" key={k} onClick={() => setLegal(k)}>{t(k)}</button>)}</div><h3>{t('blocked')}</h3>{blocked.data?.map(b => <div className="row" key={b.toId}>{b.to.firstName}<button className="text-button" onClick={() => void api(`blocks/${b.toId}`, 'DELETE').then(() => qc.invalidateQueries({ queryKey: ['blocks'] })).catch(e => notice(t(errorKey(e))))}>{t('unblock')}</button></div>)}{me.role === 'ADMIN' && <button className="secondary wide" onClick={onAdmin}><Shield />{t('admin')}</button>}<button className="secondary wide" onClick={() => void api('auth/logout', 'POST').then(onLogout).catch(e => notice(t(errorKey(e))))}><LogOut size={18}/>{t('logout')}</button><button className="danger text-button wide" onClick={() => setDel(true)}>{t('deleteAccount')}</button>{legal && <Legal kind={legal} onClose={() => setLegal(null)}/>}{del && <Modal title={t('deleteAccount')} onClose={() => setDel(false)}><p>{t('deleteWarning')}</p><label>{t('deleteConfirm')}<input dir="ltr" value={confirmText} onChange={e => setConfirmText(e.target.value)}/></label><button className="primary danger-bg wide" disabled={confirmText !== 'DELETE'} onClick={() => void api('users/me', 'DELETE', { confirm: 'DELETE' }).then(() => { onLogout(); notice(t('accountDeleted')); }).catch(e => notice(t(errorKey(e))))}>{t('deleteFinal')}</button></Modal>}</section>; }
function App() { const { t } = useTranslation(); const qc = useQueryClient(); const me = useQuery({ queryKey: ['me'], queryFn: () => api('auth/me') }); const [tab, setTab] = useState('discover'), [editing, setEditing] = useState(false), [chat, setChat] = useState<string | null>(null), [toast, setToast] = useState(''); const notice = (s: string) => setToast(s); useEffect(() => { tg()?.ready(); tg()?.expand(); document.documentElement.dataset.theme = localStorage.getItem('vela_theme') || tg()?.colorScheme || 'dark'; }, []); useEffect(() => { if (!toast)
    return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]); useEffect(() => { if (me.data) {
    setCsrf(me.data.csrf);
    changeLanguage(me.data.locale);
    const s = io(base || location.origin, { withCredentials: true, auth: { csrf: me.data.csrf } });
    for (const name of ['message', 'match', 'read'])
        s.on(name, () => { void qc.invalidateQueries({ queryKey: ['conversations'] }); void qc.invalidateQueries({ queryKey: ['messages'] }); });
    return () => { s.disconnect(); };
} }, [me.data?.id, me.data?.csrf]); useEffect(() => { const b = tg()?.BackButton; const back = () => { setChat(null); setEditing(false); setTab('discover'); }; if (chat || editing || tab === 'premium' || tab === 'admin') {
    b?.show();
    b?.onClick(back);
}
else
    b?.hide(); return () => b?.offClick(back); }, [chat, editing, tab]); const logout = () => { setCsrf(''); qc.clear(); setTab('discover'); setChat(null); }; let surface; if (me.isLoading)
    surface = <main className="welcome"><Loading /></main>;
else if (!me.data)
    surface = <Welcome notice={notice} onLogin={() => void qc.invalidateQueries({ queryKey: ['me'] })}/>;
else if (editing || !me.data.profile)
    surface = <div className="app-shell"><ProfileEditor me={me.data} notice={notice} onClose={() => { setEditing(false); void qc.invalidateQueries(); }}/></div>;
else
    surface = <div className="app-shell"><header className="app-header"><a href="/" className="wordmark">kisser<span>✳</span></a><button className="pill" onClick={() => setTab('premium')}><Sparkles size={14}/>{t('premium')}</button></header>{me.data.isTest && <div className="test-ribbon">{t('testMode')}</div>}<main className="content">{chat ? <Chat id={chat} me={me.data} notice={notice} onClose={() => { setChat(null); void qc.invalidateQueries({ queryKey: ['conversations'] }); }}/> : tab === 'discover' ? <Discover notice={notice} openProfile={() => setEditing(true)} openChat={setChat}/> : tab === 'likes' ? <Likes me={me.data} notice={notice} onPremium={() => setTab('premium')}/> : tab === 'chats' ? <Inbox openChat={setChat}/> : tab === 'premium' ? <Premium me={me.data} notice={notice}/> : tab === 'admin' ? <Admin notice={notice}/> : <Account me={me.data} notice={notice} onEdit={() => setEditing(true)} onPremium={() => setTab('premium')} onLogout={logout} onAdmin={() => setTab('admin')}/>}</main>{!chat && <nav className="bottom-nav">{[['discover', Compass], ['likes', Heart], ['chats', MessageCircle], ['profile', UserRound]].map(([k, Icon]) => { const key = k as string; const I = Icon as typeof Compass; return <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><I size={22}/><span>{t(key)}</span></button>; })}</nav>}</div>; return <>{surface}{toast && <div className="toast" role="status" onClick={() => setToast('')}>{toast}</div>}</>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></React.StrictMode>);
