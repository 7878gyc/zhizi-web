'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';
import { gtpToCoord } from '@/lib/go-types';

interface VariationMove {
  row: number;
  col: number;
  color: 'black' | 'white';
  moveNumber: number;
}

interface GoBoardProps {
  boardSize: number;
  board: ('black' | 'white' | null)[][];
  currentPlayer: 'black' | 'white';
  analysisData: AnalysisInfo[];
  onCellClick: (row: number, col: number) => void;
  lastMove?: { row: number; col: number } | null;
  hoverCoord?: { row: number; col: number } | null;
  onHoverChange?: (coord: { row: number; col: number } | null) => void;
  variationMoves?: VariationMove[] | null;
}

const BOARD_COLOR = '#DCB35C';
const LINE_COLOR = '#5C4A1E';
const STAR_POINTS_19 = [
  [3,3],[3,9],[3,15],
  [9,3],[9,9],[9,15],
  [15,3],[15,9],[15,15],
];
const STAR_POINTS_13 = [[3,3],[3,9],[9,3],[9,9],[6,6]];
const STAR_POINTS_9 = [[2,2],[2,6],[6,2],[6,6],[4,4]];

function getStarPoints(size: number): number[][] {
  if (size === 19) return STAR_POINTS_19;
  if (size === 13) return STAR_POINTS_13;
  if (size === 9) return STAR_POINTS_9;
  return [];
}

export default function GoBoard({
  boardSize,
  board,
  currentPlayer,
  analysisData,
  onCellClick,
  lastMove,
  hoverCoord,
  onHoverChange,
  variationMoves,
}: GoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(600);

  // Calculate layout metrics
  const padding = canvasSize * 0.05;
  const boardPixelSize = canvasSize - padding * 2;
  const cellSize = boardPixelSize / (boardSize - 1);
  const stoneRadius = cellSize * 0.46;

  const getCellPos = useCallback(
    (row: number, col: number) => ({
      x: padding + col * cellSize,
      y: padding + row * cellSize,
    }),
    [padding, cellSize]
  );

  // Responsive resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setCanvasSize(Math.min(w, 700));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw the board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Board background
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Subtle wood grain
    ctx.save();
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = Math.random() * 2 + 0.5;
      ctx.beginPath();
      const y = Math.random() * canvasSize;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        canvasSize * 0.3, y + (Math.random() - 0.5) * 20,
        canvasSize * 0.7, y + (Math.random() - 0.5) * 20,
        canvasSize, y
      );
      ctx.stroke();
    }
    ctx.restore();

    // Grid lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + (boardSize - 1) * cellSize, pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + (boardSize - 1) * cellSize);
      ctx.stroke();
    }

    // Star points
    const starPoints = getStarPoints(boardSize);
    ctx.fillStyle = LINE_COLOR;
    for (const [r, c] of starPoints) {
      const { x, y } = getCellPos(r, c);
      ctx.beginPath();
      ctx.arc(x, y, cellSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coordinate labels
    ctx.fillStyle = '#8B6914';
    ctx.font = `${Math.max(9, cellSize * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';
    for (let i = 0; i < boardSize; i++) {
      const lx = padding + i * cellSize;
      ctx.fillText(COL_LETTERS[i], lx, padding * 0.4);
      const ly = padding + i * cellSize;
      ctx.fillText(String(boardSize - i), padding * 0.35, ly);
    }

    // LizzieYZY-style: visit-based red→green gradient, best=cyan
    if (analysisData.length > 0) {
      const topMoves = analysisData.slice(0, 10);
      const maxVisits = topMoves.reduce((mx, m) => Math.max(mx, m.visits), 0) || 1;
      const MIN_ALPHA = 0.125;
      const MAX_ALPHA = 0.94;
      const ALPHA_FACTOR = 5.0;
      const COLOR_RATIO = 2;

      for (const info of topMoves) {
        try {
          const { row, col } = gtpToCoord(info.move, boardSize);
          if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) continue;
          if (board[row][col] !== null) continue;
          const { x, y } = getCellPos(row, col);

          const fraction = info.visits / maxVisits;
          const warped = Math.pow(fraction, 1 / COLOR_RATIO);

          // Hue: best move = cyan (180deg), others red→green (0→120deg)
          const hue = info.order === 0 ? 180 : (warped * 120);
          const sat = 74;
          const lit = 42.5;

          // Logarithmic alpha from visits ratio
          const logRatio = fraction > 0 ? Math.log(fraction) / ALPHA_FACTOR + 1 : 0;
          const alphaRatio = Math.max(0, Math.min(1, logRatio));
          const alpha = MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * alphaRatio;

          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
          ctx.fill();

          // Border
          ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${Math.min(1, alpha + 0.1)})`;
          ctx.lineWidth = info.order === 0 ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Blue ring for best move
          if (info.order === 0) {
            ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, stoneRadius + 3, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Winrate text
          const winrateText = `${(info.winrate * 100).toFixed(1)}%`;
          const scoreText = info.scoreMean !== undefined
            ? `${info.scoreMean > 0 ? '+' : ''}${info.scoreMean.toFixed(1)}`
            : '';

          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const fontSize = Math.max(7, stoneRadius * 0.4);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(winrateText, x, y - fontSize * 0.4);

          if (scoreText) {
            ctx.font = `${fontSize * 0.85}px sans-serif`;
            ctx.fillText(scoreText, x, y + fontSize * 0.5);
          }
        } catch {
          // Skip invalid coordinates
        }
      }
    }

    // Draw stones
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const stone = board[r][c];
        if (!stone) continue;
        const { x, y } = getCellPos(r, c);

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = stoneRadius * 0.3;
        ctx.shadowOffsetX = stoneRadius * 0.1;
        ctx.shadowOffsetY = stoneRadius * 0.1;

        // Stone gradient
        const gradient = ctx.createRadialGradient(
          x - stoneRadius * 0.25,
          y - stoneRadius * 0.25,
          stoneRadius * 0.1,
          x,
          y,
          stoneRadius
        );

        if (stone === 'black') {
          gradient.addColorStop(0, '#4A4A4A');
          gradient.addColorStop(0.5, '#2A2A2A');
          gradient.addColorStop(1, '#1A1A1A');
        } else {
          gradient.addColorStop(0, '#FFFFFF');
          gradient.addColorStop(0.5, '#F0F0F0');
          gradient.addColorStop(1, '#D8D8D8');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Light reflection
        ctx.save();
        ctx.globalAlpha = stone === 'black' ? 0.2 : 0.4;
        const reflGradient = ctx.createRadialGradient(
          x - stoneRadius * 0.3,
          y - stoneRadius * 0.3,
          0,
          x - stoneRadius * 0.3,
          y - stoneRadius * 0.3,
          stoneRadius * 0.6
        );
        reflGradient.addColorStop(0, '#FFFFFF');
        reflGradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = reflGradient;
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Variation moves overlay (not loaded into move tree)
    if (variationMoves && variationMoves.length > 0) {
      for (const vm of variationMoves) {
        const { x, y } = getCellPos(vm.row, vm.col);

        // Semi-transparent stone
        ctx.save();
        ctx.globalAlpha = 0.65;
        if (vm.color === 'black') {
          ctx.fillStyle = '#1A1A1A';
        } else {
          ctx.fillStyle = '#F0F0F0';
        }
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Dashed border to distinguish from real stones
        ctx.strokeStyle = vm.color === 'black' ? '#E8B931' : '#4A9EFF';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Move number
        ctx.fillStyle = vm.color === 'black' ? '#FFFFFF' : '#1A1A1A';
        ctx.font = `bold ${Math.max(9, stoneRadius * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(vm.moveNumber), x, y);
      }
    }

    // Last move marker
    if (lastMove) {
      const { x, y } = getCellPos(lastMove.row, lastMove.col);
      const stone = board[lastMove.row][lastMove.col];
      ctx.strokeStyle = stone === 'black' ? '#FFFFFF' : '#1A1A1A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, stoneRadius * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hover indicator
    if (hoverCoord) {
      const { row, col } = hoverCoord;
      if (row >= 0 && row < boardSize && col >= 0 && col < boardSize && !board[row][col]) {
        const { x, y } = getCellPos(row, col);
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = currentPlayer === 'black' ? '#1A1A1A' : '#F0F0F0';
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [boardSize, board, analysisData, lastMove, hoverCoord, currentPlayer, canvasSize, getCellPos, cellSize, padding, stoneRadius, variationMoves]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasSize / rect.width;
      const scaleY = canvasSize / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const col = Math.round((mx - padding) / cellSize);
      const row = Math.round((my - padding) / cellSize);

      if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
        onCellClick(row, col);
      }
    },
    [canvasSize, padding, cellSize, boardSize, onCellClick]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onHoverChange) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasSize / rect.width;
      const scaleY = canvasSize / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const col = Math.round((mx - padding) / cellSize);
      const row = Math.round((my - padding) / cellSize);

      if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
        onHoverChange({ row, col });
      } else {
        onHoverChange(null);
      }
    },
    [canvasSize, padding, cellSize, boardSize, onHoverChange]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  return (
    <div ref={containerRef} className="w-full max-w-[700px] aspect-square">
      <canvas
        ref={canvasRef}
        style={{ width: canvasSize, height: canvasSize }}
        className="rounded-lg shadow-2xl cursor-pointer"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
      />
    </div>
  );
}
