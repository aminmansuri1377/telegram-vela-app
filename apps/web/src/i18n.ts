import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { locales } from '../../../packages/shared/validation';
const files = import.meta.glob<Record<string, string>>('./locales/*.json', { eager: true, import: 'default' });
const resources = Object.fromEntries(locales.map(l => [l, { translation: files[`./locales/${l}.json`] }]));
export const languageNames: Record<string, string> = { en: 'English', zh: '简体中文', ru: 'Русский', hi: 'हिन्दी', ur: 'اردو', fa: 'فارسی', ar: 'العربية', tr: 'Türkçe', es: 'Español', de: 'Deutsch', it: 'Italiano' };
const initial = localStorage.getItem('vela_language') || 'en';
void i18n.use(initReactI18next).init({ resources, lng: locales.includes(initial as typeof locales[number]) ? initial : 'en', fallbackLng: 'en', interpolation: { escapeValue: false } });
export function changeLanguage(locale: string) { void i18n.changeLanguage(locale); localStorage.setItem('vela_language', locale); document.documentElement.lang = locale; document.documentElement.dir = ['fa', 'ar', 'ur'].includes(locale) ? 'rtl' : 'ltr'; }
changeLanguage(i18n.language || 'en');
export default i18n;
