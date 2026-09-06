import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react';
import { filterSchema, genders, goals } from '../../../packages/shared/validation';
import { languageNames } from './i18n';
import { api } from './api';
import { errorKey } from './main';

export function FilterEditor({ profile, onClose, notice }: { profile: any; onClose: () => void; notice: (s: string) => void }) {
    const { t } = useTranslation(); const qc = useQueryClient();
    const [form, setForm] = useState(() => filterSchema.parse(Object.fromEntries(
        ['interestedIn', 'minAge', 'maxAge', 'maxDistance', 'latitude', 'longitude', 'filterLanguages', 'filterInterests', 'filterGoal'].map(k => [k, profile[k]])
    )));
    const [interests, setInterests] = useState(form.filterInterests.join(', '));
    const [busy, setBusy] = useState(false);
    const set = (key: string, value: unknown) => setForm(p => ({ ...p, [key]: value }));
    const toggle = (key: 'interestedIn' | 'filterLanguages', value: string) => {
        const values: string[] = form[key]; set(key, values.includes(value) ? values.filter(x => x !== value) : [...values, value]);
    };
    async function save() {
        const result = filterSchema.safeParse({ ...form, filterInterests: interests.split(/[,،]/).map(x => x.trim()).filter(Boolean) });
        if (!result.success) { notice(t('validation')); return; }
        setBusy(true);
        try {
            await api('profile/filters', 'PUT', result.data);
            await Promise.all([qc.invalidateQueries({ queryKey: ['me'] }), qc.invalidateQueries({ queryKey: ['discovery'] })]);
            notice(t('saved')); onClose();
        } catch (error) { notice(t(errorKey(error))); }
        finally { setBusy(false); }
    }
    return <main className="profile-editor">
        <header className="section-head"><button className="icon" onClick={onClose} aria-label={t('back')} disabled={busy}><ArrowLeft /></button><h1>{t('filters')}</h1></header>
        <form onSubmit={e => { e.preventDefault(); if (!busy) void save(); }}>
            <fieldset disabled={busy}><legend>{t('interestedIn')}</legend><div className="choices">{genders.map(g => <label className="choice" key={g}><input type="checkbox" checked={form.interestedIn.includes(g)} onChange={() => toggle('interestedIn', g)}/>{t(g)}</label>)}</div></fieldset>
            <div className="form-grid">{(['minAge', 'maxAge'] as const).map(k => <label key={k}>{t(k)}<input type="number" required min={18} max={100} value={form[k]} onChange={e => set(k, Number(e.target.value))}/></label>)}</div>
            <label>{t('maxDistance')}<input type="number" required min={1} max={20000} value={form.maxDistance} onChange={e => set('maxDistance', Number(e.target.value))}/></label>
            <button type="button" className="secondary" onClick={() => {
                if (!navigator.geolocation) { notice(t('error')); return; }
                navigator.geolocation.getCurrentPosition(({ coords }) => setForm(p => ({ ...p, latitude: Math.round(coords.latitude * 100) / 100, longitude: Math.round(coords.longitude * 100) / 100 })), () => notice(t('error')), { timeout: 10000 });
            }}><MapPin size={18}/>{t('location')}</button>
            {form.latitude !== null && <button type="button" className="text-button" onClick={() => setForm(p => ({ ...p, latitude: null, longitude: null }))}>{t('clearLocation')}</button>}
            <fieldset><legend>{t('filterLanguages')}</legend><div className="choices">{Object.entries(languageNames).map(([k, name]) => <label className="choice" key={k}><input type="checkbox" checked={(form.filterLanguages as string[]).includes(k)} onChange={() => toggle('filterLanguages', k)}/>{name}</label>)}</div></fieldset>
            <label>{t('filterInterests')}<input value={interests} onChange={e => setInterests(e.target.value)} maxLength={400}/></label>
            <label>{t('goal')}<select value={form.filterGoal || ''} onChange={e => set('filterGoal', e.target.value || null)}><option value="">{t('anyGoal')}</option>{goals.map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label>
            <button className="primary wide" disabled={busy}>{t(busy ? 'loading' : 'save')}</button>
        </form>
    </main>;
}
