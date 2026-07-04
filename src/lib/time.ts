export function timeAgo(unixSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

export function clockTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function eventDate(unixSeconds: number, withTime: boolean): string {
  const d = new Date(unixSeconds * 1000);
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (!withTime) return date;
  return `${date} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
