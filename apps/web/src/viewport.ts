import { useEffect } from 'react';

/** Visual viewport shrinks with the mobile keyboard; older clients use innerHeight. */
export function useChatViewport(active: boolean) {
    useEffect(() => {
        if (!active) return;
        const viewport = window.visualViewport;
        const update = () => document.documentElement.style.setProperty('--chat-viewport-height', `${viewport?.height || window.innerHeight}px`);
        update();
        viewport?.addEventListener('resize', update);
        window.addEventListener('resize', update);
        return () => {
            viewport?.removeEventListener('resize', update);
            window.removeEventListener('resize', update);
            document.documentElement.style.removeProperty('--chat-viewport-height');
        };
    }, [active]);
}
