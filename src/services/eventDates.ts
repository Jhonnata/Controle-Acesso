export type EventDate = string;

export interface WeekDateItem {
  eventDate: EventDate;
  fullWeekday: string;
  shortWeekday: string;
  dayNumber: string;
  isToday: boolean;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const FULL_WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export const getLocalDayMonth = (now = new Date()): string => {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

export const normalizeEventDateInput = (value: string): string => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const isValidEventDate = (value?: string | null): value is EventDate => {
  if (!value) return false;
  const match = String(value).trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1) return false;
  const maxDay = new Date(2026, month, 0).getDate();
  return day <= maxDay;
};

export const ensureEventDate = (
  value?: string | null,
  fallback = getLocalDayMonth()
): EventDate => (isValidEventDate(value) ? value : fallback);

const toComparableNumber = (eventDate: string): number => {
  if (!isValidEventDate(eventDate)) return Number.POSITIVE_INFINITY;
  const [day, month] = eventDate.split('/').map(Number);
  return month * 100 + day;
};

export const compareEventDates = (left: string, right: string): number =>
  toComparableNumber(left) - toComparableNumber(right);

export const sortEventDates = (dates: string[]): EventDate[] =>
  Array.from(new Set(dates.filter(isValidEventDate))).sort(compareEventDates);

export const getDefaultEventDate = (now = new Date()): EventDate => getLocalDayMonth(now);

export const resolvePreferredEventDate = (
  availableDates: string[],
  now = new Date()
): EventDate => {
  const today = getLocalDayMonth(now);
  const sorted = sortEventDates(availableDates);
  if (sorted.includes(today)) return today;
  if (sorted.length > 0) return sorted[sorted.length - 1];
  return today;
};

export const isTodayEventDate = (eventDate: EventDate, now = new Date()): boolean =>
  getLocalDayMonth(now) === eventDate;

export const getEventDateDetails = (eventDate: EventDate, now = new Date()) => {
  const safeDate = ensureEventDate(eventDate, getLocalDayMonth(now));
  const [dayStr, monthStr] = safeDate.split('/');
  const day = Number(dayStr);
  const month = Number(monthStr);
  const refDate = new Date(2026, month - 1, day);
  const weekdayIndex = refDate.getDay();

  return {
    title: `${FULL_WEEKDAYS[weekdayIndex]}, ${dayStr} ${MONTHS[month - 1]}`,
    fullWeekday: FULL_WEEKDAYS[weekdayIndex],
    shortWeekday: WEEKDAYS[weekdayIndex],
    accentTextClass: isTodayEventDate(safeDate, now) ? 'text-pink-400' : 'text-indigo-300',
    selectedDotClass: isTodayEventDate(safeDate, now) ? 'bg-emerald-400' : 'bg-indigo-400',
    idleDotClass: isTodayEventDate(safeDate, now) ? 'bg-emerald-500' : 'bg-indigo-500',
    selectedRingClass: isTodayEventDate(safeDate, now) ? 'ring-emerald-500/40' : 'ring-indigo-500/40',
    isToday: isTodayEventDate(safeDate, now),
  };
};

export const getCurrentWeekDates = (now = new Date()): WeekDateItem[] => {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = current.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const eventDate = getLocalDayMonth(date);
    const weekdayIndex = date.getDay();

    return {
      eventDate,
      fullWeekday: FULL_WEEKDAYS[weekdayIndex],
      shortWeekday: WEEKDAYS[weekdayIndex],
      dayNumber: String(date.getDate()).padStart(2, '0'),
      isToday: isTodayEventDate(eventDate, now),
    };
  });
};
