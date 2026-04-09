'use client';

import { useState } from 'react';
import { MonitorCategory } from '@/data/mockData';

interface Props {
  categories: MonitorCategory[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
}

export default function CategoryTabs({ categories, activeId, onSelect, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-4 pt-3 overflow-x-auto">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative
            ${activeId === cat.id
              ? 'bg-gray-50 text-blue-600 border border-gray-200 border-b-white -mb-px z-10'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          {cat.name}
        </button>
      ))}

      {adding ? (
        <div className="flex items-center gap-2 px-2 shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewName(''); }
            }}
            placeholder="输入分类名称..."
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
          />
          <button onClick={handleAdd} className="text-sm text-blue-600 hover:text-blue-700 font-medium">确定</button>
          <button onClick={() => { setAdding(false); setNewName(''); }} className="text-sm text-gray-400 hover:text-gray-600">取消</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md ml-1 transition-colors"
          title="新建分类"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}
