// Inline SVG icon set — simple, single-stroke, warm Pinterest-y
const Icon = ({ name, size = 20, stroke = 1.6 }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch(name){
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'hourglass': return <svg {...p}><path d="M7 3h10M7 21h10"/><path d="M8 3c0 4 2 6 4 7m0 0c2 1 4 3 4 7M16 3c0 4-2 6-4 7m0 0c-2 1-4 3-4 7"/><path d="M9 19c0-2.2 1.3-3.5 3-4 1.7.5 3 1.8 3 4z" fill="currentColor" opacity=".25" stroke="none"/></svg>;
    case 'shield': return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>;
    case 'question': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.6-2.5 1.8-2.5 3.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>;
    case 'ruler': return <svg {...p}><rect x="3" y="9" width="18" height="6" rx="1.2"/><path d="M7 9v2M10 9v3M13 9v2M16 9v3M19 9v2"/></svg>;
    case 'box': return <svg {...p}><path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/></svg>;
    case 'shirt': return <svg {...p}><path d="M7 4l3 2 2 1 2-1 3-2 3 3-3 3v9H6v-9L3 7z"/></svg>;
    case 'checkbox': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M8 12l3 3 5-5"/></svg>;
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
    case 'bulb': return <svg {...p}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10c1 .8 1.5 1.6 1.5 3h5c0-1.4.5-2.2 1.5-3A6 6 0 0012 3z"/></svg>;
    case 'gift': return <svg {...p}><rect x="3" y="8" width="18" height="5" rx="1.2"/><path d="M4 13v8h16v-8M12 8v13"/><path d="M12 8c-2-4-6-2-4 0M12 8c2-4 6-2 4 0"/></svg>;
    case 'sparkle': return <svg {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>;
    case 'heart': return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></svg>;
    case 'heart-filled': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></svg>;
    case 'check': return <svg {...p}><path d="M5 12l5 5L20 7"/></svg>;
    case 'check-circle': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>;
    case 'alert': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg>;
    case 'plus': return <svg {...p}><path d="M5 12h14M12 5v14"/></svg>;
    case 'arrow-right': return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-up-right': return <svg {...p}><path d="M7 17L17 7M9 7h8v8"/></svg>;
    case 'chevron-right': return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'sprout': return <svg {...p}><path d="M12 20v-7"/><path d="M12 13c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 13c3 0 5-2 5-5-3 0-5 2-5 5z"/></svg>;
    case 'user': return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>;
    case 'home': return <svg {...p}><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z"/></svg>;
    case 'kids': return <svg {...p}><circle cx="9" cy="7" r="3"/><circle cx="16" cy="7" r="2"/><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5"/><path d="M14 19c.5-2 2-3.5 4-3.5"/></svg>;
    case 'family': return <svg {...p}><circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="8" r="2.5"/><circle cx="12" cy="13" r="1.8"/><path d="M3 20c.5-2.5 2-4 4-4M21 20c-.5-2.5-2-4-4-4M9 21c.5-2 1.5-3 3-3s2.5 1 3 3"/></svg>;
    case 'pinterest': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.6s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.1 1.7 2.1 2.1 0 3.6-2.6 3.6-5.7 0-2.4-1.6-4.1-4-4.1a4.2 4.2 0 00-4.3 4.3c0 .8.3 1.7.7 2.2.1.1.1.2.1.3l-.3 1.2c-.1.3-.2.4-.5.2-1.3-.6-2.1-2.5-2.1-4 0-3.2 2.4-6.2 6.8-6.2 3.6 0 6.3 2.5 6.3 5.9 0 3.6-2.2 6.5-5.4 6.5-1 0-2-.6-2.4-1.2l-.6 2.4c-.2.9-.8 2-1.2 2.7A10 10 0 1012 2z"/></svg>;
    case 'tg': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.2L2.8 11.4c-1.1.4-1.1 1 .2 1.4l4.7 1.4 1.8 5.7c.2.6.7.6 1.2.2l2.6-2.2 4.6 3.4c.9.5 1.5.2 1.7-.8L21.6 5c.2-1-.4-1.4-1.1-1.1zm-3.2 4l-7.7 7-.3 3-1.4-4.4 9.4-5.6z"/></svg>;
    case 'ig': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".5" fill="currentColor"/></svg>;
    case 'vk': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.7 17.2c-5.4 0-8.4-3.7-8.5-9.8h2.7c.1 4.5 2.1 6.4 3.6 6.8V7.4h2.6V11c1.5-.2 3.1-1.9 3.6-3.6h2.6c-.4 2.2-2 3.9-3.2 4.6 1.2.5 3 2 3.8 4.7h-2.8c-.6-1.9-2-3.4-4-3.6v3.6c-.2-.1-.3-.5-.4-1.5z"/></svg>;
    case 'arrow-loop': return <svg {...p}><path d="M4 9h11a4 4 0 010 8H8"/><path d="M12 5l-3 4 3 4"/></svg>;
    case 'leaf': return <svg {...p}><path d="M5 19c1-9 7-13 14-13 0 8-4 13-13 14"/><path d="M5 19c3-3 6-5 9-6"/></svg>;

    /* ─── illustrative icons for problem cards ─── */
    case 'pain-time': return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* Hourglass: time draining away */}
        <path d="M13 6h22M13 42h22"/>
        <path d="M15 6c0 6 3 9 9 12-6 3-9 6-9 12"/>
        <path d="M33 6c0 6-3 9-9 12 6 3 9 6 9 12"/>
        {/* sand top */}
        <path d="M17 9c0 3 2 5 7 7 5-2 7-4 7-7" fill="currentColor" opacity="0.18" stroke="none"/>
        {/* sand pile bottom */}
        <path d="M17 39c0-4 2-6 7-7 5 1 7 3 7 7" fill="currentColor" opacity="0.18" stroke="none"/>
        {/* falling grains */}
        <circle cx="24" cy="22" r="0.8" fill="currentColor"/>
        <circle cx="24" cy="26" r="0.6" fill="currentColor"/>
        <circle cx="24" cy="30" r="0.5" fill="currentColor"/>
      </svg>
    );

    case 'pain-mismatch': return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* Three shapes that don't fit together — square, circle, triangle */}
        <rect x="5" y="7" width="14" height="14" rx="1.5"/>
        <circle cx="34" cy="14" r="7.5"/>
        <path d="M14 41 L24 25 L34 41 Z"/>
        {/* tiny "no-fit" sparks between them */}
        <path d="M22 13 L26 13 M24 11 L24 15" opacity="0.55"/>
        <path d="M26 28 L29 26 M27 24 L29 29" opacity="0.55"/>
      </svg>
    );

    case 'pain-cluttered': return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* Drawer frame */}
        <rect x="4" y="22" width="40" height="20" rx="2"/>
        {/* drawer handle */}
        <path d="M21 41 H27"/>
        {/* items poking out of the top — uneven heights, overstuffed */}
        <path d="M9 22 V14 M9 14 c0 -1.5 -2 -1.5 -2 0 V22" fill="currentColor" opacity="0.16" stroke="currentColor"/>
        <path d="M16 22 V10 M16 10 c0 -2 -3 -2 -3 0 V22" fill="currentColor" opacity="0.16" stroke="currentColor"/>
        <path d="M24 22 V8" />
        <path d="M22 11 L24 8 L26 11"/>
        <path d="M32 22 V12 M32 12 c0 -2 -3 -2 -3 0 V22" fill="currentColor" opacity="0.16" stroke="currentColor"/>
        <path d="M40 22 V16 M40 16 c0 -1.5 -2 -1.5 -2 0 V22" fill="currentColor" opacity="0.16" stroke="currentColor"/>
        {/* messy lines inside drawer */}
        <path d="M8 32 L14 30 L20 34 L26 30 L32 34 L40 31" opacity="0.55"/>
      </svg>
    );

    default: return null;
  }
};

window.Icon = Icon;
