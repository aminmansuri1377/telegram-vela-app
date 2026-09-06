type WebApp = {
    initData: string;
    ready: () => void;
    expand: () => void;
    colorScheme?: string;
    requestWriteAccess?: (callback: (ok: boolean) => void) => void;
    openInvoice?: (url: string, callback: (status: string) => void) => void;
    HapticFeedback?: {
        impactOccurred: (style: string) => void;
    };
    onEvent?: (name: string, handler: () => void) => void;
    offEvent?: (name: string, handler: () => void) => void;
    BackButton?: {
        show: () => void;
        hide: () => void;
        onClick: (fn: () => void) => void;
        offClick: (fn: () => void) => void;
    };
};
declare global {
    interface Window {
        Telegram?: {
            WebApp: WebApp;
        };
    }
}
export const tg = () => window.Telegram?.WebApp;
