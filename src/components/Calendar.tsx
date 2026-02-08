import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getEntriesForMonth } from '../lib/database';

interface CalendarProps {
  currentUserId: string;
  viewingUserId: string;
  onDateSelect: (date: string) => void;
  selectedDate: string | null;
  refreshTick?: number;
  isViewingPartner: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayString(): string {
  const d = new Date();
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Calendar({
  viewingUserId,
  onDateSelect,
  selectedDate,
  refreshTick,
  isViewingPartner,
}: CalendarProps) {
  const today = getTodayString();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingEntries(true);
    getEntriesForMonth(viewingUserId, year, month)
      .then((dates) => {
        if (!cancelled) setEntryDates(dates);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoadingEntries(false);
      });
    return () => { cancelled = true; };
  }, [viewingUserId, year, month, refreshTick]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const goToPreviousMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const dotColor = isViewingPartner ? 'bg-secondary' : 'bg-primary';

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="card p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPreviousMonth}
          className="btn-ghost p-2 rounded-lg"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-serif font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
          {isLoadingEntries && (
            <span className="ml-2 inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin align-middle" />
          )}
        </h2>
        <button
          onClick={goToNextMonth}
          className="btn-ghost p-2 rounded-lg"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateStr = formatDate(year, month, day);
          const hasEntry = entryDates.has(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center
                text-sm font-medium transition-all duration-200 relative
                ${isSelected
                  ? isViewingPartner
                    ? 'bg-secondary text-secondary-foreground shadow-md scale-105'
                    : 'bg-primary text-primary-foreground shadow-md scale-105'
                  : isToday
                    ? 'bg-surface font-semibold ring-2 ring-primary/30'
                    : 'hover:bg-surface-hover text-foreground'
                }
              `}
              aria-label={`${MONTH_NAMES[month]} ${day}, ${year}${hasEntry ? ' - has journal entry' : ''}`}
            >
              <span>{day}</span>
              {hasEntry && !isSelected && (
                <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`} />
              )}
              {hasEntry && isSelected && (
                <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
