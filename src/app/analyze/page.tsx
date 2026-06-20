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
import { getToken, removeToken, saveUser, getUser } from '@/lib/auth';
import type { AiConfig, AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';
import { readSgfFile } from '@/lib/sgf-parser';

interface VariationMove {
  row: number;
  col: number;
  color: 'black' | 'white';
  moveNumber: number;
}

export default function AnalyzePage() {
  const router = useRouter();
  const game = useGoGame(19);
  const [selectedConfig, setSelectedConfig] = useState<AiConfig | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const sgfInputRef = useRef<HTMLInputElement>(null);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const autoAnalyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [variationMoves, setVariationMoves] = useState<VariationMove[] | null>(null);
  const [foxwqUrl, setFoxwqUrl] = useState('');
  const [showFoxwqDialog, setShowFoxwqDialog] = useState(false);
  const [foxwqLoading, setFoxwqLoading] = useState(false);
  const [foxwqError, setFoxwqError] = useState('');
  const [userInfo, setUserInfo] = useState<{ phone?: string; email?: string; username?: string } | null>(null);

  // Check auth
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    // Try to load cached user info
    const cached = getUser();
    if (cached) {
      setUserInfo(cached as { phone?: string; email?: string; username?: string });
    }
    // Fetch fresh user info
    fetchUserInfo();
  }, [router]);

  const fetchUserInfo = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const info = { phone: data.phone, email: data.email, username: data.username || data.nickname };
        setUserInfo(info);
        saveUser(info);
      }
    } catch {
      // Ignore fetch errors
    }
  }, []);

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
    isConnecting,
    error: analysisError,
    connect,
    disconnect,
    syncAndAnalyze,
  } = useZhiziAnalysis();

  // Sync winrate to game state when it changes
  useEffect(() => {
    if (currentWinrate !== null && currentWinrate >= 0 && currentWinrate <= 1) {
      setCurrentWinrate(currentWinrate);
    }
  }, [currentWinrate, setCurrentWinrate]);

  // Sync and analyze whenever moves change and AI is connected
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

  // Auto analyze: every 2 seconds go to next move
  useEffect(() => {
    if (isAutoAnalyzing && isConnected) {
      autoAnalyzeRef.current = setInterval(() => {
        const currentNode = (() => {
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

        if (currentNode && currentNode.children.length > 0) {
          goToNextMove();
        } else {
          // Reached leaf, stop auto-analyze
          setIsAutoAnalyzing(false);
        }
      }, 2000);
    } else {
      if (autoAnalyzeRef.current) {
        clearInterval(autoAnalyzeRef.current);
        autoAnalyzeRef.current = null;
      }
    }
    return () => {
      if (autoAnalyzeRef.current) {
        clearInterval(autoAnalyzeRef.current);
      }
    };
  }, [isAutoAnalyzing, isConnected, moveTree, currentNodeId, goToNextMove]);

  // Start analysis (manual)
  const handleStartAnalysis = useCallback(() => {
    if (selectedConfig && getToken()) {
      connect(selectedConfig);
    }
  }, [selectedConfig, connect]);

  // Stop analysis
  const handleStopAnalysis = useCallback(() => {
    setIsAutoAnalyzing(false);
    disconnect();
  }, [disconnect]);

  // Toggle auto analyze
  const handleToggleAutoAnalyze = useCallback(() => {
    setIsAutoAnalyzing(prev => !prev);
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      placeStone(row, col);
      // Clear variation when user plays
      setVariationMoves(null);
    },
    [placeStone]
  );

  const handleLogout = useCallback(() => {
    setIsAutoAnalyzing(false);
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

      disconnect();
      if (result.boardSize !== boardSize) {
        setBoardSize(result.boardSize);
      }
      setKomi(result.komi);
      setRules(result.rules);
      loadFromTree(result.tree);
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree]
  );

  // Foxwq import
  const handleFoxwqImport = useCallback(async () => {
    if (!foxwqUrl.trim()) {
      setFoxwqError('请输入野狐围棋棋谱链接');
      return;
    }
    setFoxwqLoading(true);
    setFoxwqError('');
    try {
      const resp = await fetch('/api/foxwq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: foxwqUrl.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setFoxwqError(data.error || '获取棋谱失败');
        return;
      }
      if (!data.sgf) {
        setFoxwqError('未获取到棋谱内容');
        return;
      }
      // Parse the SGF content
      const { parseSgfContent } = await import('@/lib/sgf-parser');
      const result = parseSgfContent(data.sgf);
      if (!result) {
        setFoxwqError('棋谱格式解析失败');
        return;
      }
      disconnect();
      if (result.boardSize !== boardSize) {
        setBoardSize(result.boardSize);
      }
      setKomi(result.komi);
      setRules(result.rules);
      loadFromTree(result.tree);
      setShowFoxwqDialog(false);
      setFoxwqUrl('');
    } catch (err: unknown) {
      setFoxwqError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setFoxwqLoading(false);
    }
  }, [foxwqUrl, disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree]);

  // Variation display: when user clicks a suggestion in the table
  const handleSelectMove = useCallback((info: AnalysisInfo) => {
    if (!info.pv || info.pv.length === 0) {
      setVariationMoves(null);
      return;
    }

    // Build variation moves from pv (max 10 steps)
    const moves: VariationMove[] = [];
    let color: 'black' | 'white' = currentPlayer;
    for (let i = 0; i < Math.min(info.pv.length, 10); i++) {
      try {
        const { row, col } = gtpToCoord(info.pv[i], boardSize);
        moves.push({ row, col, color, moveNumber: i + 1 });
        color = color === 'black' ? 'white' : 'black';
      } catch {
        break;
      }
    }
    setVariationMoves(moves.length > 0 ? moves : null);
  }, [currentPlayer, boardSize]);

  const canGoPrev = currentNodeId !== 'root';
  const currentNode = (() => {
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

  // Display name for user
  const userDisplayName = userInfo
    ? (userInfo.phone || userInfo.email || userInfo.username || '用户')
    : '';

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
          {userDisplayName && (
            <span className="text-xs text-[#8B8FA3]">{userDisplayName}</span>
          )}
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
            onClick={() => { setShowFoxwqDialog(true); setFoxwqError(''); }}
            className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#C0C0C0] rounded transition-colors"
          >
            野狐导入
          </button>
          <button
            onClick={handleLogout}
            className="px-2.5 py-1 text-xs bg-[#2A3A5C]/50 hover:bg-[#FF6B6B]/20 text-[#8B8FA3] hover:text-[#FF6B6B] rounded transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      {/* Foxwq import dialog */}
      {showFoxwqDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213E] rounded-lg p-5 w-[400px] border border-[#2A3A5C] shadow-xl">
            <h3 className="text-sm font-bold text-[#E8B931] mb-3">导入野狐围棋棋谱</h3>
            <p className="text-xs text-[#8B8FA3] mb-3">粘贴野狐围棋分享链接，如：https://www.foxwq.com/... 或 https://share.foxwq.com/...</p>
            <input
              type="text"
              value={foxwqUrl}
              onChange={(e) => setFoxwqUrl(e.target.value)}
              placeholder="粘贴棋谱链接..."
              className="w-full px-3 py-2 text-sm bg-[#1A1A2E] border border-[#2A3A5C] rounded text-white placeholder-[#4A4A6A] focus:outline-none focus:border-[#E8B931]/50"
            />
            {foxwqError && (
              <p className="text-xs text-[#FF6B6B] mt-2">{foxwqError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowFoxwqDialog(false); setFoxwqUrl(''); setFoxwqError(''); }}
                className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleFoxwqImport}
                disabled={foxwqLoading}
                className="flex-1 px-3 py-2 text-sm bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30 hover:bg-[#E8B931]/30 rounded transition-colors disabled:opacity-50"
              >
                {foxwqLoading ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            variationMoves={variationMoves}
          />

          {/* Board controls */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={goToPrevMove}
              disabled={!canGoPrev}
              className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
            >
              上一步
            </button>
            <button
              onClick={goToNextMove}
              disabled={!canGoNext}
              className="px-3 py-1.5 text-xs bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
            >
              下一步
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
                setVariationMoves(null);
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
            isConnecting={isConnecting}
            isAnalyzing={isAnalyzing}
            onStartAnalysis={handleStartAnalysis}
            onStopAnalysis={handleStopAnalysis}
            isAutoAnalyzing={isAutoAnalyzing}
            onToggleAutoAnalyze={handleToggleAutoAnalyze}
            error={analysisError}
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
            onSelectMove={handleSelectMove}
          />
        </div>
      </div>
    </div>
  );
}
