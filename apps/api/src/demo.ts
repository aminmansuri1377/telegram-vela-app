export function demoAccess(user: { telegramId: string; isTest?: boolean }) {
    return !user.isTest && process.env.DEMO_PROFILES_ENABLED === 'true' &&
        (process.env.DEMO_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(user.telegramId);
}
export function demoPairAllowed(a: { telegramId: string; isTest: boolean }, b: { telegramId: string; isTest: boolean }) {
    return process.env.NODE_ENV !== 'production' || !a.isTest && !b.isTest || a.isTest && demoAccess(b) || b.isTest && demoAccess(a);
}
