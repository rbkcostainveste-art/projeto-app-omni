const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dryingDay(at: Date = new Date()) {
  return dayFormatter.format(at);
}

export function dryingDayStart(day: string) {
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}

export function dryingVisibleToday(task: { status: string; completed_at: string | null }, day: string) {
  if (task.status === 'pending') return true;
  if (task.status !== 'completed' || !task.completed_at) return false;
  const completed = new Date(task.completed_at);
  return Number.isFinite(completed.getTime()) && dryingDay(completed) === day;
}
