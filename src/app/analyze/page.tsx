'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GoBoard from '@/components/go-board';
import AiConfigPanel from '@/components/ai-config-panel';
import AnalysisPanel from '@/components/analysis-panel';
import MoveTree from '@/components/move-tree';
import WinrateChart from '@/components/winrate-chart';
import KataGoLogViewer from '@/components/katago-log-viewer';
import HawkEyePanel from '@/components/hawk-eye-panel';
import { useGoGame } from '@/hooks/use-go-game';
import { useZhiziAnalysis } from '@/hooks/use-zhizi-analysis';
import { useIsMobile } from '@/hooks/use-mobile';
import { saveUser, getUser, logout, fetchCurrentUser } from '@/lib/auth';
import type { AiConfig, AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord, getExtendedLine, getPathToNode, GPU_TYPES, WEIGHTS, KATA_ENGINES, DEFAULT_ENGINE } from '@/lib/go-types';
import { readSgfFile, parseSgfContent } from '@/lib/sgf-parser';
import { generateAnalyzedSGF, generatePureSGF, downloadSgfFile } from '@/lib/sgf';
import { buildAnalysisSyncKey, toSyncParams } from '@/lib/analysis-key';
import { uploadSgfToCloud } from '@/lib/cloud-save';
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
    kataName: DEFAULT_ENGINE,
    kataWeight: '28bnbt',
    label: '28b-nbt (标准) 1x GPU',
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
  // 远程算力尚未接入；先固定为本地分析，避免用 localStorage 绕过登录校验。
  const analysisMode = 'local' as const;

  // --- Auth ---
  useEffect(() => {
    let active = true;
    const cached = getUser();
    if (cached) setUserInfo(cached as { phone?: string; email?: string; username?: string });
    fetchCurrentUser().then((user) => {
      if (!active) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      const info = { phone: user.phone, email: user.email, username: user.username || user.nickname };
      setUserInfo(info as { phone?: string; email?: string; username?: string });
      saveUser(info);
      // 老用户数据迁移（幂等）：确保已有的旧无盐数据尽快迁到加盐路径
      fetch('/api/auth/migrate', { method: 'POST' }).catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [router]);

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
    placeStone,
    goToPrevMove,
    goToNextMove,
    jumpToNode,
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
    error: analysisError,
    logs,
    connect,
    disconnect,
    syncAndAnalyze,
  } = useZhiziAnalysis();

  // --- Analysis display cache ---
  const [displayAnalysis, setDisplayAnalysis] = useState<AnalysisInfo[]>([]);
  const [displayWinrate, setDisplayWinrate] = useState<number | null>(null);
  // 当前这轮引擎同步对应的局面；分析结果按这个 nodeId 入缓存，而不是按手数。
  const [analysisNodeId, setAnalysisNodeId] = useState('root');

  const { cacheRef } = useAnalysisCache(
    analysisData,
    currentWinrate,
    analysisNodeId,
    currentNodeId,
    setDisplayAnalysis,
    setDisplayWinrate,
  );

  // --- Handicap stones (from imported SGF root AB/AW) ---
  const handicapStones = useMemo(
    () =>
      (moveTree.handicapStones ?? [])
        .filter((s) => s.color === 'black')
        .map((s) => s.move),
    [moveTree],
  );
  const handicapWhiteStones = useMemo(
    () =>
      (moveTree.handicapStones ?? [])
        .filter((s) => s.color === 'white')
        .map((s) => s.move),
    [moveTree],
  );

  // 当前路径（root → 当前节点）以及供鹰眼使用的节点 id 列表。
  const currentPath = useMemo(
    () => getPathToNode(moveTree, currentNodeId),
    [moveTree, currentNodeId],
  );
  const analysisPathIds = useMemo(
    () => currentPath.map((node) => node.id),
    [currentPath],
  );

  // --- Winrate sync ---
  // 不再做跨局面去重：节点级去重由 useGoGame.setCurrentWinrate 完成，
  // 否则两个局面恰好同胜率时后一个节点会漏记。
  useEffect(() => {
    if (analysisNodeId !== currentNodeId) return;
    if (
      currentWinrate !== null &&
      currentWinrate >= 0 &&
      currentWinrate <= 1
    ) {
      setCurrentWinrate(currentWinrate);
    }
  }, [currentWinrate, setCurrentWinrate, analysisNodeId, currentNodeId]);

  // --- Sync and analyze on position / connection change ---
  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected) {
      lastSyncKeyRef.current = null;
      return;
    }

    // 同步键包含 currentNodeId：同一手数切到另一分支也必须重新分析。
    const syncKey = buildAnalysisSyncKey({
      nodeId: currentNodeId,
      boardSize,
      komi,
      rules,
      player: currentPlayer,
      moves: gtpMoves,
      handicapStones,
      handicapWhiteStones,
    });
    if (syncKey === lastSyncKeyRef.current) return;
    lastSyncKeyRef.current = syncKey;

    // 标记这轮分析属于哪个局面，并把该局面已有的缓存先展示出来；
    // 没有缓存就清空，避免继续显示上一个局面的结果。
    setAnalysisNodeId(currentNodeId);
    const cached = cacheRef.current.get(currentNodeId);
    setDisplayAnalysis(cached?.data ?? []);
    setDisplayWinrate(cached?.winrate ?? null);

    syncAndAnalyze(
      toSyncParams({
        nodeId: currentNodeId,
        boardSize,
        komi,
        rules,
        player: currentPlayer,
        moves: gtpMoves,
        handicapStones,
        handicapWhiteStones,
      }),
    );
  }, [
    isConnected,
    currentNodeId,
    gtpMoves,
    boardSize,
    komi,
    rules,
    currentPlayer,
    handicapStones,
    handicapWhiteStones,
    syncAndAnalyze,
    cacheRef,
  ]);

  // --- Load cached analysis on tree navigation while offline ---
  useEffect(() => {
    if (isConnected) return;
    const cached = cacheRef.current.get(currentNodeId);
    setDisplayAnalysis(cached?.data ?? []);
    setDisplayWinrate(cached?.winrate ?? null);
  }, [currentNodeId, isConnected, cacheRef]);

  // --- Auto analyze: 当前局面已有分析结果才前进 ---
  useAutoAnalyze(
    isAutoAnalyzing,
    isConnected,
    goToNextMove,
    () => cacheRef.current.has(currentNodeId),
  );

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
    connect(selectedConfig);
  }, [selectedConfig, connect]);

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
    logout().finally(() => router.replace('/login'));
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
      loadFromTree(result.tree, undefined, result.boardSize);
      if (sgfInputRef.current) sgfInputRef.current.value = '';
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree, cacheRef],
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
      loadFromTree(result.tree, undefined, result.boardSize);
    },
    [disconnect, boardSize, setBoardSize, setKomi, setRules, loadFromTree, cacheRef],
  );

  // --- SGF import: Cloud ---
  const handleOpenCloudImport = useCallback(() => {
    setShowCloudImport(true);
    setCloudError('');
    fetchCloudRecords();
  }, [fetchCloudRecords, setCloudError]);

  const handleSelectCloudRecord = useCallback(
    async (rec: { id: string; fileName: string; fileKey?: string }) => {
      const { id } = rec;
      setCloudImporting(id);
      setCloudError('');

      try {
        const dlResp = await fetch(`/api/records/${id}/download`);
        const dlData = await dlResp.json();
        if (!dlResp.ok) throw new Error(dlData.error || '获取下载链接失败');

        const fileResp = await fetch(dlData.downloadUrl);
        if (!fileResp.ok) throw new Error('下载棋谱文件失败');

        const sgfText = await fileResp.text();
        const parsed = parseSgfContent(sgfText);
        if (!parsed) throw new Error('无法解析棋谱文件');

        if (parsed.boardSize >= 2 && parsed.boardSize <= 19) setBoardSize(parsed.boardSize);
        setKomi(parsed.komi);
        if (parsed.rules) setRules(parsed.rules);
        setPlayerBlack(parsed.playerBlack);
        setPlayerWhite(parsed.playerWhite);
        setCloudSourceRecordId(id);
        cloudSourceFileKeyRef.current = rec.fileKey ?? null;
        loadFromTree(parsed.tree, undefined, parsed.boardSize);
        if (parsed.analysisCache) cacheRef.current = parsed.analysisCache;

        setShowCloudImport(false);
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : '导入失败');
      } finally {
        setCloudImporting(null);
      }
    },
    [setBoardSize, setKomi, setRules, loadFromTree, cacheRef, setCloudError, setCloudImporting],
  );

  const handleDeleteCloudRecord = useCallback(
    (id: string, fileName: string) => {
      deleteCloudRecord(id, fileName);
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
    [boardSize, komi, rules, moveTree, playerBlack, playerWhite, cacheRef],
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
      const result = await uploadSgfToCloud({
        fileName,
        blob,
        sourceRecordId: cloudSourceRecordId,
        sourceFileKey: cloudSourceFileKeyRef.current,
      });
      setCloudSourceRecordId(result.recordId);
      cloudSourceFileKeyRef.current = result.fileKey;
      alert('棋谱已保存到云棋谱库');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存到云端失败');
    } finally {
      setCloudSaving(false);
    }
  }, [boardSize, komi, rules, moveTree, playerBlack, playerWhite, cloudSourceRecordId, cacheRef]);

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
  // 以当前分支为准：root → 当前节点，再沿首选子节点走到叶子。
  const activeLine = useMemo(
    () => getExtendedLine(moveTree, currentNodeId),
    [moveTree, currentNodeId],
  );

  const fullWinrateHistory = useMemo(() => {
    return activeLine.map((node, idx) => (idx === 0 ? null : node.winrate ?? null));
  }, [activeLine]);

  const moveNumberToNodeId = useMemo(() => {
    const map = new Map<number, string>();
    for (const node of activeLine) {
      if (node.moveNumber > 0) map.set(node.moveNumber, node.id);
    }
    return map;
  }, [activeLine]);

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
  }, [disconnect, resetBoard, cacheRef]);

  // --- Board size change ---
  const handleSetSize = useCallback(
    (size: number) => {
      if (size !== boardSize) {
        disconnect();
        cacheRef.current.clear();
        setDisplayAnalysis([]);
        setDisplayWinrate(null);
        // 棋盘尺寸变了，不再属于同一条云棋谱：避免把新棋谱覆盖到旧记录。
        setCloudSourceRecordId(null);
        cloudSourceFileKeyRef.current = null;
        setBoardSize(size);
      }
    },
    [boardSize, disconnect, setBoardSize, cacheRef],
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
          variationMoves={variationMoves ?? []}
          selectedMove={selectedMove}
          onSelectMove={handleSelectMove}
          onBoardClick={handleCellClick}
          onBoardHover={setHoverCoord}
          onSelectMoveFromWinrate={handleWinrateClick}
          gpu={selectedConfig.gpuType}
          weight={selectedConfig.kataWeight}
          engine={selectedConfig.kataName}
          gpuOptions={GPU_TYPES.map((g) => g.value)}
          weightOptions={WEIGHTS.map((w) => w.value)}
          engineOptions={KATA_ENGINES.map((e) => e.value)}
          onGpuChange={(g) => setSelectedConfig((p) => ({ ...p, gpuType: g }))}
          onWeightChange={(w) => setSelectedConfig((p) => ({ ...p, kataWeight: w }))}
          onEngineChange={(e) => setSelectedConfig((p) => ({ ...p, kataName: e }))}
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
          onDeleteBranch={deleteBranch}
          gtpMoves={gtpMoves}
          analysisCache={cacheRef.current}
          analysisPathIds={analysisPathIds}
          onJumpToMove={handleWinrateClick}
          isAnalyzing={isAnalyzing}
          isAutoAnalyze={isAutoAnalyzing}
          isConnected={isConnected}
          isConnecting={isConnecting}
          analysisError={analysisError}
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
          onGoFirstMove={goToFirstMove}
          onGoLastMove={goToLastMove}
          onGoBack5Move={goBackward5}
          onGoForward5Move={goForward5}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E0E0E0] flex flex-col">
      <AnalyzeHeader
        boardSize={boardSize}
        currentPlayer={currentPlayer}
        isConnected={isConnected}
        isConnecting={isConnecting}
        analysisMode={analysisMode}
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
      <div className="flex flex-1 min-h-0">
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
          <AiConfigPanel
            selectedConfig={selectedConfig}
            onSelectConfig={setSelectedConfig}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onStartAnalysis={handleStartAnalysis}
            onStopAnalysis={handleStopAnalysis}
            isAutoAnalyzing={isAutoAnalyzing}
            onToggleAutoAnalyze={() => setIsAutoAnalyzing((p) => !p)}
            error={analysisError}
          />

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
            gtpMoves={gtpMoves}
            analysisCache={cacheRef.current}
            analysisPathIds={analysisPathIds}
            onJumpToMove={handleWinrateClick}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="h-7 shrink-0 flex items-center justify-center gap-5 text-xs text-[#8B8FA3] border-t border-[#2A3A5C]/40">
        <Link href="/about" className="hover:text-[#E8B931] transition-colors">
          关于
        </Link>
        <Link href="/privacy/human" className="hover:text-[#E8B931] transition-colors">
          隐私与服务声明
        </Link>
      </footer>

      <KataGoLogViewer logs={logs} />
    </div>
  );
}
