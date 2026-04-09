'use client';

import { ALL_PLATFORMS } from '@/data/mockData';

interface Props {
  platforms: string[];
  activePlatform: string; // 'all' or platform id
  onSelect: (platform: string) => void;
  contentCounts: Record<string, number>;
}

export default function PlatformFilter({ platforms, activePlatform, onSelect, contentCounts }: Props) {
  const availablePlatforms = ALL_PLATFORMS.filter((p) => platforms.includes(p.id));
  const totalCount = Object.values(contentCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect('all')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
          ${activePlatform === 'all'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
      >
        全部
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activePlatform === 'all' ? 'bg-blue-500 text-blue-100' : 'bg-gray-200 text-gray-500'}`}>
          {totalCount}
        </span>
      </button>
      {availablePlatforms.map((p) => {
        const count = contentCounts[p.id] || 0;
        const isActive = activePlatform === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${isActive
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            style={isActive ? { backgroundColor: p.color } : {}}
          >
            <span>{p.icon}</span>
            {p.name}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
