'use client';

import { useRef } from 'react';
import Link from 'next/link';
import PlayerNameEditor from './player-name-editor';
import { UserMenu } from './user-menu';

interface AnalyzeHeaderProps {
  boardSize: number;
  currentPlayer: 'black' | 'white';
  isConnected: boolean;
  playerBlack: string;
  playerWhite: string;
  userDisplayName: string;
  onSetBlack: (name: string) => void;
  onSetWhite: (name: string) => void;
  onImportSgf: () => void;
  onFoxwqImport: () => void;
  onCloudImport: () => void;
  onLogout: () => void;
}

export default function AnalyzeHeader({
  boardSize,
  currentPlayer,
  isConnected,
  playerBlack,
  playerWhite,
  userDisplayName,
  onSetBlack,
  onSetWhite,
  onImportSgf,
  onFoxwqImport,
  onCloudImport,
  onLogout,
}: AnalyzeHeaderProps) {
  const sgfInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-12 bg-[#16213E]/80 border-b border-[#2A3A5C]/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-[#E8B931] tracking-wide">智子围棋 AI</h1>
        <span className="text-xs text-[#4A4A6A]">|</span>
        <span className="text-xs text-[#8B8FA3]">
          {boardSize}路 · {currentPlayer === 'black' ? '黑' : '白'}方落子
          {isConnected && ' · AI已连接'}
        </span>
        {(playerBlack || playerWhite) && (
          <PlayerNameEditor
            playerBlack={playerBlack}
            playerWhite={playerWhite}
            onSetBlack={onSetBlack}
            onSetWhite={onSetWhite}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {userDisplayName && <UserMenu userDisplayName={userDisplayName} onLogout={onLogout} />}
        <button
          onClick={onImportSgf}
          className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#C0C0C0] rounded transition-colors"
        >
          导入SGF
        </button>
        <input
          ref={sgfInputRef}
          type="file"
          accept=".sgf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Delegate to parent handler via custom path
            onImportSgf();
            // Reset so re-trigger works
            if (sgfInputRef.current) sgfInputRef.current.value = '';
          }}
        />
        <button
          onClick={onFoxwqImport}
          className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#C0C0C0] rounded transition-colors"
        >
          野狐导入
        </button>
        <button
          onClick={onCloudImport}
          className="px-2.5 py-1 text-xs bg-[#E8B931]/15 hover:bg-[#E8B931]/25 text-[#E8B931] rounded transition-colors"
        >
          云棋谱导入
        </button>
        <Link
          href="/about"
          className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#C0C0C0] rounded transition-colors"
        >
          关于
        </Link>
      </div>
    </header>
  );
}
