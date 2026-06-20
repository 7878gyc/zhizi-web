'use client';

import type { AiConfig } from '@/lib/go-types';
import { AI_CONFIGS } from '@/lib/go-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface AiConfigPanelProps {
  selectedConfig: AiConfig | null;
  onSelectConfig: (config: AiConfig) => void;
  isConnected: boolean;
  isConnecting: boolean;
  isAnalyzing: boolean;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  isAutoAnalyzing: boolean;
  onToggleAutoAnalyze: () => void;
  error: string | null;
}

export default function AiConfigPanel({
  selectedConfig,
  onSelectConfig,
  isConnected,
  isConnecting,
  isAnalyzing,
  onStartAnalysis,
  onStopAnalysis,
  isAutoAnalyzing,
  onToggleAutoAnalyze,
  error,
}: AiConfigPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[#8B8FA3] text-xs uppercase tracking-wider">AI 引擎配置</Label>
        <Badge
          variant={isConnected ? 'default' : 'secondary'}
          className={`text-xs ${
            isConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : isConnecting
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          }`}
        >
          {isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
        </Badge>
      </div>

      <Select
        value={selectedConfig?.label ?? ''}
        onValueChange={(val) => {
          const config = AI_CONFIGS.find((c) => c.label === val);
          if (config) onSelectConfig(config);
        }}
      >
        <SelectTrigger className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white text-sm">
          <SelectValue placeholder="选择配置" />
        </SelectTrigger>
        <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
          {AI_CONFIGS.map((config) => (
            <SelectItem
              key={config.label}
              value={config.label}
              className="text-white focus:bg-[#2A3A5C] focus:text-white text-sm"
            >
              {config.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedConfig && (
        <div className="grid grid-cols-2 gap-2 text-xs text-[#8B8FA3]">
          <div className="bg-[#1A1A2E]/50 rounded px-2 py-1.5">
            <span className="text-[#4A4A6A]">引擎</span>
            <span className="ml-1 text-[#E0E0E0]">{selectedConfig.kataName.split('-')[1]}</span>
          </div>
          <div className="bg-[#1A1A2E]/50 rounded px-2 py-1.5">
            <span className="text-[#4A4A6A]">权重</span>
            <span className="ml-1 text-[#E0E0E0]">{selectedConfig.kataWeight}</span>
          </div>
          <div className="bg-[#1A1A2E]/50 rounded px-2 py-1.5">
            <span className="text-[#4A4A6A]">GPU</span>
            <span className="ml-1 text-[#E0E0E0]">{selectedConfig.gpuType}</span>
          </div>
          <div className="bg-[#1A1A2E]/50 rounded px-2 py-1.5">
            <span className="text-[#4A4A6A]">平台</span>
            <span className="ml-1 text-[#E0E0E0]">{selectedConfig.platform}</span>
          </div>
        </div>
      )}

      {/* Start/Stop analysis buttons */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={onStartAnalysis}
            disabled={!selectedConfig || isConnecting}
            className="flex-1 px-3 py-2 text-sm font-medium rounded transition-colors
              bg-[#E8B931]/20 text-[#E8B931] border border-[#E8B931]/30
              hover:bg-[#E8B931]/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isConnecting ? '连接中...' : '开始分析'}
          </button>
        ) : (
          <>
            <button
              onClick={onStopAnalysis}
              className="flex-1 px-3 py-2 text-sm font-medium rounded transition-colors
                bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/30
                hover:bg-[#FF6B6B]/25"
            >
              停止分析
            </button>
            <button
              onClick={onToggleAutoAnalyze}
              disabled={!isConnected}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors border
                ${isAutoAnalyzing
                  ? 'bg-[#4A9EFF]/20 text-[#4A9EFF] border-[#4A9EFF]/30 hover:bg-[#4A9EFF]/30'
                  : 'bg-[#2A3A5C]/40 text-[#8B8FA3] border-[#2A3A5C] hover:bg-[#2A3A5C]/60 hover:text-[#C0C0C0]'
                }
                disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isAutoAnalyzing ? '自动中' : '自动分析'}
            </button>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
}
