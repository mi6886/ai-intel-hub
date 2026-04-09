'use client';

import { useRef, useEffect } from 'react';

interface DateCard {
  date: string; // YYYY-MM-DD
  count: number;
}

interface Props {
  dates: DateCard[];
  activeDate: string;
  onSelect: (date: string) => void;
  label?: string;
}

function formatDateCard(dateStr: string): { weekday: string; month: string; day: string; isToday: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return {
    weekday: isToday ? '今天' : weekdays[date.getDay()],
    month: months[date.getMonth()],
    day: String(date.getDate()),
    isToday,
  };
}

export default function DateScroller({ dates, activeDate, onSelect, label }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeDate]);

  if (dates.length === 0) return null;

  return (
    <div>
      {label && <div className="text-xs text-gray-400 mb-2 font-medium">{label}</div>}
      <div className="relative">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {dates.map((d) => {
            const fmt = formatDateCard(d.date);
            const isActive = activeDate === d.date;
            return (
              <button
                key={d.date}
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(d.date)}
                className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[72px]
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                  }
                  ${fmt.isToday && !isActive ? 'ring-2 ring-blue-200' : ''}
                `}
              >
                <span className={`text-[10px] font-medium ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                  {fmt.weekday}
                </span>
                <span className={`text-lg font-bold leading-tight ${isActive ? 'text-white' : 'text-gray-800'}`}>
                  {fmt.day}
                </span>
                <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                  {fmt.month}
                </span>
                {d.count > 0 && (
                  <span className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${isActive ? 'bg-blue-500 text-blue-100' : 'bg-blue-50 text-blue-600'}`}>
                    {d.count}条
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
