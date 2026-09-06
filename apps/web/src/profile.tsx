import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, MapPin, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { Portrait } from './ui';
import { languageNames } from './i18n';
import { errorKey } from './main';
import { genders, goals, profileSchema } from '../../../packages/shared/validation';
export function ProfileEditor({ me, onClose, notice }: {
    me: any;
    onClose: () => void;
    notice: (s: string) => void;
}) { const { t } = useTranslation(); const qc = useQueryClient(); const p = me.profile; const [form, setForm] = useState<any>({ displayName: p?.displayName || me.firstName, birthDate: p?.birthDate?.slice(0, 10) || '', gender: p?.gender || 'OTHER', interestedIn: p?.interestedIn || ['MALE', 'FEMALE', 'OTHER'], bio: p?.bio || '', city: p?.city || '', country: p?.country || '', languages: p?.languages || [me.locale], interests: p?.interests || [], goal: p?.goal || 'DATING', visible: p?.visible ?? true, minAge: p?.minAge || 18, maxAge: p?.maxAge || 60, maxDistance: p?.maxDistance || 500, latitude: p?.latitude ?? null, longitude: p?.longitude ?? null, filterLanguages: p?.filterLanguages || [], filterInterests: p?.filterInterests || [], filterGoal: p?.filterGoal || null, terms: !!p }); const [busy, setBusy] = useState(false); function set(k: string, v: unknown) { setForm((s: any) => ({ ...s, [k]: v })); } async function save() { const valid = profileSchema.safeParse({ ...form, interests: form.interests.map((s: string) => s.trim()).filter(Boolean), filterInterests: form.filterInterests.map((s: string) => s.trim()).filter(Boolean) }); if (!valid.success) {
    notice(t('validation'));
    return;
} setBusy(true); try {
    await api('profile', 'PUT', valid.data);
    notice(t('saved'));
    onClose();
}
catch (e) {
    notice(t(errorKey(e)));
}
finally {
    setBusy(false);
} } async function upload(file: File) { setBusy(true); try {
    const f = new FormData();
    f.append('file', file);
    f.append('purpose', 'PROFILE');
    await api('photos', 'POST', f);
    await qc.invalidateQueries({ queryKey: ['me'] });
    notice(t('photoPending'));
}
catch (e) {
    notice(t(errorKey(e)));
}
finally {
    setBusy(false);
} } const toggle = (key: string, value: string) => set(key, form[key].includes(value) ? form[key].filter((x: string) => x !== value) : [...form[key], value]); return <main className="profile-editor"><header className="section-head"><button className="icon" aria-label={t('back')} onClick={onClose}><ArrowLeft /></button><span className="wordmark">vela<span>✳</span></span><span className="pill">18+</span></header><p className="eyebrow">{t('profile')}</p><h1>{t(p ? 'editProfile' : 'setupProfile')}</h1><p className="muted">{t('setupBody')}</p><form onSubmit={e => { e.preventDefault(); void save(); }}><div className="form-grid"><label>{t('name')}<input value={form.displayName} onChange={e => set('displayName', e.target.value)} maxLength={40} required/></label><label>{t('birthDate')}<input type="date" required value={form.birthDate} onChange={e => set('birthDate', e.target.value)}/></label></div><label>{t('gender')}<select value={form.gender} onChange={e => set('gender', e.target.value)}>{genders.map(k => <option value={k} key={k}>{t(k)}</option>)}</select></label><fieldset><legend>{t('interestedIn')}</legend><div className="choices">{genders.map(k => <label className="choice" key={k}><input type="checkbox" checked={form.interestedIn.includes(k)} onChange={() => toggle('interestedIn', k)}/>{t(k)}</label>)}</div></fieldset><label>{t('bio')}<textarea value={form.bio} maxLength={500} rows={3} onChange={e => set('bio', e.target.value)}/><small>{form.bio.length}/500</small></label><div className="form-grid">{['city', 'country'].map(k => <label key={k}>{t(k)}<input required value={form[k]} maxLength={80} onChange={e => set(k, e.target.value)}/></label>)}</div><fieldset><legend>{t('languages')}</legend><div className="choices">{Object.entries(languageNames).map(([k, v]) => <label className="choice" key={k}><input type="checkbox" checked={form.languages.includes(k)} onChange={() => toggle('languages', k)}/>{v}</label>)}</div></fieldset><label>{t('interests')}<input value={form.interests.join(', ')} onChange={e => set('interests', e.target.value.split(',').map(x => x.trimStart()))}/></label><label>{t('goal')}<select value={form.goal} onChange={e => set('goal', e.target.value)}>{goals.map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label><h2>{t('photos')}</h2><p className="muted">{t('photoHint')}</p><div className="photo-grid">{me.photos?.map((photo: any, i: number) => <div key={photo.id}><Portrait url={photo.url} alt={t('photo')}/><small>{photo.status === 'PENDING' ? t('photoPending') : photo.status === 'REJECTED' ? t('photoRejected') : i === 0 ? '★' : ''}</small><button type="button" className="text-button" disabled={busy} onClick={() => void api(`photos/${photo.id}`, 'DELETE').then(() => qc.invalidateQueries({ queryKey: ['me'] })).catch(e => notice(t(errorKey(e))))}>{t('remove')}</button>{i > 0 && <button type="button" className="text-button" onClick={() => void api('photos/order', 'PUT', { ids: [photo.id, ...me.photos.filter((x: any) => x.id !== photo.id).map((x: any) => x.id)] }).then(() => qc.invalidateQueries({ queryKey: ['me'] })).catch(e => notice(t(errorKey(e))))}>{t('mainPhoto')}</button>}</div>)}{me.photos?.length < 6 && <label className="upload-tile"><Plus /><span>{t('upload')}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} hidden onChange={e => { if (e.target.files?.[0])
    void upload(e.target.files[0]); e.target.value = ''; }}/></label>}</div><h2>{t('filters')}</h2><div className="form-grid">{['minAge', 'maxAge'].map(k => <label key={k}>{t(k)}<input type="number" min={18} max={100} value={form[k]} onChange={e => set(k, Number(e.target.value))}/></label>)}</div><label>{t('maxDistance')}<input type="number" min={1} max={20000} value={form.maxDistance} onChange={e => set('maxDistance', Number(e.target.value))}/></label><button type="button" className="secondary" onClick={() => navigator.geolocation.getCurrentPosition(loc => { setForm((s: any) => ({ ...s, latitude: Math.round(loc.coords.latitude * 100) / 100, longitude: Math.round(loc.coords.longitude * 100) / 100 })); notice(t('locationSaved')); }, () => notice(t('error')), { enableHighAccuracy: false, timeout: 10000 })}><MapPin size={17}/>{t('location')}</button>{form.latitude !== null && <button type="button" className="text-button" onClick={() => setForm((s: any) => ({ ...s, latitude: null, longitude: null }))}>{t('clearLocation')}</button>}<fieldset><legend>{t('filterLanguages')}</legend><div className="choices">{Object.entries(languageNames).map(([k, v]) => <label className="choice" key={k}><input type="checkbox" checked={form.filterLanguages.includes(k)} onChange={() => toggle('filterLanguages', k)}/>{v}</label>)}</div></fieldset><label>{t('filterInterests')}<input value={form.filterInterests.join(', ')} onChange={e => set('filterInterests', e.target.value ? e.target.value.split(',').map(x => x.trimStart()) : [])}/></label><label>{t('goal')}<select value={form.filterGoal || ''} onChange={e => set('filterGoal', e.target.value || null)}><option value="">{t('anyGoal')}</option>{goals.map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label><label className="check"><input type="checkbox" checked={form.visible} onChange={e => set('visible', e.target.checked)}/>{t('visible')}</label><label className="check"><input type="checkbox" required checked={form.terms} onChange={e => set('terms', e.target.checked)}/>{t('termsAgree')}</label><button className="primary wide" disabled={busy}><Check size={18}/>{t(busy ? 'loading' : 'save')}</button></form></main>; }
