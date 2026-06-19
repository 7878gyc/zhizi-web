'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GoBoard from '@/components/go-board';
import AiConfigPanel from '@/components/ai-config-panel';
import AnalysisPanel from '@/components/analysis-panel';
import MoveHistory from '@/components/move-history';
import { useGoGame } from '@/hooks/use-go-game';
import { useZhiziAnalysis } from '@/hooks/use-zhizi-analysis';
import { AI_CONFIGS } from '@/lib/go-types';
import type { AiConfig } from '@/lib/go-types';
import { getToken, removeToken, isLoggedIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function AnalyzePage() {
  const router = useRouter();
  const [selectedConfig, setSelectedConfig] = useState<AiConfig>(AI_CONFIGS[0]);
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const [boardSizeOption, setBoardSizeOption] = useState<string>('19');

  const game = useGoGame(19);
  const analysis = useZhiziAnalysis();

  // Auth check
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [router]);

  const handleConnect = useCallback(async () => {
    if (analysis.aiReady) {
      analysis.disconnect();
    } else {
      await analysis.connect(selectedConfig);
    }
  }, [analysis, selectedConfig]);

  const handleAnalyze = useCallback(() => {
    if (!analysis.aiReady) return;
    analysis.syncAndAnalyze({
      boardSize: game.boardSize,
      komi: game.komi,
      rules: game.rules,
      player: game.currentPlayer,
      moves: game.gtpMoves,
      analyzeVisits: 100,
    });
  }, [analysis, game]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const placed = game.placeStone(row, col);
      if (placed && analysis.aiReady) {
        // Auto analyze after placing a stone
        setTimeout(() => {
          analysis.syncAndAnalyze({
            boardSize: game.boardSize,
            komi: game.komi,
            rules: game.rules,
            player: game.currentPlayer,
            moves: [...game.gtpMoves, `${game.currentPlayer === 'black' ? 'B' : 'W'}`],
            analyzeVisits: 100,
          });
        }, 100);
      }
    },
    [game, analysis]
  );

  const handleUndo = useCallback(() => {
    game.undoMove();
    if (analysis.aiReady) {
      setTimeout(() => {
        analysis.syncAndAnalyze({
          boardSize: game.boardSize,
          komi: game.komi,
          rules: game.rules,
          player: game.currentPlayer,
          moves: game.gtpMoves.slice(0, -1),
          analyzeVisits: 100,
        });
      }, 100);
    }
  }, [game, analysis]);

  const handleReset = useCallback(() => {
    game.resetBoard();
    analysis.disconnect();
  }, [game, analysis]);

  const handleBoardSizeChange = useCallback(
    (val: string) => {
      setBoardSizeOption(val);
      const size = parseInt(val, 10);
      game.setBoardSize(size);
      analysis.disconnect();
    },
    [game, analysis]
  );

  const handleLogout = useCallback(() => {
    removeToken();
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#1A1A2E] flex flex-col">
      {/* Top bar */}
      <header className="h-12 bg-[#16213E]/80 border-b border-[#2A3A5C] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#1A1A1A] shadow-sm relative">
              <div className="w-1.5 h-1.5 rounded-full bg-white/70 absolute top-1 left-1.5" />
            </div>
            <span className="text-[#E8B931] font-bold text-sm tracking-wide">智子围棋 AI</span>
          </div>
          <Separator orientation="vertical" className="h-5 bg-[#2A3A5C]" />
          <Select value={boardSizeOption} onValueChange={handleBoardSizeChange}>
            <SelectTrigger className="w-20 h-7 bg-[#1A1A2E] border-[#2A3A5C] text-[#8B8FA3] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
              <SelectItem value="9" className="text-white text-xs">9路</SelectItem>
              <SelectItem value="13" className="text-white text-xs">13路</SelectItem>
              <SelectItem value="19" className="text-white text-xs">19路</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-[#8B8FA3] hover:text-white hover:bg-[#2A3A5C] text-xs h-7"
          >
            退出登录
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Go board area */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-6">
          <div className="flex flex-col items-center gap-3">
            <GoBoard
              boardSize={game.boardSize}
              board={game.board}
              currentPlayer={game.currentPlayer}
              analysisData={analysis.analysisData}
              onCellClick={handleCellClick}
              lastMove={game.lastMove}
              hoverCoord={hoverCoord}
              onHoverChange={setHoverCoord}
            />
            {/* Board controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#8B8FA3]">
                <div className={`w-3 h-3 rounded-full ${game.currentPlayer === 'black' ? 'bg-[#1A1A1A] ring-2 ring-[#E8B931]' : 'bg-[#F0F0F0] border border-gray-400 ring-2 ring-[#E8B931]'}`} />
                <span>{game.currentPlayer === 'black' ? '黑' : '白'}方落子</span>
              </div>
              <Separator orientation="vertical" className="h-4 bg-[#2A3A5C]" />
              <span className="text-xs text-[#4A4A6A]">第 {game.moveHistory.length + 1} 手</span>
              <Separator orientation="vertical" className="h-4 bg-[#2A3A5C]" />
              <span className="text-xs text-[#4A4A6A]">贴目 {game.komi}</span>
            </div>
          </div>
        </div>

        {/* Right: Analysis panel */}
        <div className="w-80 xl:w-96 bg-[#16213E]/60 border-l border-[#2A3A5C] flex flex-col overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* AI Config */}
            <AiConfigPanel
              selectedConfig={selectedConfig}
              onConfigChange={(config) => {
                setSelectedConfig(config);
                if (analysis.aiReady) {
                  analysis.disconnect();
                }
              }}
              aiReady={analysis.aiReady}
              isConnecting={analysis.isConnecting}
            />

            {/* Connect / Analyze buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                className={`flex-1 h-9 text-sm font-medium transition-all ${
                  analysis.aiReady
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-[#E8B931] text-[#1A1A2E] hover:bg-[#D4A52A]'
                }`}
                disabled={analysis.isConnecting}
              >
                {analysis.isConnecting
                  ? '连接中...'
                  : analysis.aiReady
                  ? '断开连接'
                  : '连接 AI'}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!analysis.aiReady || analysis.isAnalyzing}
                className="flex-1 h-9 text-sm font-medium bg-[#4A9EFF]/20 text-[#4A9EFF] hover:bg-[#4A9EFF]/30 border border-[#4A9EFF]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analysis.isAnalyzing ? '分析中...' : '开始分析'}
              </Button>
            </div>

            {/* Error display */}
            {analysis.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-red-400 text-xs">
                {analysis.error}
              </div>
            )}

            <Separator className="bg-[#2A3A5C]" />

            {/* Analysis results */}
            <AnalysisPanel
              analysisData={analysis.analysisData}
              currentWinrate={analysis.currentWinrate}
              currentPlayer={game.currentPlayer}
              isAnalyzing={analysis.isAnalyzing}
            />

            <Separator className="bg-[#2A3A5C]" />

            {/* Move history */}
            <MoveHistory
              moves={game.moveHistory}
              currentMoveIndex={game.moveHistory.length - 1}
              onJumpToMove={game.jumpToMove}
            />

            <Separator className="bg-[#2A3A5C]" />

            {/* Game controls */}
            <div className="flex gap-2">
              <Button
                onClick={handleUndo}
                variant="outline"
                size="sm"
                className="flex-1 bg-[#1A1A2E] border-[#2A3A5C] text-[#8B8FA3] hover:text-white hover:bg-[#2A3A5C] text-xs"
                disabled={game.moveHistory.length === 0}
              >
                悔棋
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="flex-1 bg-[#1A1A2E] border-[#2A3A5C] text-[#8B8FA3] hover:text-white hover:bg-[#2A3A5C] text-xs"
              >
                清空棋盘
              </Button>
            </div>

            {/* Rules & komi settings */}
            <div className="space-y-2">
              <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">规则设置</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[#4A4A6A] text-xs">贴目</label>
                  <Select value={String(game.komi)} onValueChange={(v) => game.setKomi(parseFloat(v))}>
                    <SelectTrigger className="h-7 bg-[#1A1A2E] border-[#2A3A5C] text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
                      <SelectItem value="5.5" className="text-white text-xs">5.5</SelectItem>
                      <SelectItem value="6.5" className="text-white text-xs">6.5</SelectItem>
                      <SelectItem value="7.5" className="text-white text-xs">7.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#4A4A6A] text-xs">规则</label>
                  <Select value={game.rules} onValueChange={game.setRules}>
                    <SelectTrigger className="h-7 bg-[#1A1A2E] border-[#2A3A5C] text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
                      <SelectItem value="chinese" className="text-white text-xs">中国规则</SelectItem>
                      <SelectItem value="japanese" className="text-white text-xs">日本规则</SelectItem>
                      <SelectItem value="aga" className="text-white text-xs">AGA 规则</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
