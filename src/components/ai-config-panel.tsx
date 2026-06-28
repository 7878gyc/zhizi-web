'use client';

import type { AiConfig } from '@/lib/go-types';
import { GPU_TYPES, WEIGHTS } from '@/lib/go-types';
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
  const handleGpuTypeChange = (gpuType: string) => {
    const weight = selectedConfig?.kataWeight ?? '28bnbt';
    const config: AiConfig = {
      platform: 'all',
      engineType: 'go',
      gpuType,
      kataName: 'katago-TENSORRT',
      kataWeight: weight,
      label: `${WEIGHTS.find(w => w.value === weight)?.label} ${GPU_TYPES.find(g => g.value === gpuType)?.label}`,
    };
    onSelectConfig(config);
  };

  const handleWeightChange = (kataWeight: string) => {
    const gpuType = selectedConfig?.gpuType ?? '1x';
    const config: AiConfig = {
      platform: 'all',
      engineType: 'go',
      gpuType,
      kataName: 'katago-TENSORRT',
      kataWeight,
      label: `${WEIGHTS.find(w => w.value === kataWeight)?.label} ${GPU_TYPES.find(g => g.value === gpuType)?.label}`,
    };
    onSelectConfig(config);
  };

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

      {/* GPU Type Selection */}
      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">GPU 类型</Label>
        <Select
          value={selectedConfig?.gpuType ?? '1x'}
          onValueChange={handleGpuTypeChange}
        >
          <SelectTrigger className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white text-sm">
            <SelectValue placeholder="选择 GPU" />
          </SelectTrigger>
          <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
            {GPU_TYPES.map((gpu) => (
              <SelectItem
                key={gpu.value}
                value={gpu.value}
                className="text-white focus:bg-[#2A3A5C] focus:text-white text-sm"
              >
                {gpu.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weight Selection */}
      <div className="space-y-1.5">
        <Label className="text-[#8B8FA3] text-xs">权重</Label>
        <Select
          value={selectedConfig?.kataWeight ?? '28bnbt'}
          onValueChange={handleWeightChange}
        >
          <SelectTrigger className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white text-sm">
            <SelectValue placeholder="选择权重" />
          </SelectTrigger>
          <SelectContent className="bg-[#16213E] border-[#2A3A5C]">
            {WEIGHTS.map((weight) => (
              <SelectItem
                key={weight.value}
                value={weight.value}
                className="text-white focus:bg-[#2A3A5C] focus:text-white text-sm"
              >
                {weight.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start/Stop analysis buttons */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={onStartAnalysis}
            disabled={isConnecting || !selectedConfig}
            className="flex-1 px-3 py-2 bg-[#E8B931] hover:bg-[#E8B931]/90 text-[#1A1A2E] font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? '连接中...' : '开始分析'}
          </button>
        ) : (
          <>
            <button
              onClick={onStopAnalysis}
              className="flex-1 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              停止分析
            </button>
            <button
              onClick={onToggleAutoAnalyze}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isAutoAnalyzing
                  ? 'bg-amber-500/80 hover:bg-amber-500 text-white'
                  : 'bg-[#2A3A5C] hover:bg-[#2A3A5C]/80 text-white'
              }`}
            >
              {isAutoAnalyzing ? '自动分析中' : '自动分析'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
}
