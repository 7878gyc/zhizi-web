'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface WinrateChartProps {
  winrateHistory: (number | null)[];
  currentMoveNumber: number;
  onClickMove?: (moveNumber: number) => void;
  hideTitle?: boolean;
}

const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 10, right: 10, bottom: 20, left: 35 };

export default function WinrateChart({
  winrateHistory,
  currentMoveNumber,
  onClickMove,
  hideTitle,
}: WinrateChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(300);

  // Responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(Math.max(200, entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasWidth;
    const h = CHART_HEIGHT;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const plotLeft = CHART_PADDING.left;
    const plotRight = w - CHART_PADDING.right;
    const plotTop = CHART_PADDING.top;
    const plotBottom = h - CHART_PADDING.bottom;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    // Data points: index 0 is root (null winrate), skip it
    // Each subsequent index i corresponds to move number i
    const dataPoints = winrateHistory.slice(1);
    const numPoints = dataPoints.length;

    // Draw axes always
    drawAxes(ctx, plotLeft, plotRight, plotTop, plotBottom);

    // Y axis labels: 100%, 50%, 0%
    ctx.fillStyle = '#4A4A6A';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('100', plotLeft - 4, plotTop);
    ctx.fillText('50', plotLeft - 4, plotTop + plotHeight * 0.5);
    ctx.fillText('0', plotLeft - 4, plotBottom);

    if (numPoints < 1 || dataPoints.every(v => v === null)) {
      // No data yet
      ctx.fillStyle = '#4A4A6A';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('分析后显示胜率曲线', w / 2, h / 2);
      return;
    }

    const maxMoves = Math.max(numPoints + 5, 20);
    const xStep = plotWidth / maxMoves;

    // 50% reference line
    const y50 = plotTop + plotHeight * 0.5;
    ctx.strokeStyle = '#4A4A6A';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, y50);
    ctx.lineTo(plotRight, y50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute valid points for drawing
    const validPoints: { x: number; y: number; moveIdx: number }[] = [];
    for (let i = 0; i < numPoints; i++) {
      const wr = dataPoints[i];
      if (wr === null || wr === undefined) continue;
      // wr is 0-1 representing the current player's winrate
      // For black perspective display: 100% = top, 0% = bottom
      // We show black's winrate, so if wr is from black's perspective, y = top when wr=1
      const x = plotLeft + (i + 0.5) * xStep;
      const y = plotBottom - wr * plotHeight; // 1→top, 0→bottom
      validPoints.push({ x, y, moveIdx: i });
    }

    if (validPoints.length < 1) {
      ctx.fillStyle = '#4A4A6A';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('分析后显示胜率曲线', w / 2, h / 2);
      return;
    }

    // Fill area under curve
    ctx.beginPath();
    ctx.moveTo(validPoints[0].x, plotBottom);
    for (const p of validPoints) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(validPoints[validPoints.length - 1].x, plotBottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    gradient.addColorStop(0, 'rgba(74, 158, 255, 0.15)');
    gradient.addColorStop(0.5, 'rgba(74, 158, 255, 0.02)');
    gradient.addColorStop(1, 'rgba(255, 107, 107, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(validPoints[0].x, validPoints[0].y);
    for (let i = 1; i < validPoints.length; i++) {
      ctx.lineTo(validPoints[i].x, validPoints[i].y);
    }
    ctx.strokeStyle = '#E8B931';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current move indicator
    // currentMoveNumber is the number of moves played (0=root, 1=first move, etc.)
    // dataPoints index = moveNumber - 1
    if (currentMoveNumber > 0 && currentMoveNumber <= numPoints) {
      const idx = currentMoveNumber - 1;
      const wr = dataPoints[idx];
      if (wr !== null && wr !== undefined) {
        const x = plotLeft + (idx + 0.5) * xStep;
        const y = plotBottom - wr * plotHeight;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 185, 49, 0.3)';
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#E8B931';
        ctx.fill();
      }
    }
  }, [winrateHistory, currentMoveNumber, canvasWidth]);

  // Click-to-jump handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onClickMove || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const plotLeft = CHART_PADDING.left;
      const plotRight = canvasWidth - CHART_PADDING.right;
      const plotWidth = plotRight - plotLeft;

      if (x < plotLeft || x > plotRight) return;

      const dataPoints = winrateHistory.slice(1);
      const numPoints = dataPoints.length;
      if (numPoints < 1) return;

      const maxMoves = Math.max(numPoints + 5, 20);
      const xStep = plotWidth / maxMoves;

      // Calculate which move was clicked
      const clickedIdx = Math.floor((x - plotLeft) / xStep);
      if (clickedIdx < 0 || clickedIdx >= numPoints) return;

      const moveNumber = clickedIdx + 1; // 1-based
      onClickMove(moveNumber);
    },
    [onClickMove, canvasWidth, winrateHistory],
  );

  return (
    <div className="space-y-1.5">
      {!hideTitle && (
        <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">胜率曲线</span>
      )}
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: canvasWidth, height: CHART_HEIGHT, cursor: onClickMove ? 'pointer' : 'default' }}
          className="rounded-lg"
        />
      </div>
    </div>
  );
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  plotLeft: number,
  plotRight: number,
  plotTop: number,
  plotBottom: number,
) {
  ctx.strokeStyle = '#2A3A5C';
  ctx.lineWidth = 0.5;

  // Y axis
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.stroke();

  // X axis
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
}
