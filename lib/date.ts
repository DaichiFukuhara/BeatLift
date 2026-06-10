// 'YYYY-MM-DD' のローカル日付キーを扱うユーティリティ

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** key を含む週（日曜はじまり）の7日分の日付キー */
export function getWeekDates(key: string): string[] {
  const date = parseDateKey(key);
  const sunday = addDays(key, -date.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[parseDateKey(key).getDay()];
}

export function dayOfMonth(key: string): number {
  return parseDateKey(key).getDate();
}

/** 例: 2026年6月10日(火) */
export function formatHeaderDate(key: string): string {
  const date = parseDateKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAY_LABELS[date.getDay()]})`;
}

export function isToday(key: string): boolean {
  return key === todayKey();
}
