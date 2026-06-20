'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface WinrateChartProps {
  winrateHistory: (number | null)[];
  currentMoveNumber: number;
}

const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 10, right: 10, bottom: 20, left: 35 };

export default function WinrateChart({
  winrateHistory,
  currentMoveNumber,
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

    // Data points (skip index 0 which is root with null winrate)
    const dataPoints = winrateHistory.slice(1); // skip root
    const numPoints = dataPoints.length;

    if (numPoints < 2) {
      // No data yet
      ctx.fillStyle = '#4A4A6A';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('分析后显示胜率曲线', w / 2, h / 2);

      // Still draw axes
      drawAxes(ctx, plotLeft, plotRight, plotTop, plotBottom, numPoints);
      return;
    }

    const maxMoves = Math.max(numPoints, 20);
    const xStep = plotWidth / maxMoves;

    // Draw axes
    drawAxes(ctx, plotLeft, plotRight, plotTop, plotBottom, maxMoves);

    // 50% reference line
    const y50 = plotBottom - plotHeight * 0.5;
    ctx.strokeStyle = '#4A4A6A';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, y50);
    ctx.lineTo(plotRight, y50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill area under curve
    ctx.beginPath();
    let firstValid = true;
    for (let i = 0; i < numPoints; i++) {
      const wr = dataPoints[i];
      if (wr === null) continue;
      const x = plotLeft + (i + 0.5) * xStep;
      const y = plotBottom - wr * plotHeight;
      if (firstValid) {
        ctx.moveTo(x, plotBottom);
        ctx.lineTo(x, y);
        firstValid = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    // Close the area
    if (!firstValid) {
      const lastValidX = plotLeft + (numPoints - 0.5) * xStep;
      ctx.lineTo(lastValidX, plotBottom);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
      gradient.addColorStop(0, 'rgba(74, 158, 255, 0.15)');
      gradient.addColorStop(0.5, 'rgba(74, 158, 255, 0.02)');
      gradient.addColorStop(1, 'rgba(255, 107, 107, 0.15)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw line
    ctx.beginPath();
    firstValid = true;
    for (let i = 0; i < numPoints; i++) {
      const wr = dataPoints[i];
      if (wr === null) continue;
      const x = plotLeft + (i + 0.5) * xStep;
      const y = plotBottom - wr * plotHeight;
      if (firstValid) {
        ctx.moveTo(x, y);
        firstValid = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = '#E8B931';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current move indicator
    if (currentMoveNumber > 0 && currentMoveNumber <= numPoints) {
      const idx = currentMoveNumber - 1;
      const wr = dataPoints[idx];
      if (wr !== null) {
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

  return (
    <div className="space-y-1.5">
      <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">胜率曲线</span>
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          style={{ width: canvasWidth, height: CHART_HEIGHT }}
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
  _maxMoves: number
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

  // Y labels: 0%, 50%, 100%
  ctx.fillStyle = '#4A4A6A';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('100%', plotLeft - 4, plotTop);
  ctx.fillText('50%', plotLeft - 4, plotTop + (plotBottom - plotTop) * 0.5);
  ctx.fillText('0%', plotLeft - 4, plotBottom);
}
