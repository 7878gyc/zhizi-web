'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import GoBoard from '@/components/go-board';
import AiConfigPanel from '@/components/ai-config-panel';
import AnalysisPanel from '@/components/analysis-panel';
import MoveTree from '@/components/move-tree';
import WinrateChart from '@/components/winrate-chart';
import KataGoLogViewer from '@/components/katago-log-viewer';
import HawkEyePanel from '@/components/hawk-eye-panel';
// import RemoteEnginePanel from '@/components/remote-engine-panel'; // Module not yet created
import { useGoGame } from '@/hooks/use-go-game';
import { useZhiziAnalysis } from '@/hooks/use-zhizi-analysis';
import { useIsMobile } from '@/hooks/use-mobile';
import { getToken, removeToken, saveUser, getUser } from '@/lib/auth';
import type { AiConfig, AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';
import { readSgfFile, parseSgfContent } from '@/lib/sgf-parser';
import { generateAnalyzedSGF, generatePureSGF, downloadSgfFile } from '@/lib/sgf';
import {
  MobileAnalyzeLayout,
} from './_components/mobile/mobile-analyze-layout';

import AnalyzeHeader from './_components/analyze-header';
import BoardControls from './_components/board-controls';
import FoxwqImportDialog from './_components/foxwq-import-dialog';
import { CloudImportDialog, SaveSgfMenu } from './_components/cloud-save-menu';
import { useAutoAnalyze } from './_hooks/use-auto-analyze';
import { useAnalysisCache } from './_hooks/use-analysis-cache';
import { useCloudRecords } from './_hooks/use-cloud-records';

interface VariationMove {
  row: number;
  col: number;
  color: 'black' | 'white';
  moveNumber: number;
}

export default function AnalyzePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
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
  const [variationMoves, setVariationMoves] = useState<VariationMove[] | null>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const selectedMoveRef = useRef(selectedMove);
  selectedMoveRef.current = selectedMove;
  const [userInfo, setUserInfo] = useState<{ phone?: string; email?: string; username?: string } | null>(null);
  const [playerBlack, setPlayerBlack] = useState('');
  const [playerWhite, setPlayerWhite] = useState('');

  // --- Analysis mode ---
  const [analysisMode, setAnalysisMode] = useState<'local' | 'remote'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zhizi_analysis_mode');
      if (saved === 'remote') return 'remote';
    }
    return 'local';
  });

  // --- Auth ---
  useEffect(() => {
    if (analysisMode === 'remote') return;
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    const cached = getUser();
    if (cached) setUserInfo(cached as { phone?: string; email?: string; username?: string });
    fetchUserInfo();
  }, [router, analysisMode]);

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
      /* ignore */
    }
  }, []);

  // --- Game state ---
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
    winrateHistory: _wrHist,
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

  // --- AI analysis ---
  const {
    analysisData,
    currentWinrate,
    isAnalyzing,
    isConnected,
    isConnecting,
    aiReady,
    error: analysisError,
    logs,
    connect,
    disconnect,
    syncAndAnalyze,
  } = useZhiziAnalysis();

  // --- Analysis display cache ---
  const [displayAnalysis, setDisplayAnalysis] = useState<AnalysisInfo[]>([]);
  const [displayWinrate, setDisplayWinrate] = useState<number | null>(null);

  const { cacheRef, analysisDataRef, currentWinrateRef, prevMoveCountRef } =
    useAnalysisCache(
      analysisData,
      currentWinrate,
      gtpMoves,
      displayAnalysis,
      setDisplayAnalysis,
      setDisplayWinrate,
    );

  // --- Winrate sync ---
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
  }, [currentWinrate, setCurrentWinrate]);

  // --- Sync and analyze on move change ---
  useEffect(() => {
    if (!isConnected) {
      prevMoveCountRef.current = -1;
      return;
    }
    // Wait for engine to be ready before issuing the first analysis.
    // If the engine is not ready yet, leave prevMoveCountRef untouched so
    // the effect re-runs (and triggers syncAndAnalyze) once aiReady flips true.
    if (!aiReady) return;
    if (gtpMoves.length === prevMoveCountRef.current) return;

    const oldIdx = prevMoveCountRef.current;
    if (oldIdx >= 0 && analysisDataRef.current.length > 0) {
      cacheRef.current.set(oldIdx, {
        data: analysisDataRef.current,
        winrate: currentWinrateRef.current,
      });
    }
    prevMoveCountRef.current = gtpMoves.length;

    const newIdx = gtpMoves.length;
    const cached = cacheRef.current.get(newIdx);
    if (cached?.data.length) {
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
  }, [isConnected, aiReady, gtpMoves, boardSize, komi, rules, currentPlayer, syncAndAnalyze]);

  // --- Load cached analysis on tree navigation ---
  useEffect(() => {
    if (isConnected) return;
    const cached = cacheRef.current.get(currentMoveNumber);
    if (cached?.data.length) {
      setDisplayAnalysis(cached.data);
      setDisplayWinrate(cached.winrate);
    } else {
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
    }
  }, [currentMoveNumber, isConnected]);

  // --- Auto analyze ---
  useAutoAnalyze(isAutoAnalyzing, isConnected, goToNextMove);

  // --- Variation preview cleanup ---
  useEffect(() => {
    setSelectedMove(null);
    setVariationMoves(null);
  }, [currentNodeId]);

  // --- Cloud records ---
  const {
    records: cloudRecords,
    loading: cloudLoading,
    error: cloudError,
    importingId: cloudImporting,
    setImportingId: setCloudImporting,
    fetchRecords: fetchCloudRecords,
    deleteRecord: deleteCloudRecord,
    setError: setCloudError,
  } = useCloudRecords();

  // --- Cloud/SGF save state ---
  const [showSgfMenu, setShowSgfMenu] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [showCloudImport, setShowCloudImport] = useState(false);
  const [cloudSourceRecordId, setCloudSourceRecordId] = useState<string | null>(null);
  const cloudSourceFileKeyRef = useRef<string | null>(null);
  const sgfMenuRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const handleStartAnalysis = useCallback(() => {
    if (getToken()) {
      connect(selectedConfig);
    } else {
      router.replace('/login');
    }
  }, [selectedConfig, connect, router]);

  const handleStopAnalysis = useCallback(() => {
    setIsAutoAnalyzing(false);
    disconnect();
  }, [disconnect]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      placeStone(row, col);
      setSelectedMove(null);
      setVariationMoves(null);
    },
    [placeStone],
  );

  const handleLogout = useCallback(() => {
    setIsAutoAnalyzing(false);
    disconnect();
    removeToken();
    router.replace('/login');
  }, [disconnect, router]);

  // --- SGF import: local file ---
  const importSgfFromFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const result = await readSgfFile(file);
      if (!result) {
        alert('SGF 文件解析失败，请检查文件格式');
        return;
      }
      disconnect();
      if (result.boardSize !== boardSize) setBoardSize(result.boardSize);
      setKomi(result.komi);
      setRules(result.rules);
      setPlayerBlack(result.playerBlack);
      setPlayerWhite(result.playerWhite);
      setCloudSourceRecordId(null);
      cloudSourceFileKeyRef.current = null;
      cacheRef.current.clear();
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
      result.analysisCache.forEach((value, key) => cacheRef.current.set(key, value));
      loadFromTree(result.tree);
      if (sgfInputRef.current) sgfInputRef.current.value = '';
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree],
  );

  // --- SGF import: Foxwq ---
  const [showFoxwq, setShowFoxwq] = useState(false);

  const handleFoxwqImport = useCallback(
    async (url: string) => {
      const resp = await fetch('/api/foxwq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || '获取棋谱失败');
      if (!data.sgf) throw new Error('未获取到棋谱内容');

      const result = parseSgfContent(data.sgf);
      if (!result) throw new Error('棋谱格式解析失败');

      disconnect();
      if (result.boardSize !== boardSize) setBoardSize(result.boardSize);
      setKomi(result.komi);
      setRules(result.rules);
      setPlayerBlack(result.playerBlack);
      setPlayerWhite(result.playerWhite);
      setCloudSourceRecordId(null);
      cloudSourceFileKeyRef.current = null;
      cacheRef.current.clear();
      setDisplayAnalysis([]);
      setDisplayWinrate(null);
      result.analysisCache.forEach((value, key) => cacheRef.current.set(key, value));
      loadFromTree(result.tree);
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree],
  );

  // --- SGF import: Cloud ---
  const handleOpenCloudImport = useCallback(() => {
    setShowCloudImport(true);
    setCloudError('');
    fetchCloudRecords(getToken());
  }, [fetchCloudRecords]);

  const handleSelectCloudRecord = useCallback(
    async (rec: { id: string; fileName: string; fileKey?: string }) => {
      const { id } = rec;
      setCloudImporting(id);
      setCloudError('');
      const token = getToken();

      try {
        const dlResp = await fetch(`/api/records/${id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dlData = await dlResp.json();
        if (!dlResp.ok) throw new Error(dlData.error || '获取下载链接失败');

        const fileResp = await fetch(dlData.downloadUrl);
        if (!fileResp.ok) throw new Error('下载棋谱文件失败');

        const sgfText = await fileResp.text();
        const parsed = parseSgfContent(sgfText);
        if (!parsed) throw new Error('无法解析棋谱文件');

        if (parsed.boardSize >= 1 && parsed.boardSize <= 19) setBoardSize(parsed.boardSize);
        setKomi(parsed.komi);
        if (parsed.rules) setRules(parsed.rules);
        setPlayerBlack(parsed.playerBlack);
        setPlayerWhite(parsed.playerWhite);
        setCloudSourceRecordId(id);
        cloudSourceFileKeyRef.current = rec.fileKey ?? null;
        loadFromTree(parsed.tree);
        if (parsed.analysisCache) cacheRef.current = parsed.analysisCache;

        let lastNode = parsed.tree;
        while (lastNode.children.length > 0) lastNode = lastNode.children[0];
        jumpToNode(lastNode.id);

        setShowCloudImport(false);
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : '导入失败');
      } finally {
        setCloudImporting(null);
      }
    },
    [setBoardSize, setKomi, setRules, loadFromTree, jumpToNode],
  );

  const handleDeleteCloudRecord = useCallback(
    (id: string, fileName: string) => {
      deleteCloudRecord(id, fileName, getToken());
      if (cloudSourceRecordId === id) {
        setCloudSourceRecordId(null);
        cloudSourceFileKeyRef.current = null;
      }
    },
    [deleteCloudRecord, cloudSourceRecordId],
  );

  // --- SGF save ---
  const handleSaveSgf = useCallback(
    (includeAnalysis: boolean) => {
      setShowSgfMenu(false);
      try {
        const content = includeAnalysis
          ? generateAnalyzedSGF({
              boardSize,
              komi,
              rules,
              moveTree,
              analysisCache: includeAnalysis ? cacheRef.current : undefined,
              includeAnalysis,
              playerBlack: playerBlack || undefined,
              playerWhite: playerWhite || undefined,
            })
          : generatePureSGF({
              boardSize,
              komi,
              rules,
              moveTree,
              playerBlack: playerBlack || undefined,
              playerWhite: playerWhite || undefined,
            });
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const baseName =
          playerBlack && playerWhite ? `${playerBlack}vs${playerWhite}` : `新盘面-${timestamp}`;
        downloadSgfFile(content, `${baseName}${includeAnalysis ? '_analyzed' : ''}.sgf`);
      } catch {
        alert('保存 SGF 失败');
      }
    },
    [boardSize, komi, rules, moveTree, playerBlack, playerWhite],
  );

  const handleSaveToCloud = useCallback(async () => {
    setShowSgfMenu(false);
    setCloudSaving(true);
    try {
      const content = generateAnalyzedSGF({
        boardSize,
        komi,
        rules,
        moveTree,
        analysisCache: cacheRef.current,
        includeAnalysis: true,
        playerBlack: playerBlack || undefined,
        playerWhite: playerWhite || undefined,
      });
      const blob = new Blob([content], { type: 'application/x-go-sgf' });
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const baseName =
        playerBlack && playerWhite ? `${playerBlack}vs${playerWhite}` : `新盘面-${timestamp}`;
      const fileName = `${baseName}.sgf`;
      const token = getToken();
      const isOverwrite =
        cloudSourceRecordId !== null && cloudSourceFileKeyRef.current !== null;

      const uploadBody: Record<string, unknown> = { fileName, fileSize: blob.size };
      if (isOverwrite) uploadBody.fileKey = cloudSourceFileKeyRef.current;

      const uploadResp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(uploadBody),
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.json();
        throw new Error(err.error || '获取上传链接失败');
      }
      const { uploadUrl, fileKey } = await uploadResp.json();

      const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-go-sgf' },
        body: blob,
      });
      if (!putResp.ok) throw new Error('文件上传到云端失败');

      if (isOverwrite) {
        await fetch(`/api/records/${cloudSourceRecordId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName }),
        });
        setCloudSourceRecordId(null);
        cloudSourceFileKeyRef.current = null;
      } else {
        await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName, fileKey, fileSize: blob.size }),
        });
      }
      alert('棋谱已保存到云棋谱库');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存到云端失败');
    } finally {
      setCloudSaving(false);
    }
  }, [boardSize, komi, rules, moveTree, playerBlack, playerWhite, cloudSourceRecordId]);

  // --- Variation selection ---
  const handleSelectMove = useCallback(
    (info: AnalysisInfo) => {
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
    },
    [currentPlayer, boardSize],
  );

  // --- Tree navigation ---
  const canGoPrev = currentNodeId !== 'root';
  const currentNode = useMemo(() => {
    const findInTree = (node: typeof moveTree): typeof moveTree | null => {
      if (node.id === currentNodeId) return node;
      for (const child of node.children) {
        const found = findInTree(child);
        if (found) return found;
      }
      return null;
    };
    return findInTree(moveTree);
  }, [moveTree, currentNodeId]);
  const canGoNext = currentNode !== null && currentNode.children.length > 0;

  useEffect(() => {
    if (isAutoAnalyzing && !canGoNext) setIsAutoAnalyzing(false);
  }, [isAutoAnalyzing, canGoNext]);

  const goToFirstMove = useCallback(() => {
    const first = moveTree.children[0];
    jumpToNode(first ? first.id : 'root');
  }, [moveTree, jumpToNode]);

  const goToLastMove = useCallback(() => {
    let node = moveTree;
    while (node.children.length > 0) node = node.children[0];
    jumpToNode(node.id);
  }, [moveTree, jumpToNode]);

  const goBackward5 = useCallback(() => {
    let nodeId = currentNodeId;
    for (let i = 0; i < 5 && nodeId !== 'root'; i++) {
      const f = (tree: typeof moveTree): typeof moveTree | null => {
        if (tree.id === nodeId) return tree;
        for (const c of tree.children) {
          const r = f(c);
          if (r) return r;
        }
        return null;
      };
      const node = f(moveTree);
      if (!node?.parentId) break;
      nodeId = node.parentId;
    }
    jumpToNode(nodeId);
  }, [moveTree, currentNodeId, jumpToNode]);

  const goForward5 = useCallback(() => {
    let nodeId = currentNodeId;
    for (let i = 0; i < 5; i++) {
      const f = (tree: typeof moveTree): typeof moveTree | null => {
        if (tree.id === nodeId) return tree;
        for (const c of tree.children) {
          const r = f(c);
          if (r) return r;
        }
        return null;
      };
      const node = f(moveTree);
      if (!node || node.children.length === 0) break;
      nodeId = node.children[0].id;
    }
    jumpToNode(nodeId);
  }, [moveTree, currentNodeId, jumpToNode]);

  // --- Winrate chart ---
  const fullWinrateHistory = useMemo(() => {
    const history: (number | null)[] = [null];
    let node: typeof moveTree | null = moveTree;
    while (node) {
      if (node.moveNumber > 0) history.push(node.winrate ?? null);
      node = node.children.length > 0 ? node.children[0] : null;
    }
    return history;
  }, [moveTree]);

  const moveNumberToNodeId = useMemo(() => {
    const map = new Map<number, string>();
    let node: typeof moveTree | null = moveTree;
    while (node) {
      if (node.moveNumber > 0) map.set(node.moveNumber, node.id);
      node = node.children.length > 0 ? node.children[0] : null;
    }
    return map;
  }, [moveTree]);

  const handleWinrateClick = useCallback(
    (moveNumber: number) => {
      const nodeId = moveNumberToNodeId.get(moveNumber);
      if (nodeId) jumpToNode(nodeId);
    },
    [moveNumberToNodeId, jumpToNode],
  );

  // --- Display name ---
  const userDisplayName = userInfo
    ? userInfo.phone || userInfo.email || userInfo.username || '用户'
    : '';

  // --- Reset handler ---
  const handleReset = useCallback(() => {
    disconnect();
    resetBoard();
    setVariationMoves(null);
    cacheRef.current.clear();
    setDisplayAnalysis([]);
    setDisplayWinrate(null);
    setPlayerBlack('');
    setPlayerWhite('');
    setCloudSourceRecordId(null);
    cloudSourceFileKeyRef.current = null;
  }, [disconnect, resetBoard]);

  // --- Board size change ---
  const handleSetSize = useCallback(
    (size: number) => {
      if (size !== boardSize) {
        disconnect();
        setBoardSize(size);
      }
    },
    [boardSize, disconnect, setBoardSize],
  );

  // ============================================================
  // Render
  // ============================================================
  if (isMobile) {
    return (
      <div className="h-dvh bg-[#0F0F23] text-[#E0E0E0] flex flex-col overflow-hidden">
        {/* Hidden SGF file input */}
        <input
          ref={sgfInputRef}
          type="file"
          accept=".sgf"
          className="hidden"
          onChange={importSgfFromFile}
        />

        <FoxwqImportDialog
          open={showFoxwq}
          onClose={() => setShowFoxwq(false)}
          onImport={handleFoxwqImport}
        />

        <CloudImportDialog
          open={showCloudImport}
          onClose={() => {
            setShowCloudImport(false);
            setCloudError('');
          }}
          records={cloudRecords}
          loading={cloudLoading}
          error={cloudError}
          importingId={cloudImporting}
          onSelect={handleSelectCloudRecord}
          onDelete={handleDeleteCloudRecord}
        />

        <MobileAnalyzeLayout
          board={board}
          boardSize={boardSize}
          lastMove={lastMove}
          currentPlayer={currentPlayer}
          hoverCoord={hoverCoord}
          winrateHistory={fullWinrateHistory}
          displayWinrate={displayWinrate}
          analysisData={displayAnalysis}
          selectedPv={displayAnalysis[0] ?? null}
          variationMoves={variationMoves ?? []}
          selectedMove={selectedMove}
          onSelectMove={handleSelectMove}
          onBoardClick={handleCellClick}
          onBoardHover={setHoverCoord}
          onSelectMoveFromWinrate={handleWinrateClick}
          gpu={selectedConfig.gpuType}
          weight={selectedConfig.kataWeight}
          gpuOptions={['1x', '2x', '3x', '4x', 'vip-share']}
          weightOptions={['18b', '28bnbt', 'fdx']}
          onGpuChange={(g) => setSelectedConfig((p) => ({ ...p, gpuType: g }))}
          onWeightChange={(w) => setSelectedConfig((p) => ({ ...p, kataWeight: w }))}
          blackName={playerBlack}
          whiteName={playerWhite}
          onBlackNameChange={setPlayerBlack}
          onWhiteNameChange={setPlayerWhite}
          komi={komi}
          rules={rules}
          onKomiChange={setKomi}
          onRulesChange={setRules}
          moveTree={moveTree}
          currentNodeId={currentNodeId}
          currentMoveNumber={currentMoveNumber}
          onJumpToNode={jumpToNode}
          onDeleteNode={deleteNode}
          onDeleteBranch={deleteBranch}
          gtpMoves={gtpMoves}
          isAnalyzing={isAnalyzing}
          isAutoAnalyze={isAutoAnalyzing}
          isConnected={isConnected}
          isConnecting={isConnecting}
          analysisError={analysisError}
          logs={logs}
          onToggleAnalyze={() =>
            isAnalyzing ? handleStopAnalysis() : handleStartAnalysis()
          }
          onToggleAuto={() => setIsAutoAnalyzing((p) => !p)}
          onNewBoard={handleReset}
          onSaveSgf={() => handleSaveSgf(true)}
          onLoadSgf={() => sgfInputRef.current?.click()}
          onImportFoxwq={() => setShowFoxwq(true)}
          onCloudSave={handleSaveToCloud}
          onCloudLoad={handleOpenCloudImport}
          userDisplayName={userDisplayName}
          onLogout={handleLogout}
          onGoToPrevMove={goToPrevMove}
          onGoToNextMove={goToNextMove}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E0E0E0]">
      <AnalyzeHeader
        boardSize={boardSize}
        currentPlayer={currentPlayer}
        isConnected={isConnected}
        playerBlack={playerBlack}
        playerWhite={playerWhite}
        userDisplayName={userDisplayName}
        onSetBlack={setPlayerBlack}
        onSetWhite={setPlayerWhite}
        onImportSgf={() => sgfInputRef.current?.click()}
        onFoxwqImport={() => setShowFoxwq(true)}
        onCloudImport={handleOpenCloudImport}
        onLogout={handleLogout}
      />

      {/* Hidden SGF file input */}
      <input
        ref={sgfInputRef}
        type="file"
        accept=".sgf"
        className="hidden"
        onChange={importSgfFromFile}
      />

      <FoxwqImportDialog
        open={showFoxwq}
        onClose={() => setShowFoxwq(false)}
        onImport={handleFoxwqImport}
      />

      <CloudImportDialog
        open={showCloudImport}
        onClose={() => {
          setShowCloudImport(false);
          setCloudError('');
        }}
        records={cloudRecords}
        loading={cloudLoading}
        error={cloudError}
        importingId={cloudImporting}
        onSelect={handleSelectCloudRecord}
        onDelete={handleDeleteCloudRecord}
      />

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

          <BoardControls
            boardSize={boardSize}
            komi={komi}
            rules={rules}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onGoFirst={goToFirstMove}
            onGoLast={goToLastMove}
            onGoPrev={goToPrevMove}
            onGoNext={goToNextMove}
            onGoBack5={goBackward5}
            onGoForward5={goForward5}
            onSetSize={handleSetSize}
            onSetKomi={setKomi}
            onSetRules={setRules}
            onReset={handleReset}
          />
        </div>

        {/* Right: Analysis panel */}
        <div className="w-[340px] bg-[#16213E]/40 border-l border-[#2A3A5C]/30 flex flex-col overflow-y-auto p-3 gap-4 scrollbar-thin">
          {/* Mode badge */}
          <div className="flex items-center justify-between">
            <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">当前模式</span>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${
                analysisMode === 'remote'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'bg-[#E8B931]/15 text-[#E8B931] border-[#E8B931]/30'
              }`}
            >
              {analysisMode === 'remote' ? '远程算力' : '本地分析'}
            </span>
          </div>

          {analysisMode === 'local' && (
            <AiConfigPanel
              selectedConfig={selectedConfig}
              onSelectConfig={setSelectedConfig}
              isConnected={isConnected}
              isConnecting={isConnecting}
              isAnalyzing={isAnalyzing}
              onStartAnalysis={handleStartAnalysis}
              onStopAnalysis={handleStopAnalysis}
              isAutoAnalyzing={isAutoAnalyzing}
              onToggleAutoAnalyze={() => setIsAutoAnalyzing((p) => !p)}
              error={analysisError}
            />
          )}

          {analysisMode === 'remote' && (
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-xs text-cyan-400">远程算力模式（即将支持）</p>
            </div>
          )}

          <SaveSgfMenu
            cloudSourceRecordId={cloudSourceRecordId}
            showMenu={showSgfMenu}
            cloudSaving={cloudSaving}
            onToggle={() => setShowSgfMenu((p) => !p)}
            onSaveLocal={handleSaveSgf}
            onSaveCloud={handleSaveToCloud}
            menuRef={sgfMenuRef}
          />

          <MoveTree
            tree={moveTree}
            currentNodeId={currentNodeId}
            onJumpToNode={jumpToNode}
            onDeleteNode={deleteNode}
            onDeleteBranch={deleteBranch}
          />

          <WinrateChart
            winrateHistory={fullWinrateHistory}
            currentMoveNumber={currentMoveNumber}
            onClickMove={handleWinrateClick}
          />

          <AnalysisPanel
            analysisData={displayAnalysis}
            currentWinrate={displayWinrate}
            currentPlayer={currentPlayer}
            isAnalyzing={isAnalyzing}
            speed={analysisData.length > 0 ? analysisData[0].speed : undefined}
            onSelectMove={handleSelectMove}
            selectedMove={selectedMove}
          />

          <HawkEyePanel
            analysisData={displayAnalysis}
            currentWinrate={displayWinrate}
            gtpMoves={gtpMoves}
            isConnected={isConnected}
            analysisCache={cacheRef.current}
          />
        </div>
      </div>

      <KataGoLogViewer logs={logs} />
    </div>
  );
}
