'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { MoveNode } from '@/lib/go-types';

interface MoveTreeProps {
  tree: MoveNode;
  currentNodeId: string;
  onJumpToNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteBranch: (nodeId: string) => void;
}

interface LayoutNode {
  node: MoveNode;
  x: number;
  y: number;
  branchIndex: number;  // which branch this node belongs to at its fork point
}

interface ContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

const NODE_RADIUS = 14;
const H_GAP = 40;     // horizontal gap between nodes
const V_GAP = 36;     // vertical gap between branches
const PADDING = 20;

export default function MoveTree({
  tree,
  currentNodeId,
  onJumpToNode,
  onDeleteNode,
  onDeleteBranch,
}: MoveTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 200, height: 60 });

  // Calculate layout
  useEffect(() => {
    const nodes: LayoutNode[] = [];
    let maxX = 0;
    let maxY = 0;

    const layoutBranch = (
      node: MoveNode,
      startX: number,
      y: number,
      branchIdx: number
    ) => {
      const x = startX;
      nodes.push({ node, x, y, branchIndex: branchIdx });
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (node.children.length === 0) return;

      // Main branch continues on the same row
      layoutBranch(node.children[0], x + H_GAP, y, 0);

      // Other branches go below
      for (let i = 1; i < node.children.length; i++) {
        const branchY = maxY + V_GAP + NODE_RADIUS;
        layoutBranch(node.children[i], x + H_GAP, branchY, i);
      }
    };

    layoutBranch(tree, PADDING + NODE_RADIUS, PADDING + NODE_RADIUS, 0);

    setLayoutNodes(nodes);
    setSvgSize({
      width: maxX + NODE_RADIUS + PADDING,
      height: maxY + NODE_RADIUS + PADDING,
    });
  }, [tree]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (nodeId === 'root') return; // Cannot delete root
      setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
    },
    []
  );

  // Scroll to current node
  useEffect(() => {
    const currentLayout = layoutNodes.find(n => n.node.id === currentNodeId);
    if (currentLayout && containerRef.current) {
      const container = containerRef.current;
      const scrollLeft = currentLayout.x - container.clientWidth / 2;
      if (scrollLeft > 0) {
        container.scrollLeft = scrollLeft;
      }
    }
  }, [currentNodeId, layoutNodes]);

  if (layoutNodes.length <= 1) {
    return (
      <div className="space-y-1.5">
        <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">落子树</span>
        <div className="bg-[#1A1A2E]/50 rounded-lg px-3 py-4 text-center text-[#4A4A6A] text-xs">
          尚无落子
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[#8B8FA3] text-xs uppercase tracking-wider">落子树</span>
      <div
        ref={containerRef}
        className="bg-[#1A1A2E]/50 rounded-lg overflow-auto max-h-[160px] scrollbar-thin"
        style={{ scrollbarWidth: 'thin' }}
      >
        <svg
          width={svgSize.width}
          height={svgSize.height}
          className="block"
        >
          {/* Draw connections first */}
          {layoutNodes.map((layout) =>
            layout.node.children.map((child) => {
              const childLayout = layoutNodes.find(n => n.node.id === child.id);
              if (!childLayout) return null;

              const isMainBranch = childLayout.branchIndex === 0;
              return (
                <line
                  key={`${layout.node.id}-${child.id}`}
                  x1={layout.x}
                  y1={layout.y}
                  x2={childLayout.x}
                  y2={childLayout.y}
                  stroke={isMainBranch ? '#4A4A6A' : '#2A3A5C'}
                  strokeWidth={isMainBranch ? 1.5 : 1}
                  strokeDasharray={isMainBranch ? 'none' : '4,3'}
                />
              );
            })
          )}

          {/* Draw nodes */}
          {layoutNodes.map((layout) => {
            const isRoot = layout.node.id === 'root';
            const isCurrent = layout.node.id === currentNodeId;
            const isBlack = layout.node.color === 'black';
            const isWhite = layout.node.color === 'white';

            // Node fill
            let fill = '#2A3A5C';
            let stroke = 'none';
            let textFill = '#8B8FA3';

            if (isRoot) {
              fill = 'none';
              stroke = '#4A4A6A';
              textFill = '#4A4A6A';
            } else if (isBlack) {
              fill = '#1A1A1A';
              textFill = '#E0E0E0';
            } else if (isWhite) {
              fill = '#F0F0F0';
              stroke = '#8B8FA3';
              textFill = '#1A1A1A';
            }

            const currentStroke = isCurrent ? '#E8B931' : stroke;
            const currentStrokeWidth = isCurrent ? 2.5 : (stroke !== 'none' ? 1 : 0);

            return (
              <g
                key={layout.node.id}
                onClick={() => onJumpToNode(layout.node.id)}
                onContextMenu={(e) => handleContextMenu(e, layout.node.id)}
                className="cursor-pointer"
              >
                {/* Current node glow */}
                {isCurrent && (
                  <circle
                    cx={layout.x}
                    cy={layout.y}
                    r={NODE_RADIUS + 3}
                    fill="none"
                    stroke="#E8B931"
                    strokeWidth={1}
                    opacity={0.4}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.2;0.5;0.2"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={layout.x}
                  cy={layout.y}
                  r={NODE_RADIUS}
                  fill={fill}
                  stroke={currentStroke}
                  strokeWidth={currentStrokeWidth}
                />
                <text
                  x={layout.x}
                  y={layout.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={textFill}
                  fontSize={isRoot ? 10 : 11}
                  fontWeight="bold"
                  fontFamily="ui-monospace, monospace"
                >
                  {isRoot ? '0' : layout.node.moveNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#16213E] border border-[#2A3A5C] rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-[#E0E0E0] hover:bg-[#2A3A5C] transition-colors"
            onClick={() => {
              onDeleteNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            删除此手
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[#2A3A5C] transition-colors"
            onClick={() => {
              onDeleteBranch(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            删除此分支
          </button>
        </div>
      )}
    </div>
  );
}
