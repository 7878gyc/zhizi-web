'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { AnalysisInfo } from '@/lib/go-types';
import { coordToGTP, gtpToCoord } from '@/lib/go-types';

interface GoBoardProps {
  boardSize: number;
  board: ('black' | 'white' | null)[][];
  currentPlayer: 'black' | 'white';
  analysisData: AnalysisInfo[];
  onCellClick: (row: number, col: number) => void;
  lastMove?: { row: number; col: number } | null;
  hoverCoord?: { row: number; col: number } | null;
  onHoverChange?: (coord: { row: number; col: number } | null) => void;
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
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + (boardSize - 1) * cellSize, pos);
      ctx.stroke();
      // Vertical
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
      // Top labels
      const lx = padding + i * cellSize;
      ctx.fillText(COL_LETTERS[i], lx, padding * 0.4);
      // Left labels
      const ly = padding + i * cellSize;
      ctx.fillText(String(boardSize - i), padding * 0.35, ly);
    }

    // Analysis move suggestions (draw before stones so they appear under)
    if (analysisData.length > 0) {
      for (const info of analysisData.slice(0, 10)) {
        try {
          const { row, col } = gtpToCoord(info.move, boardSize);
          if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) continue;
          if (board[row][col] !== null) continue;
          const { x, y } = getCellPos(row, col);
          const alpha = Math.max(0.15, Math.min(0.8, info.prior * 5));

          // Blue or red based on winrate
          if (info.winrate > 0.5) {
            ctx.fillStyle = `rgba(74, 158, 255, ${alpha})`;
          } else {
            ctx.fillStyle = `rgba(255, 107, 107, ${alpha})`;
          }
          ctx.beginPath();
          ctx.arc(x, y, stoneRadius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          // Winrate text on top suggestions
          if (info.order !== undefined && info.order < 3) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = `bold ${Math.max(9, stoneRadius * 0.55)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(info.winrate * 100)}%`, x, y);
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
  }, [boardSize, board, analysisData, lastMove, hoverCoord, currentPlayer, canvasSize, getCellPos, cellSize, padding, stoneRadius]);

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
