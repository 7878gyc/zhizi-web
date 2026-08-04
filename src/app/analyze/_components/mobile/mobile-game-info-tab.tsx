'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KomiInput } from '../komi-input';
import type { } from '@/lib/go-types';

interface GameInfoTabProps {
  blackName: string;
  whiteName: string;
  komi: number;
  rules: string;
  boardSize: number;
  currentPlayer: 'black' | 'white';
  currentMoveNumber: number;
  onBlackNameChange: (name: string) => void;
  onWhiteNameChange: (name: string) => void;
  onKomiChange: (komi: number) => void;
  onRulesChange: (rules: string) => void;
}

const RULES: string[] = ['chinese', 'japanese', 'korean', 'tt', 'nz', 'aga', 'bga'];

export function MobileGameInfoTab({
  blackName,
  whiteName,
  komi,
  rules,
  boardSize,
  currentPlayer,
  currentMoveNumber,
  onBlackNameChange,
  onWhiteNameChange,
  onKomiChange,
  onRulesChange,
}: GameInfoTabProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {/* Game info summary */}
      <div className="grid grid-cols-2 gap-3 text-xs text-[#8B8FA3]">
        <div className="bg-[#1A1A2E]/60 rounded-lg p-2 text-center">
          <div className="text-[#4A4A6A] mb-0.5">棋盘</div>
          <div className="text-[#E0E0E0] font-medium">{boardSize}x{boardSize}</div>
        </div>
        <div className="bg-[#1A1A2E]/60 rounded-lg p-2 text-center">
          <div className="text-[#4A4A6A] mb-0.5">手数</div>
          <div className="text-[#E0E0E0] font-medium">{currentMoveNumber}</div>
        </div>
        <div className="bg-[#1A1A2E]/60 rounded-lg p-2 text-center">
          <div className="text-[#4A4A6A] mb-0.5">当前落子</div>
          <div className="flex items-center justify-center gap-1">
            <div className={currentPlayer === 'black' ? 'w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#666]' : 'w-2.5 h-2.5 rounded-full bg-white border border-[#999]'} />
            <span className="text-[#E0E0E0] font-medium">{currentPlayer === 'black' ? '黑' : '白'}</span>
          </div>
        </div>
        <div className="bg-[#1A1A2E]/60 rounded-lg p-2 text-center">
          <div className="text-[#4A4A6A] mb-0.5">贴目 / 规则</div>
          <div className="text-[#E0E0E0] font-medium">{komi} / {rules.toUpperCase()}</div>
        </div>
      </div>

      {/* Player names */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#8B8FA3]">黑棋棋手</Label>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-white border border-[#666] shrink-0" />
            <Input
              value={blackName}
              onChange={(e) => onBlackNameChange(e.target.value)}
              placeholder="输入黑棋棋手名"
              className="h-8 text-xs bg-[#1A1A2E] border-[#2A3A5C]/60 text-[#E0E0E0] placeholder:text-[#4A4A6A] focus-visible:ring-[#E8B931]/30"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#8B8FA3]">白棋棋手</Label>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#999] shrink-0" />
            <Input
              value={whiteName}
              onChange={(e) => onWhiteNameChange(e.target.value)}
              placeholder="输入白棋棋手名"
              className="h-8 text-xs bg-[#1A1A2E] border-[#2A3A5C]/60 text-[#E0E0E0] placeholder:text-[#4A4A6A] focus-visible:ring-[#E8B931]/30"
            />
          </div>
        </div>
      </div>

      {/* Komi & Rules */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#8B8FA3]">贴目</Label>
          <KomiInput komi={komi} onKomiChange={onKomiChange} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#8B8FA3]">规则</Label>
          <Select value={rules} onValueChange={(v) => onRulesChange(v)}>
            <SelectTrigger className="h-8 text-xs bg-[#1A1A2E] border-[#2A3A5C]/60 text-[#E0E0E0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A2E] border-[#2A3A5C]/60">
              {RULES.map((r) => (
                <SelectItem key={r} value={r} className="text-xs text-[#E0E0E0]">
                  {r.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
