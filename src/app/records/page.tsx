'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getToken, isLoggedIn } from '@/lib/auth';

interface RecordItem {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  gameInfo?: Record<string, unknown> | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    loadRecords();
  }, [router]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const resp = await fetch('/api/records', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || '加载失败');
        return;
      }
      setRecords(data.records);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError('');
    const token = getToken();

    try {
      // 1. 获取预签名上传 URL
      const presignResp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      const presignData = await presignResp.json();
      if (!presignResp.ok) {
        setError(presignData.error || '获取上传链接失败');
        return;
      }
      const { uploadUrl, fileKey } = presignData;

      // 2. 直传 R2
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/x-go-sgf' },
      });
      if (!uploadResp.ok) {
        setError('文件上传失败');
        return;
      }

      // 3. 保存数据库记录
      const saveResp = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileKey,
          fileSize: file.size,
        }),
      });
      const saveData = await saveResp.json();
      if (!saveResp.ok) {
        setError(saveData.error || '保存记录失败');
        return;
      }

      // 4. 刷新列表
      await loadRecords();
    } catch {
      setError('上传过程发生错误');
    } finally {
      setUploading(false);
    }
  }, [loadRecords]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('确认删除此棋谱？')) return;

    setDeletingId(id);
    setError('');
    const token = getToken();

    try {
      const resp = await fetch(`/api/records/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || '删除失败');
        return;
      }
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('网络错误');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.sgf')) {
        setError('仅支持 SGF 文件');
        return;
      }
      handleUpload(file);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  return (
    <div className="min-h-screen bg-[#1A1A2E] p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/analyze')}
              className="text-[#8B8FA3] hover:text-[#E0E0E0]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[#E0E0E0]">我的棋谱</h1>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-[#E8B931] hover:bg-[#D4A820] text-[#1A1A2E] font-semibold"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {uploading ? '上传中...' : '上传棋谱'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sgf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Records table */}
        <Card className="bg-[#16213E] border-[#2A3A5C]/50">
          <CardHeader className="pb-0">
            <div className="text-sm text-[#8B8FA3]">
              共 {records.length} 个棋谱
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-[#8B8FA3]">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                加载中...
              </div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-[#8B8FA3]">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                暂无棋谱，点击右上角上传
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A3A5C]/50 hover:bg-transparent">
                    <TableHead className="text-[#8B8FA3] text-xs">文件名</TableHead>
                    <TableHead className="text-[#8B8FA3] text-xs w-24">大小</TableHead>
                    <TableHead className="text-[#8B8FA3] text-xs w-40">上传时间</TableHead>
                    <TableHead className="text-[#8B8FA3] text-xs w-16 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id} className="border-[#2A3A5C]/30">
                      <TableCell className="text-[#E0E0E0] text-sm font-medium">
                        {record.fileName}
                      </TableCell>
                      <TableCell className="text-[#8B8FA3] text-xs">
                        {formatSize(record.fileSize)}
                      </TableCell>
                      <TableCell className="text-[#8B8FA3] text-xs">
                        {formatDate(record.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          disabled={deletingId === record.id}
                          className="text-[#8B8FA3] hover:text-red-400 hover:bg-red-500/10"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
