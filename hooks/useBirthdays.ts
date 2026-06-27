import { ClientWithPackage } from './useClients';

export type BirthdayClient = ClientWithPackage & { daysUntil: number };

export function getDaysUntilBirthday(mmdd: string): number {
  const now = new Date();
  const [m, d] = mmdd.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYear = new Date(now.getFullYear(), m - 1, d);
  let diff = Math.round((thisYear.getTime() - today.getTime()) / 86400000);
  if (diff < 0) {
    const nextYear = new Date(now.getFullYear() + 1, m - 1, d);
    diff = Math.round((nextYear.getTime() - today.getTime()) / 86400000);
  }
  return diff;
}

export function formatBirthday(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function useBirthdays(clients: ClientWithPackage[]) {
  const all: BirthdayClient[] = clients
    .filter((c) => !!c.birthday)
    .map((c) => ({ ...c, daysUntil: getDaysUntilBirthday(c.birthday!) }))
    .filter((c) => c.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    all,
    today: all.filter((c) => c.daysUntil === 0),
    upcoming: all.filter((c) => c.daysUntil > 0),
  };
}
