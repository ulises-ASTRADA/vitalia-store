export default function Icon({name}) {
  const paths={bag:<><path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,moon:<path d="M20.6 13.5A9 9 0 0 1 10.5 3.4a9 9 0 1 0 10.1 10.1Z"/>};
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
