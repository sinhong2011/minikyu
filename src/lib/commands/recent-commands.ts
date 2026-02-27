const STORAGE_KEY = 'minikyu:recent-commands';
const MAX_RECENT = 5;

export function getRecentCommandIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function trackCommandUsage(commandId: string): void {
  try {
    const recent = getRecentCommandIds().filter((id) => id !== commandId);
    recent.unshift(commandId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be unavailable
  }
}
