'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GoBoard from '@/components/go-board';
import AiConfigPanel from '@/components/ai-config-panel';
import AnalysisPanel from '@/components/analysis-panel';
import MoveTree from '@/components/move-tree';
import WinrateChart from '@/components/winrate-chart';
import { useGoGame } from '@/hooks/use-go-game';
import { useZhiziAnalysis } from '@/hooks/use-zhizi-analysis';
import { getToken, removeToken } from '@/lib/auth';
import type { AiConfig } from '@/lib/go-types';
import { readSgfFile } from '@/lib/sgf-parser';

export default function AnalyzePage() {
  const router = useRouter();
  const game = useGoGame(19);
  const [selectedConfig, setSelectedConfig] = useState<AiConfig | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const sgfInputRef = useRef<HTMLInputElement>(null);

  // Check auth
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  const {
    board,
    boardSize,
    komi,
    rules,
    currentPlayer,
    moveTree,
    currentNodeId,
    lastMove,
    gtpMoves,
    currentMoveNumber,
    winrateHistory,
    placeStone,
    goToPrevMove,
    goToNextMove,
    jumpToNode,
    deleteNode,
    deleteBranch,
    resetBoard,
    setBoardSize,
    setKomi,
    setRules,
    loadFromTree,
    setCurrentWinrate,
  } = game;

  const {
    analysisData,
    currentWinrate,
    isAnalyzing,
    isConnected,
    connect,
    disconnect,
    syncAndAnalyze,
  } = useZhiziAnalysis();

  // Sync and analyze whenever moves change and AI is ready
  const prevMoveCountRef = useRef(0);
  useEffect(() => {
    if (isConnected && gtpMoves.length !== prevMoveCountRef.current) {
      prevMoveCountRef.current = gtpMoves.length;
      syncAndAnalyze({
        boardSize,
        komi,
        rules,
        player: currentPlayer,
        moves: gtpMoves,
      });
    }
  }, [isConnected, gtpMoves, boardSize, komi, rules, currentPlayer, syncAndAnalyze]);

  // Auto-connect when config selected
  useEffect(() => {
    if (selectedConfig && getToken()) {
      connect(selectedConfig);
    }
    return () => {
      disconnect();
    };
  }, [selectedConfig]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      placeStone(row, col);
    },
    [placeStone]
  );

  const handleLogout = useCallback(() => {
    disconnect();
    removeToken();
    router.replace('/login');
  }, [disconnect, router]);

  const handleImportSgf = useCallback(async () => {
    sgfInputRef.current?.click();
  }, []);

  const handleSgfFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const result = await readSgfFile(file);
      if (!result) {
        alert('SGF 文件解析失败，请检查文件格式');
        return;
      }

      // Disconnect current analysis
      disconnect();

      // Update game settings from SGF
      if (result.boardSize !== boardSize) {
        setBoardSize(result.boardSize);
      }
      setKomi(result.komi);
      setRules(result.rules);

      // Load the move tree
      loadFromTree(result.tree);
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree]
  );

  const canGoPrev = currentNodeId !== 'root';
  const currentNode = (() => {
    // Simple find - walk the tree
    const findInTree = (node: typeof moveTree): typeof moveTree | null => {
      if (node.id === currentNodeId) return node;
      for (const child of node.children) {
        const found = findInTree(child);
        if (found) return found;
      }
      return null;
    };
    return findInTree(moveTree);
  })();
  const canGoNext = currentNode !== null && currentNode.children.length > 0;

  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E0E0E0]">
      {/* Top bar */}
      <header className="h-12 bg-[#16213E]/80 border-b border-[#2A3A5C]/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-[#E8B931] tracking-wide">智子围棋 AI</h1>
          <span className="text-xs text-[#4A4A6A]">|</span>
          <span className="text-xs text-[#8B8FA3]">
            {boardSize}路 · {currentPlayer === 'black' ? '黑' : '白'}方落子
            {isConnected && ' · AI已连接'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportSgf}
            className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#C0C0C0] rounded transition-colors"
          >
            导入SGF
          </button>
          <input
            ref={sgfInputRef}
            type="file"
            accept=".sgf"
            className="hidden"
            onChange={handleSgfFileChange}
          />
          <button
            onClick={handleLogout}
            className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#FF6B6B]/20 text-[#8B8FA3] hover:text-[#FF6B6B] rounded transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex h-[calc(100vh-48px)]">
        {/* Left: Board area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-w-0">
          <GoBoard
            boardSize={boardSize}
            board={board}
            currentPlayer={currentPlayer}
            analysisData={analysisData}
            onCellClick={handleCellClick}
            lastMove={lastMove}
            hoverCoord={hoverCoord}
            onHoverChange={setHoverCoord}
          />

          {/* Board controls */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={goToPrevMove}
              disabled={!canGoPrev}
              className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
            >
              ← 上一步
            </button>
            <button
              onClick={goToNextMove}
              disabled={!canGoNext}
              className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
            >
              下一步 →
            </button>
            <span className="text-[#4A4A6A] text-xs mx-1">|</span>
            {/* Board size */}
            {[9, 13, 19].map((size) => (
              <button
                key={size}
                onClick={() => {
                  if (size !== boardSize) {
                    disconnect();
                    setBoardSize(size);
                  }
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  boardSize === size
                    ? 'bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30'
                    : 'bg-[#16213E] text-[#8B8FA3] hover:bg-[#2A3A5C]'
                }`}
              >
                {size}路
              </button>
            ))}
            <span className="text-[#4A4A6A] text-xs mx-1">|</span>
            <button
              onClick={() => {
                disconnect();
                resetBoard();
              }}
              className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#FF6B6B]/20 text-[#8B8FA3] hover:text-[#FF6B6B] rounded transition-colors"
            >
              清空
            </button>
          </div>

          {/* Rules & Komi */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#4A4A6A]">规则</span>
              {(['chinese', 'japanese', 'aga'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRules(r)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    rules === r
                      ? 'bg-[#E8B931]/15 text-[#E8B931]'
                      : 'text-[#4A4A6A] hover:text-[#8B8FA3]'
                  }`}
                >
                  {r === 'chinese' ? '中国' : r === 'japanese' ? '日本' : 'AGA'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#4A4A6A]">贴目</span>
              {[5.5, 6.5, 7.5].map((k) => (
                <button
                  key={k}
                  onClick={() => setKomi(k)}
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
          </div>
        </div>

        {/* Right: Analysis panel */}
        <div className="w-[340px] bg-[#16213E]/40 border-l border-[#2A3A5C]/30 flex flex-col overflow-y-auto p-3 gap-4 scrollbar-thin">
          {/* AI Config */}
          <AiConfigPanel
            selectedConfig={selectedConfig}
            onSelectConfig={setSelectedConfig}
            isConnected={isConnected}
          />

          {/* Move tree */}
          <MoveTree
            tree={moveTree}
            currentNodeId={currentNodeId}
            onJumpToNode={jumpToNode}
            onDeleteNode={deleteNode}
            onDeleteBranch={deleteBranch}
          />

          {/* Winrate chart */}
          <WinrateChart
            winrateHistory={winrateHistory}
            currentMoveNumber={currentMoveNumber}
          />

          {/* Analysis panel (winrate bar + suggestion table) */}
          <AnalysisPanel
            analysisData={analysisData}
            currentWinrate={currentWinrate}
            currentPlayer={currentPlayer}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </div>
    </div>
  );
}
