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

  const fetchRecords = useCallback(async (token: string | null) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/records', {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    async (id: string, fileName: string, token: string | null) => {
      if (!confirm(`确认删除「${fileName}」？此操作不可撤销。`)) return;
      if (!token) return;
      try {
        const resp = await fetch(`/api/records/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
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
