'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface KomiInputProps {
  komi: number;
  onKomiChange: (komi: number) => void;
}

const DEFAULT_KOMI = 7.5;
const KOMI_MIN = -150;
const KOMI_MAX = 150;
const PRESETS = [5.5, 6.5, 7.5];

export function KomiInput({ komi, onKomiChange }: KomiInputProps) {
  const [text, setText] = useState(String(komi));
  const [error, setError] = useState<string | null>(null);

  // Sync external changes (SGF import, reset, etc.)
  useEffect(() => {
    setText(String(komi));
    setError(null);
  }, [komi]);

  const applyValue = (value: number) => {
    if (!Number.isFinite(value) || value < KOMI_MIN || value > KOMI_MAX) {
      setError(`贴目需在 ${KOMI_MIN} ~ ${KOMI_MAX} 之间，已重置为默认值 ${DEFAULT_KOMI}`);
      setText(String(DEFAULT_KOMI));
      onKomiChange(DEFAULT_KOMI);
      return;
    }
    setText(String(value));
    setError(null);
    onKomiChange(value);
  };

  const handleBlur = () => {
    const parsed = parseFloat(text);
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setError('请输入有效的贴目数值，已重置为默认值');
      setText(String(DEFAULT_KOMI));
      onKomiChange(DEFAULT_KOMI);
      return;
    }
    applyValue(parsed);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={0.5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-16 text-xs bg-[#1A1A2E] border-[#2A3A5C]/60 text-[#E0E0E0] focus-visible:ring-[#E8B931]/30 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {PRESETS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => applyValue(k)}
            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              komi === k
                ? 'bg-[#E8B931]/15 text-[#E8B931]'
                : 'text-[#4A4A6A] hover:text-[#8B8FA3]'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {error && <div className="mt-1 text-[10px] text-[#FF6B6B]">{error}</div>}
    </div>
  );
}
