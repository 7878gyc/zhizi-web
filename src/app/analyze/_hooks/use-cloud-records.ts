'use client';

import { useState, useCallback } from 'react';

interface CloudRecord {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  fileKey: string;
}

export function useCloudRecords() {
  const [records, setRecords] = useState<CloudRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/records');
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRecords(data.records || []);
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRecord = useCallback(
    async (id: string, fileName: string) => {
      if (!confirm(`确认删除「${fileName}」？此操作不可撤销。`)) return;
      try {
        const resp = await fetch(`/api/records/${id}`, {
          method: 'DELETE',
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || '删除失败');
        }
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : '删除失败');
      }
    },
    [],
  );

  return {
    records,
    loading,
    error,
    importingId,
    setImportingId,
    fetchRecords,
    deleteRecord,
    setError,
  };
}
