'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MobileTopBar } from './mobile-top-bar';
import { MobilePlayerBadges } from './mobile-player-badges';
import { MobileBottomBar } from './mobile-bottom-bar';
import { MobileMenuSheet } from './mobile-menu-sheet';
import GoBoard from '@/components/go-board';
import MoveTree from '@/components/move-tree';
import WinrateChart from '@/components/winrate-chart';
import AnalysisPanel from '@/components/analysis-panel';
import HawkEyePanel from '@/components/hawk-eye-panel';
import { cn } from '@/lib/utils';
import type { AnalysisInfo, MoveNode } from '@/lib/go-types';

interface MobileAnalyzeLayoutProps {
  /* Board */
  board: ('black' | 'white' | null)[][];
  boardSize: number;
  lastMove: { row: number; col: number } | null;
  currentPlayer: 'black' | 'white';
  hoverCoord: { row: number; col: number } | null;
  winrateHistory: (number | null)[];
  displayWinrate: number | null;
  analysisData: AnalysisInfo[];
  selectedPv: AnalysisInfo | null;
  variationMoves: { row: number; col: number; color: 'black' | 'white'; moveNumber: number }[];
  selectedMove?: string | null;
  onSelectMove?: (info: AnalysisInfo) => void;
  onBoardClick: (row: number, col: number) => void;
  onBoardHover: (coord: { row: number; col: number } | null) => void;
  onSelectMoveFromWinrate: (moveNumber: number) => void;

  /* AI config */
  gpu: string;
  weight: string;
  gpuOptions: string[];
  weightOptions: string[];
  onGpuChange: (gpu: string) => void;
  onWeightChange: (weight: string) => void;

  /* Players */
  blackName: string;
  whiteName: string;
  onBlackNameChange: (name: string) => void;
  onWhiteNameChange: (name: string) => void;

  /* Game rules */
  komi: number;
  rules: string;
  onKomiChange: (komi: number) => void;
  onRulesChange: (rules: string) => void;

  /* Move tree */
  moveTree: MoveNode;
  currentNodeId: string;
  currentMoveNumber: number;
  onJumpToNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteBranch: (nodeId: string) => void;

  /* HawkEye */
  gtpMoves: string[];
  /** Pre-built analysis cache (offline mode). Lets HawkEye rebuild results after disconnect. */
  analysisCache?: Map<number, { data: AnalysisInfo[]; winrate: number | null }>;
  /** Jump to the given move number in the game tree (from HawkEye problem list). */
  onJumpToMove?: (moveNumber: number) => void;

  /* Analysis */
  isAnalyzing: boolean;
  isAutoAnalyze: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  analysisError: string | null;
  logs: string[];
  onToggleAnalyze: () => void;
  onToggleAuto: () => void;

  /* Actions */
  onNewBoard: () => void;
  onSaveSgf: () => void;
  onLoadSgf: () => void;
  onImportFoxwq: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;

  /* User info */
  userDisplayName: string;
  onLogout: () => void;

  /* Move controls */
  onGoToPrevMove: () => void;
  onGoToNextMove: () => void;
}

export function MobileAnalyzeLayout({
  board,
  boardSize,
  lastMove,
  currentPlayer,
  hoverCoord,
  winrateHistory,
  displayWinrate,
  analysisData,
  selectedPv,
  variationMoves,
  selectedMove,
  onSelectMove,
  onBoardClick,
  onBoardHover,
  onSelectMoveFromWinrate,
  gpu,
  weight,
  gpuOptions,
  weightOptions,
  onGpuChange,
  onWeightChange,
  blackName,
  whiteName,
  onBlackNameChange,
  onWhiteNameChange,
  komi,
  rules,
  onKomiChange,
  onRulesChange,
  moveTree,
  currentNodeId,
  currentMoveNumber,
  onJumpToNode,
  onDeleteNode,
  onDeleteBranch,
  gtpMoves,
  analysisCache,
  onJumpToMove,
  isAnalyzing,
  isAutoAnalyze,
  isConnected,
  isConnecting,
  analysisError,
  logs: _logs,
  onToggleAnalyze,
  onToggleAuto,
  onNewBoard,
  onSaveSgf,
  onLoadSgf,
  onImportFoxwq,
  onCloudSave,
  onCloudLoad,
  userDisplayName,
  onLogout,
  onGoToPrevMove,
  onGoToNextMove,
}: MobileAnalyzeLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const prevIsAnalyzing = useRef(false);

  // Auto-open menu when analysis starts
  useEffect(() => {
    if (isAnalyzing && !prevIsAnalyzing.current) {
      setIsMenuOpen(true);
    }
    prevIsAnalyzing.current = isAnalyzing;
  }, [isAnalyzing]);

  // Safe newBoard handler
  const handleNewBoard = useCallback(() => {
    if (typeof onNewBoard === 'function') {
      onNewBoard();
    }
  }, [onNewBoard]);

  return (
    <div className="h-full w-full max-w-full flex flex-col bg-[#0F0F23] overflow-hidden">
      {/* Top bar: user(left) | gpu+weight(center) | start/stop(right) */}
      <MobileTopBar
        gpu={gpu}
        weight={weight}
        gpuOptions={gpuOptions}
        weightOptions={weightOptions}
        onGpuChange={onGpuChange}
        onWeightChange={onWeightChange}
        userDisplayName={userDisplayName}
        onLogout={onLogout}
        isAnalyzing={isAnalyzing}
        isConnecting={isConnecting}
        onToggleAnalyze={onToggleAnalyze}
      />

      {/* Analysis error banner */}
      {analysisError && (
        <div className="shrink-0 px-2 py-1 text-[11px] text-red-400 bg-red-500/10 border-b border-red-500/20">
          {analysisError}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Board area */}
        <div className={cn(
          'flex flex-col items-center justify-center min-h-0 overflow-hidden',
          isMenuOpen ? 'flex-[7]' : 'flex-1'
        )}>
          <div className="flex-1 flex items-center justify-center p-0.5 w-full overflow-hidden min-h-0">
            <GoBoard
              boardSize={boardSize}
              board={board}
              currentPlayer={currentPlayer}
              analysisData={analysisData}
              onCellClick={onBoardClick}
              lastMove={lastMove}
              hoverCoord={hoverCoord}
              onHoverChange={onBoardHover}
              variationMoves={variationMoves.length > 0 ? variationMoves : null}
            />
          </div>

          {/* Player badges - below board */}
          <MobilePlayerBadges
            blackName={blackName}
            whiteName={whiteName}
            currentPlayer={currentPlayer}
          />
        </div>

        {/* Menu sheet (Figure 2) */}
        {isMenuOpen && (
          <div className="flex-[3] flex flex-col min-h-0 overflow-hidden">
            <MobileMenuSheet
              open={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              boardSize={boardSize}
              currentPlayer={currentPlayer}
              currentMoveNumber={currentMoveNumber}
              blackName={blackName}
              whiteName={whiteName}
              komi={komi}
              rules={rules}
              displayWinrate={displayWinrate}
              onBlackNameChange={onBlackNameChange}
              onWhiteNameChange={onWhiteNameChange}
              onKomiChange={onKomiChange}
              onRulesChange={onRulesChange}
              moveTreeSlot={
                <MoveTree
                  tree={moveTree}
                  currentNodeId={currentNodeId}
                  onJumpToNode={onJumpToNode}
                  onDeleteNode={onDeleteNode}
                  onDeleteBranch={onDeleteBranch}
                />
              }
              winrateChartSlot={
                <WinrateChart
                  winrateHistory={winrateHistory}
                  currentMoveNumber={currentMoveNumber}
                  onClickMove={onSelectMoveFromWinrate}
                />
              }
              variationSlot={
                <AnalysisPanel
                  analysisData={analysisData}
                  currentWinrate={displayWinrate}
                  currentPlayer={currentPlayer}
                  isAnalyzing={isAnalyzing}
                  onSelectMove={onSelectMove}
                  selectedMove={selectedMove}
                  hideWinrateBar
                />
              }
              hawkEyeSlot={
                <HawkEyePanel
                  analysisData={analysisData}
                  currentWinrate={displayWinrate}
                  gtpMoves={gtpMoves}
                  isConnected={isConnected}
                  analysisCache={analysisCache}
                  onJumpToMove={onJumpToMove}
                />
              }
            />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <MobileBottomBar
        onNewBoard={handleNewBoard}
        onOpenMenu={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
        onSaveSgf={onSaveSgf}
        onLoadSgf={onLoadSgf}
        onImportFoxwq={onImportFoxwq}
        onCloudSave={onCloudSave}
        onCloudLoad={onCloudLoad}
        isAnalyzing={isAnalyzing}
        isAutoAnalyze={isAutoAnalyze}
        onToggleAuto={onToggleAuto}
        onGoToPrevMove={onGoToPrevMove}
        onGoToNextMove={onGoToNextMove}
      />
    </div>
  );
}
