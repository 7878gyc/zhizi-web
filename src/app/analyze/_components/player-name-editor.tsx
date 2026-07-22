'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

interface PlayerNameEditorProps {
  playerBlack: string;
  playerWhite: string;
  onSetBlack: (name: string) => void;
  onSetWhite: (name: string) => void;
}

export default function PlayerNameEditor({
  playerBlack,
  playerWhite,
  onSetBlack,
  onSetWhite,
}: PlayerNameEditorProps) {
  const [editing, setEditing] = useState<'black' | 'white' | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!playerBlack && !playerWhite) return null;

  const commit = () => {
    const val = editValue.trim();
    if (editing === 'black') onSetBlack(val);
    else onSetWhite(val);
    setEditing(null);
  };

  return (
    <>
      <span className="text-xs text-[#4A4A6A]">|</span>
      <span className="text-xs text-[#8B8FA3]">
        {editing === 'black' ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') setEditing(null);
            }}
            className="w-24 px-1 py-0.5 text-xs bg-[#1A1A2E] border border-[#E8B931]/50 rounded text-[#E0E0E0] focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setEditing('black');
              setEditValue(playerBlack);
            }}
            className="text-[#4A9EFF] hover:text-[#6AB4FF] transition-colors inline-flex items-center gap-0.5"
            title="编辑黑方姓名"
          >
            {playerBlack}
            <Pencil className="w-2.5 h-2.5 text-[#4A4A6A]" />
          </button>
        )}
        <span className="text-[#8B8FA3]"> (黑)</span>
        <span className="text-[#4A4A6A] mx-1">vs</span>
        {editing === 'white' ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') setEditing(null);
            }}
            className="w-24 px-1 py-0.5 text-xs bg-[#1A1A2E] border border-[#E8B931]/50 rounded text-[#E0E0E0] focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setEditing('white');
              setEditValue(playerWhite);
            }}
            className="text-[#E0E0E0] hover:text-white transition-colors inline-flex items-center gap-0.5"
            title="编辑白方姓名"
          >
            {playerWhite}
            <Pencil className="w-2.5 h-2.5 text-[#4A4A6A]" />
          </button>
        )}
        <span className="text-[#8B8FA3]"> (白)</span>
      </span>
    </>
  );
}
