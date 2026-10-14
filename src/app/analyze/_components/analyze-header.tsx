'use client';

import PlayerNameEditor from './player-name-editor';
import { UserMenu } from './user-menu';

interface AnalyzeHeaderProps {
  boardSize: number;
  currentPlayer: 'black' | 'white';
  isConnected: boolean;
  isConnecting: boolean;
  analysisMode: 'local' | 'remote';
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
  isConnecting,
  analysisMode,
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
  return (
    <header className="h-12 bg-[#16213E]/80 border-b border-[#2A3A5C]/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-bold text-[#E8B931] tracking-wide shrink-0">智子围棋 AI</h1>
        <span className="text-xs text-[#4A4A6A]">|</span>
        <span className="text-xs text-[#8B8FA3] shrink-0">
          {boardSize}路 · {currentPlayer === 'black' ? '黑' : '白'}方落子
        </span>

        {/* 连接状态 */}
        <span
          className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${
            isConnected
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : isConnecting
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
          }`}
        >
          {isConnected ? 'AI 已连接' : isConnecting ? '连接中...' : 'AI 未连接'}
        </span>

        {/* 模式徽标 */}
        <span
          className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${
            analysisMode === 'remote'
              ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
              : 'bg-[#E8B931]/15 text-[#E8B931] border-[#E8B931]/30'
          }`}
        >
          {analysisMode === 'remote' ? '远程算力' : '本地分析'}
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
      </div>
    </header>
  );
}
