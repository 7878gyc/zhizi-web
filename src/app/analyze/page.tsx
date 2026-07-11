'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SkipBack, ChevronLeft, Rewind, FastForward, ChevronRight, SkipForward, Download, Cloud } from 'lucide-react';
import GoBoard from '@/components/go-board';
import AiConfigPanel from '@/components/ai-config-panel';
import AnalysisPanel from '@/components/analysis-panel';
import MoveTree from '@/components/move-tree';
import WinrateChart from '@/components/winrate-chart';
import KataGoLogViewer from '@/components/katago-log-viewer';
import HawkEyePanel from '@/components/hawk-eye-panel';
import { useGoGame } from '@/hooks/use-go-game';
import { useZhiziAnalysis } from '@/hooks/use-zhizi-analysis';
import { getToken, removeToken, saveUser, getUser } from '@/lib/auth';
import type { AiConfig, AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';
import { readSgfFile, parseSgfContent } from '@/lib/sgf-parser';
import { generateAnalyzedSGF, generatePureSGF, downloadSgfFile } from '@/lib/sgf';

interface VariationMove {
  row: number;
  col: number;
  color: 'black' | 'white';
  moveNumber: number;
}

export default function AnalyzePage() {
  const router = useRouter();
  const game = useGoGame(19);
  const [selectedConfig, setSelectedConfig] = useState<AiConfig>({
    platform: 'all',
    engineType: 'go',
    gpuType: '1x',
    kataName: 'katago-TENSORRT',
    kataWeight: '28bnbt',
    label: '28b (标准) 1x GPU',
  });
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const sgfInputRef = useRef<HTMLInputElement>(null);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const autoAnalyzeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [variationMoves, setVariationMoves] = useState<VariationMove[] | null>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const selectedMoveRef = useRef(selectedMove);
  selectedMoveRef.current = selectedMove;
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
    logs,
    connect,
    disconnect,
    syncAndAnalyze,
  } = useZhiziAnalysis();

  // Analysis cache: persist variations per position so switching back shows them instantly
  const analysisCacheRef = useRef<Map<number, { data: AnalysisInfo[]; winrate: number | null }>>(new Map());
  const [displayAnalysis, setDisplayAnalysis] = useState<AnalysisInfo[]>([]);
  const [displayWinrate, setDisplayWinrate] = useState<number | null>(null);
  const analysisDataRef = useRef(analysisData);
  analysisDataRef.current = analysisData;
  const currentWinrateRef = useRef(currentWinrate);
  currentWinrateRef.current = currentWinrate;

  // Cache live analysis data whenever it arrives
  useEffect(() => {
    if (analysisData.length > 0) {
      const idx = gtpMoves.length;
      analysisCacheRef.current.set(idx, { data: analysisData, winrate: currentWinrate });
      setDisplayAnalysis(analysisData);
      setDisplayWinrate(currentWinrate);
    }
  }, [analysisData, currentWinrate, gtpMoves.length]);

  // Sync winrate to game state only when the value actually changes.
  const lastWinrateRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      currentWinrate !== null &&
      currentWinrate >= 0 &&
      currentWinrate <= 1 &&
      currentWinrate !== lastWinrateRef.current
    ) {
      lastWinrateRef.current = currentWinrate;
      setCurrentWinrate(currentWinrate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWinrate]);

  // Sync and analyze whenever moves change and AI is connected
  const prevMoveCountRef = useRef(-1);
  useEffect(() => {
    if (!isConnected) {
      prevMoveCountRef.current = -1;
      return;
    }
    if (gtpMoves.length === prevMoveCountRef.current) return;

    const oldIdx = prevMoveCountRef.current;

    // Save current live data to cache for the position we're leaving
    if (oldIdx >= 0 && analysisDataRef.current.length > 0) {
      analysisCacheRef.current.set(oldIdx, {
        data: analysisDataRef.current,
        winrate: currentWinrateRef.current,
      });
    }

    prevMoveCountRef.current = gtpMoves.length;

    // Load cached data for new position instantly
    const newIdx = gtpMoves.length;
    const cached = analysisCacheRef.current.get(newIdx);
    if (cached && cached.data.length > 0) {
      setDisplayAnalysis(cached.data);
      setDisplayWinrate(cached.winrate);
    }

    syncAndAnalyze({
      boardSize,
      komi,
      rules,
      player: currentPlayer,
      moves: gtpMoves,
    });
  }, [isConnected, gtpMoves, boardSize, komi, rules, currentPlayer, syncAndAnalyze]);

  // Load cached analysis data when viewing the tree offline (e.g., after SGF import)
  useEffect(() => {
    if (isConnected) return;
    const cached = analysisCacheRef.current.get(currentMoveNumber);
    if (cached && cached.data.length > 0) {
      setDisplayAnalysis(cached.data);
      setDisplayWinrate(cached.winrate);
    } else {
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
    }
  }, [currentMoveNumber, isConnected]);

  // Stable refs for callbacks used inside setInterval
  const goToNextMoveRef = useRef(goToNextMove);
  goToNextMoveRef.current = goToNextMove;

  // Auto analyze: every 2 seconds go to next move
  useEffect(() => {
    if (isAutoAnalyzing && isConnected) {
      autoAnalyzeRef.current = setInterval(() => {
        goToNextMoveRef.current();
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
  }, [isAutoAnalyzing, isConnected]);

  // Clear variation preview when navigating to a different position
  useEffect(() => {
    setSelectedMove(null);
    setVariationMoves(null);
  }, [currentNodeId]);

  // Start analysis (manual)
  const handleStartAnalysis = useCallback(() => {
    if (getToken()) {
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
      setSelectedMove(null);
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
      analysisCacheRef.current.clear();
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
      // Populate analysis cache from imported SGF
      result.analysisCache.forEach((value, key) => {
        analysisCacheRef.current.set(key, value);
      });
      loadFromTree(result.tree);
      // Reset input so same file can be re-imported
      if (sgfInputRef.current) sgfInputRef.current.value = '';
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
      analysisCacheRef.current.clear();
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
      result.analysisCache.forEach((value, key) => {
        analysisCacheRef.current.set(key, value);
      });
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
    // Toggle: if clicking the same selected move, cancel preview
    if (selectedMoveRef.current === info.move) {
      setSelectedMove(null);
      setVariationMoves(null);
      return;
    }

    if (!info.pv || info.pv.length === 0) {
      setSelectedMove(null);
      setVariationMoves(null);
      return;
    }

    setSelectedMove(info.move);

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

  // SGF save
  const [showSgfMenu, setShowSgfMenu] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [showCloudImport, setShowCloudImport] = useState(false);
  const [cloudRecords, setCloudRecords] = useState<{ id: string; fileName: string; fileSize: number; createdAt: string }[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudImporting, setCloudImporting] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState('');
  const sgfMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSgfMenu) return;
    const handler = (e: MouseEvent) => {
      if (sgfMenuRef.current && !sgfMenuRef.current.contains(e.target as Node)) {
        setShowSgfMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSgfMenu]);

  const handleSaveSgf = useCallback((includeAnalysis: boolean) => {
    setShowSgfMenu(false);
    try {
      const options = {
        boardSize,
        komi,
        rules,
        moveTree,
        analysisCache: includeAnalysis ? analysisCacheRef.current : undefined,
        includeAnalysis,
      };
      const content = includeAnalysis ? generateAnalyzedSGF(options) : generatePureSGF(options);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = includeAnalysis ? '_analyzed' : '';
      downloadSgfFile(content, `game_${timestamp}${suffix}.sgf`);
    } catch (err) {
      console.error('SGF save error:', err);
      alert('保存 SGF 失败');
    }
  }, [boardSize, komi, rules, moveTree]);

  const handleSaveToCloud = useCallback(async () => {
    setShowSgfMenu(false);
    setCloudSaving(true);
    try {
      const options = {
        boardSize,
        komi,
        rules,
        moveTree,
        analysisCache: analysisCacheRef.current,
        includeAnalysis: true,
      };
      const content = generateAnalyzedSGF(options);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `game_${timestamp}_analyzed.sgf`;

      const token = getToken();
      const resp = await fetch('/api/records/cloud-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, fileName }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '保存到云端失败');
      }

      alert('棋谱已保存到云棋谱库');
    } catch (err) {
      console.error('Cloud save error:', err);
      alert(err instanceof Error ? err.message : '保存到云端失败');
    } finally {
      setCloudSaving(false);
    }
  }, [boardSize, komi, rules, moveTree]);

  /** 打开云导入弹窗并加载棋谱列表 */
  const handleOpenCloudImport = useCallback(() => {
    setShowCloudImport(true);
    setCloudError('');
    setCloudLoading(true);
    const token = getToken();
    fetch('/api/records', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(resp => resp.json())
      .then(data => {
        if (data.error) {
          setCloudError(data.error);
        } else {
          setCloudRecords(data.records || []);
        }
      })
      .catch(() => setCloudError('网络错误'))
      .finally(() => setCloudLoading(false));
  }, []);

  /** 从云端选择棋谱并下载导入 */
  const handleSelectCloudRecord = useCallback(async (id: string) => {
    setCloudImporting(id);
    setCloudError('');
    const token = getToken();

    try {
      // 1. 获取下载 URL
      const dlResp = await fetch(`/api/records/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dlData = await dlResp.json();
      if (!dlResp.ok) {
        throw new Error(dlData.error || '获取下载链接失败');
      }

      // 2. 下载 SGF 内容
      const fileResp = await fetch(dlData.downloadUrl);
      if (!fileResp.ok) {
        throw new Error('下载棋谱文件失败');
      }
      const sgfText = await fileResp.text();

      // 3. 解析 SGF
      const parsed = parseSgfContent(sgfText);
      if (!parsed) {
        throw new Error('无法解析棋谱文件');
      }

      // 4. 设置棋盘大小、贴目、规则
      if (parsed.boardSize >= 1 && parsed.boardSize <= 19) {
        setBoardSize(parsed.boardSize);
      }
      setKomi(parsed.komi);
      if (parsed.rules) {
        setRules(parsed.rules);
      }

      // 5. 加载棋谱树
      loadFromTree(parsed.tree);

      // 6. 加载分析数据缓存
      if (parsed.analysisCache) {
        analysisCacheRef.current = parsed.analysisCache;
      }

      // 7. 跳转到最后一手
      let lastNode = parsed.tree;
      while (lastNode.children.length > 0) {
        lastNode = lastNode.children[0];
      }
      jumpToNode(lastNode.id);

      setShowCloudImport(false);
    } catch (err) {
      console.error('Cloud import error:', err);
      setCloudError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setCloudImporting(null);
    }
  }, [setBoardSize, setKomi, setRules, loadFromTree, jumpToNode]);

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

  // Stop auto-analyze when reaching a leaf node (no children)
  useEffect(() => {
    if (isAutoAnalyzing && !canGoNext) {
      setIsAutoAnalyzing(false);
    }
  }, [isAutoAnalyzing, canGoNext]);

  const goToFirstMove = useCallback(() => {
    const rootChildren = moveTree.children;
    if (rootChildren.length > 0) {
      jumpToNode(rootChildren[0].id);
    } else {
      jumpToNode('root');
    }
  }, [moveTree, jumpToNode]);

  const goToLastMove = useCallback(() => {
    let node = moveTree;
    while (node.children.length > 0) {
      node = node.children[0];
    }
    jumpToNode(node.id);
  }, [moveTree, jumpToNode]);

  const goBackward5 = useCallback(() => {
    let nodeId = currentNodeId;
    for (let i = 0; i < 5 && nodeId !== 'root'; i++) {
      const node = (function find(tree: typeof moveTree): typeof moveTree | null {
        if (tree.id === nodeId) return tree;
        for (const child of tree.children) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      })(moveTree);
      if (!node?.parentId) break;
      nodeId = node.parentId;
    }
    jumpToNode(nodeId);
  }, [moveTree, currentNodeId, jumpToNode]);

  const goForward5 = useCallback(() => {
    let nodeId = currentNodeId;
    for (let i = 0; i < 5; i++) {
      const node = (function find(tree: typeof moveTree): typeof moveTree | null {
        if (tree.id === nodeId) return tree;
        for (const child of tree.children) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      })(moveTree);
      if (!node || node.children.length === 0) break;
      nodeId = node.children[0].id;
    }
    jumpToNode(nodeId);
  }, [moveTree, currentNodeId, jumpToNode]);

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
            onClick={handleOpenCloudImport}
            className="px-2.5 py-1 text-xs bg-[#E8B931]/15 hover:bg-[#E8B931]/25 text-[#E8B931] rounded transition-colors"
          >
            云棋谱导入
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

      {/* Cloud import dialog */}
      {showCloudImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213E] rounded-lg p-5 w-[420px] border border-[#2A3A5C] shadow-xl">
            <h3 className="text-sm font-bold text-[#E8B931] mb-3">从云棋谱库导入</h3>

            {cloudError && (
              <p className="text-xs text-[#FF6B6B] mb-3">{cloudError}</p>
            )}

            {cloudLoading ? (
              <div className="py-10 text-center text-[#8B8FA3] text-sm">加载中...</div>
            ) : cloudRecords.length === 0 ? (
              <div className="py-10 text-center text-[#8B8FA3] text-sm">
                云端暂无棋谱，可先保存棋谱到云端
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto -mx-1">
                {cloudRecords.map(rec => (
                  <button
                    key={rec.id}
                    onClick={() => handleSelectCloudRecord(rec.id)}
                    disabled={cloudImporting !== null}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#2A3A5C]/50 rounded transition-colors disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E0E0E0] truncate">{rec.fileName}</p>
                      <p className="text-xs text-[#8B8FA3] mt-0.5">
                        {new Date(rec.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        &nbsp;&middot;&nbsp;
                        {rec.fileSize < 1024
                          ? `${rec.fileSize} B`
                          : rec.fileSize < 1024 * 1024
                            ? `${(rec.fileSize / 1024).toFixed(1)} KB`
                            : `${(rec.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                    </div>
                    <span className="text-xs text-[#E8B931] ml-3 shrink-0">
                      {cloudImporting === rec.id ? '导入中...' : '导入'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowCloudImport(false); setCloudError(''); }}
                className="flex-1 px-3 py-2 text-sm bg-[#2A3A5C]/50 hover:bg-[#2A3A5C] text-[#8B8FA3] rounded transition-colors"
              >
                取消
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
            analysisData={displayAnalysis}
            onCellClick={handleCellClick}
            lastMove={lastMove}
            hoverCoord={hoverCoord}
            onHoverChange={setHoverCoord}
            variationMoves={variationMoves}
          />

          {/* Board controls */}
          <div className="flex items-center gap-1.5 mt-3">
            <button
              onClick={goToFirstMove}
              disabled={!canGoPrev}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="第一手"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={goBackward5}
              disabled={!canGoPrev}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="后退5步"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              onClick={goToPrevMove}
              disabled={!canGoPrev}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="上一步"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextMove}
              disabled={!canGoNext}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="下一步"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goForward5}
              disabled={!canGoNext}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="前进5步"
            >
              <FastForward className="w-4 h-4" />
            </button>
            <button
              onClick={goToLastMove}
              disabled={!canGoNext}
              className="p-1.5 bg-[#16213E] hover:bg-[#2A3A5C] disabled:opacity-30 disabled:hover:bg-[#16213E] text-[#C0C0C0] rounded transition-colors"
              title="最后一手"
            >
              <SkipForward className="w-4 h-4" />
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
                analysisCacheRef.current.clear();
                setDisplayAnalysis([]);
                setDisplayWinrate(null);
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

          {/* Save SGF */}
          <div className="relative" ref={sgfMenuRef}>
            <button
              onClick={() => setShowSgfMenu(!showSgfMenu)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-[#1A1A2E] hover:bg-[#2A3A5C] text-[#C8CAD0] border border-[#2A3A5C]/30 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              保存 SGF
            </button>
            {showSgfMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A2E] border border-[#2A3A5C] rounded shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => handleSaveSgf(false)}
                  className="w-full text-left px-3 py-2 text-xs text-[#C8CAD0] hover:bg-[#2A3A5C] transition-colors"
                >
                  纯棋谱文件
                </button>
                <button
                  onClick={() => handleSaveSgf(true)}
                  className="w-full text-left px-3 py-2 text-xs text-[#C8CAD0] hover:bg-[#2A3A5C] transition-colors border-t border-[#2A3A5C]/30"
                >
                  带分析的棋谱文件
                </button>
                <button
                  onClick={handleSaveToCloud}
                  disabled={cloudSaving}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-[#E8B931] hover:bg-[#2A3A5C] transition-colors border-t border-[#2A3A5C]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  {cloudSaving ? '保存中...' : '保存到云棋谱库'}
                </button>
              </div>
            )}
          </div>

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
            analysisData={displayAnalysis}
            currentWinrate={displayWinrate}
            currentPlayer={currentPlayer}
            isAnalyzing={isAnalyzing}
            speed={analysisData.length > 0 ? analysisData[0].speed : undefined}
            onSelectMove={handleSelectMove}
            selectedMove={selectedMove}
          />

          {/* Hawk-Eye analysis panel */}
          <HawkEyePanel
            analysisData={displayAnalysis}
            currentWinrate={displayWinrate}
            gtpMoves={gtpMoves}
            isConnected={isConnected}
          />
        </div>
      </div>

      {/* KataGo Log Viewer */}
      <KataGoLogViewer logs={logs} />
    </div>
  );
}
