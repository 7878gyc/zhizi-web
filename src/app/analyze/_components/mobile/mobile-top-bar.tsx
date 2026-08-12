'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Play, Square } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserMenu } from '../user-menu';

interface MobileTopBarProps {
  gpu: string;
  weight: string;
  gpuOptions: string[];
  weightOptions: string[];
  onGpuChange: (gpu: string) => void;
  onWeightChange: (weight: string) => void;
  userDisplayName?: string;
  onLogout?: () => void;
  isAnalyzing: boolean;
  isConnecting: boolean;
  onToggleAnalyze: () => void;
}

export function MobileTopBar({
  gpu,
  weight,
  gpuOptions,
  weightOptions,
  onGpuChange,
  onWeightChange,
  userDisplayName,
  onLogout,
  isAnalyzing,
  isConnecting,
  onToggleAnalyze,
}: MobileTopBarProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-[#0F0F23] border-b border-[#2A3A5C]/40 shrink-0 relative z-20 pointer-events-auto">
      {/* Left: user name */}
      <div className="flex items-center min-w-0">
        {userDisplayName ? (
          <UserMenu userDisplayName={userDisplayName} onLogout={onLogout ?? (() => {})} />
        ) : (
          <span className="text-xs text-[#4A4A6A]">未登录</span>
        )}
        <Link
          href="/about"
          className="ml-2 text-xs text-[#8B8FA3] hover:text-[#E8B931] transition-colors"
        >
          关于
        </Link>
      </div>

      {/* Center: GPU + Weight dropdowns */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-[11px] border-[#2A3A5C]/60 bg-[#1A1A2E] text-[#E0E0E0] hover:bg-[#16213E]"
            >
              {gpu}
              <ChevronDown className="ml-0.5 h-3 w-3 text-[#8B8FA3]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="bg-[#1A1A2E] border-[#2A3A5C]/60 min-w-[4rem]">
            {gpuOptions.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => onGpuChange(opt)}
                className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer"
              >
                {opt}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-[11px] border-[#2A3A5C]/60 bg-[#1A1A2E] text-[#E0E0E0] hover:bg-[#16213E]"
            >
              {weight}
              <ChevronDown className="ml-0.5 h-3 w-3 text-[#8B8FA3]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="bg-[#1A1A2E] border-[#2A3A5C]/60 min-w-[5rem]">
            {weightOptions.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => onWeightChange(opt)}
                className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer"
              >
                {opt}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Start/Stop button */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-6 px-2 text-[11px] rounded-full border',
          isAnalyzing
            ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
            : 'text-[#4A9EFF] border-[#4A9EFF]/30 hover:bg-[#4A9EFF]/10'
        )}
        onClick={onToggleAnalyze}
      >
        {isConnecting ? (
          <>连接中</>
        ) : isAnalyzing ? (
          <>
            <Square className="h-2.5 w-2.5 mr-0.5" />
            停止
          </>
        ) : (
          <>
            <Play className="h-2.5 w-2.5 mr-0.5" />
            开始
          </>
        )}
      </Button>
    </div>
  );
}
