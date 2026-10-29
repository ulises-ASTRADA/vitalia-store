// Reglas del popup de bienvenida (spec del popup, §1). Funciones puras para poder testearlas.
export const POPUP_DISMISSED_KEY='vt_popup_dismissed_at';
export const POPUP_SUBSCRIBED_KEY='vt_popup_subscribed';
export const POPUP_SESSION_KEY='vt_popup_shown';
export const POPUP_DISMISS_DAYS=30;
export const POPUP_DELAY_MS=27000;
export const POPUP_SCROLL_RATIO=0.5;
const DAY=86400000;

// Nunca en el carrito ni en el checkout.
export const isBlockedPath=path=>/^\/checkout(\/|$)/.test(path||'');
// En fichas de producto y /envios no se abre al entrar ni por intención de salida: solo por tiempo o scroll real.
export const isQuietPath=path=>/^\/productos\//.test(path||'')||/^\/envios(\/|$)/.test(path||'');

export function isSubscribed({subscribed,search=''}) {
  if(subscribed==='1')return true;
  try{return new URLSearchParams(search).get('utm_medium')==='email';}catch{return false;}
}

export function canShowPopup({path,now,dismissedAt,subscribed,search,shownThisSession,otherDialogOpen}) {
  if(isBlockedPath(path)||shownThisSession||otherDialogOpen)return false;
  if(isSubscribed({subscribed,search}))return false;
  const dismissed=Number(dismissedAt);
  if(Number.isFinite(dismissed)&&dismissed>0&&now-dismissed<POPUP_DISMISS_DAYS*DAY)return false;
  return true;
}

// trigger: 'time' | 'scroll' | 'exit'. La intención de salida es solo de escritorio.
export function triggerAllowed({trigger,path,desktop,elapsedMs=0,scrollRatio=0}) {
  if(isBlockedPath(path))return false;
  if(trigger==='time')return elapsedMs>=POPUP_DELAY_MS;
  if(trigger==='scroll')return scrollRatio>=POPUP_SCROLL_RATIO;
  if(trigger==='exit')return Boolean(desktop)&&!isQuietPath(path);
  return false;
}
