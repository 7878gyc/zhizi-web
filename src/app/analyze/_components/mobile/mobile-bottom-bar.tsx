'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, FolderOpen, Ellipsis, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomBarProps {
  onNewBoard: () => void;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
  onSaveSgf: () => void;
  onLoadSgf: () => void;
  onImportFoxwq: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;
  isAnalyzing: boolean;
  isAutoAnalyze: boolean;
  onToggleAuto: () => void;
  onGoToPrevMove: () => void;
  onGoToNextMove: () => void;
}

export function MobileBottomBar({
  onNewBoard,
  onOpenMenu,
  isMenuOpen,
  onSaveSgf,
  onLoadSgf,
  onImportFoxwq,
  onCloudSave,
  onCloudLoad,
  isAnalyzing,
  isAutoAnalyze,
  onToggleAuto,
  onGoToPrevMove,
  onGoToNextMove,
}: MobileBottomBarProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-[#0F0F23] border-t border-[#2A3A5C]/40 shrink-0">
      {/* Left group: + / folder / ... / auto */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-[#8B8FA3] hover:text-[#E0E0E0] hover:bg-[#1A1A2E]"
          onClick={onNewBoard}
          title="新建棋盘"
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0 hover:bg-[#1A1A2E]',
            isMenuOpen ? 'text-[#E8B931]' : 'text-[#8B8FA3] hover:text-[#E0E0E0]'
          )}
          onClick={onOpenMenu}
          title="打开菜单"
        >
          <FolderOpen className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#8B8FA3] hover:text-[#E0E0E0] hover:bg-[#1A1A2E]"
              title="更多"
            >
              <Ellipsis className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-[#1A1A2E] border-[#2A3A5C]/60 min-w-[8rem]">
            <DropdownMenuItem onClick={onSaveSgf} className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer">
              保存 SGF 到本地
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoadSgf} className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer">
              从本地导入 SGF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImportFoxwq} className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer">
              从野狐导入
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCloudSave} className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer">
              保存到云端
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCloudLoad} className="text-xs text-[#E0E0E0] hover:bg-[#16213E] cursor-pointer">
              从云端打开
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {isAnalyzing && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 text-[11px] rounded-full',
              isAutoAnalyze
                ? 'text-[#E8B931] bg-[#E8B931]/10 border border-[#E8B931]/30'
                : 'text-[#8B8FA3] hover:text-[#E0E0E0]'
            )}
            onClick={onToggleAuto}
          >
            <FastForward className="h-3.5 w-3.5 mr-0.5" />
            自动
          </Button>
        )}
      </div>

      {/* Right group: prev / next */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-[#8B8FA3] hover:text-[#E0E0E0] hover:bg-[#1A1A2E]"
          onClick={onGoToPrevMove}
          title="上一步"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-[#8B8FA3] hover:text-[#E0E0E0] hover:bg-[#1A1A2E]"
          onClick={onGoToNextMove}
          title="下一步"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
