# UI structure

Visual direction: charcoal interface, warm vermilion action color, restrained lime membership accents, large editorial headings and photo-led cards. Reusable primitives: Portrait, Modal (native dialog), Empty, Loading, Language selector; common tokens in styles.css. Light theme and RTL use the same components.

| Surface | Primary layout | Main action |
|---|---|---|
| Welcome | Brand, language, fictional portrait art, login, 18+ notice, legal links | Telegram or development login |
| Profile setup/edit | Personal fields, language choices, photo grid, preferences, consent | Save validated profile |
| Discovery | Header/filter, one photo card, photo selectors, pass/like controls | Swipe or accessible buttons |
| Likes | Entitlement gate or profile grid | Subscribe or like back |
| Connections | Avatar, name, latest message, unread dot | Open chat |
| Chat | Back/profile/safety header, message stream, image/text composer | Send; report/block/unmatch |
| Membership | Benefits, 7/30/90-day plans, history | Telegram Stars invoice |
| Account | Own profile, language/theme, notifications, safety, blocks, logout | Edit or delete account |
| Admin | Counters, resource tabs, bounded lists, edit dialogs | Moderate/update |

Bottom navigation is fixed with four sections: Discover, Likes, Connections, Your space. Chat replaces the navigation with a composer. RTL flips reading direction while left/right swipe semantics remain physical (right=like, left=pass). Telegram BackButton returns to discovery. Native dialogs supply focus handling; Escape closes them. Reduced-motion preferences disable animation.

The app is not visually verified in a live browser in this environment. Validate mobile keyboards, zoom, screen readers, long translations and Telegram safe-area behavior on actual devices before launch. In particular, Telegram fullscreen safe-area events are not implemented; this version uses ordinary expanded mode and CSS env safe areas.
