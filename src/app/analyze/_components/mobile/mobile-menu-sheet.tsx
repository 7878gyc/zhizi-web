'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileGameInfoTab } from './mobile-game-info-tab';

type TabId = 'info' | 'move-tree' | 'winrate' | 'variation' | 'hawk-eye';

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  boardSize: number;
  currentPlayer: 'black' | 'white';
  currentMoveNumber: number;
  blackName: string;
  whiteName: string;
  komi: number;
  rules: string;
  onBlackNameChange: (name: string) => void;
  onWhiteNameChange: (name: string) => void;
  onKomiChange: (komi: number) => void;
  onRulesChange: (rules: string) => void;
  /* Live winrate (shown under winrate chart) */
  displayWinrate: number | null;
  /* Move tree */
  moveTreeSlot?: React.ReactNode;
  /* Winrate chart */
  winrateChartSlot?: React.ReactNode;
  /* Variation chart / selected analysis */
  variationSlot?: React.ReactNode;
  /* Hawk eye */
  hawkEyeSlot?: React.ReactNode;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'info', label: '棋局分析' },
  { id: 'move-tree', label: '落子树' },
  { id: 'winrate', label: '胜率图' },
  { id: 'variation', label: '变化图' },
  { id: 'hawk-eye', label: '鹰眼分析' },
];

export function MobileMenuSheet({
  open,
  onClose,
  boardSize,
  currentPlayer,
  currentMoveNumber,
  blackName,
  whiteName,
  komi,
  rules,
  onBlackNameChange,
  onWhiteNameChange,
  onKomiChange,
  onRulesChange,
  displayWinrate,
  moveTreeSlot,
  winrateChartSlot,
  variationSlot,
  hawkEyeSlot,
}: MobileMenuSheetProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // Live winrate from the current player's perspective -> black's perspective
  const blackWinrate = displayWinrate !== null
    ? currentPlayer === 'black' ? displayWinrate : 1 - displayWinrate
    : null;

  if (!open) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0F0F23]/95 backdrop-blur-sm border-t border-[#2A3A5C]/50 rounded-t-2xl">
      {/* Tab bar */}
      <div className="flex items-center shrink-0 border-b border-[#2A3A5C]/30">
        <div className="flex-1 flex overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'shrink-0 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-[#E8B931] border-[#E8B931]'
                  : 'text-[#8B8FA3] border-transparent hover:text-[#E0E0E0]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 mr-1 text-[#8B8FA3] hover:text-[#E0E0E0] hover:bg-[#1A1A2E] shrink-0"
          onClick={onClose}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'info' && (
          <MobileGameInfoTab
            blackName={blackName}
            whiteName={whiteName}
            komi={komi}
            rules={rules}
            boardSize={boardSize}
            currentPlayer={currentPlayer}
            currentMoveNumber={currentMoveNumber}
            onBlackNameChange={onBlackNameChange}
            onWhiteNameChange={onWhiteNameChange}
            onKomiChange={onKomiChange}
            onRulesChange={onRulesChange}
          />
        )}

        {activeTab === 'move-tree' && (
          <div className="flex-1 overflow-auto px-2 py-2">
            {moveTreeSlot}
          </div>
        )}

        {activeTab === 'winrate' && (
          <div className="flex-1 overflow-auto px-2 py-2 space-y-3">
            {winrateChartSlot}

            {/* Live winrate below the chart: black|white split bar, winrate inside */}
            <div className="h-4 rounded-full overflow-hidden flex bg-[#2A3A5C]/40">
              {blackWinrate === null ? (
                <div className="flex-1 flex items-center justify-center text-[9px] text-[#4A4A6A]">
                  连接 AI 后开始分析
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center justify-center bg-[#1A1A1A] text-[9px] font-semibold text-white overflow-hidden"
                    style={{ width: `${blackWinrate * 100}%` }}
                  >
                    {Math.round(blackWinrate * 100)}%
                  </div>
                  <div
                    className="flex items-center justify-center bg-[#E8E8E8] text-[9px] font-semibold text-[#1A1A2E] overflow-hidden"
                    style={{ width: `${(1 - blackWinrate) * 100}%` }}
                  >
                    {Math.round((1 - blackWinrate) * 100)}%
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'variation' && (
          <div className="flex-1 overflow-auto px-3 py-3">
            {variationSlot}
          </div>
        )}

        {activeTab === 'hawk-eye' && (
          <div className="flex-1 overflow-auto px-2 py-2">
            {hawkEyeSlot}
          </div>
        )}
      </div>
    </div>
  );
}

export type { TabId };
