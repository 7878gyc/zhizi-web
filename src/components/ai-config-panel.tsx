'use client';

import type { AiConfig } from '@/lib/go-types';
import { AI_CONFIGS } from '@/lib/go-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface AiConfigPanelProps {
  selectedConfig: AiConfig;
  onConfigChange: (config: AiConfig) => void;
  aiReady: boolean;
  isConnecting: boolean;
}

export default function AiConfigPanel({
  selectedConfig,
  onConfigChange,
  aiReady,
  isConnecting,
}: AiConfigPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[#8B8FA3] text-xs uppercase tracking-wider">AI 引擎配置</Label>
        <Badge
          variant={aiReady ? 'default' : 'secondary'}
          className={`text-xs ${
            aiReady
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : isConnecting
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          }`}
        >
          {aiReady ? '已就绪' : isConnecting ? '连接中...' : '未连接'}
        </Badge>
      </div>

      <Select
        value={selectedConfig.label}
        onValueChange={(val) => {
          const config = AI_CONFIGS.find((c) => c.label === val);
          if (config) onConfigChange(config);
        }}
      >
        <SelectTrigger className="bg-[#1A1A2E]/70 border-[#2A3A5C] text-white text-sm">
          <SelectValue />
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
    </div>
  );
}
