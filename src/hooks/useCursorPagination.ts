import { useState, useEffect, useRef, useCallback } from 'react';
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';

export interface CursorPaginationResult<TItem> {
  items: TItem[];
  lastDoc: QueryDocumentSnapshot | DocumentSnapshot | null;
  hasMore: boolean;
  totalCount?: number;
}

export interface UseCursorPaginationOptions<TItem> {
  fetchPage: (
    pageSize: number,
    lastDoc: QueryDocumentSnapshot | DocumentSnapshot | null
  ) => Promise<CursorPaginationResult<TItem>>;
  pageSize?: number;
  dependencies?: any[];
  enabled?: boolean;
}

export function useCursorPagination<TItem>({
  fetchPage,
  pageSize: initialPageSize = 10,
  dependencies = [],
  enabled = true,
}: UseCursorPaginationOptions<TItem>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [items, setItems] = useState<TItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map of page number -> lastDoc of PREVIOUS page (page 1 -> null, page 2 -> lastDoc of page 1, etc.)
  const cursorsRef = useRef<Map<number, QueryDocumentSnapshot | DocumentSnapshot | null>>(
    new Map([[1, null]])
  );
  const requestIdRef = useRef(0);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  // Reset and fetch page 1
  const resetAndFetch = useCallback(
    async (overridePageSize?: number) => {
      if (!enabled) return;
      const ps = overridePageSize || pageSize;
      setCurrentPage(1);
      cursorsRef.current = new Map([[1, null]]);

      const reqId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetchPageRef.current(ps, null);
        if (reqId !== requestIdRef.current) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        if (res.lastDoc) {
          cursorsRef.current.set(2, res.lastDoc);
        }
      } catch (err: any) {
        if (reqId !== requestIdRef.current) return;
        setError(err?.message || 'Failed to load page');
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enabled, pageSize]
  );

  // Navigate to a specific page
  const goToPage = useCallback(
    async (targetPage: number) => {
      if (!enabled || targetPage < 1 || targetPage === currentPage) return;

      const cursor = cursorsRef.current.get(targetPage) ?? null;

      // If jumping to a page beyond known history, reset to page 1
      if (targetPage > 1 && !cursorsRef.current.has(targetPage)) {
        targetPage = 1;
      }

      const reqId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetchPageRef.current(pageSize, cursor);
        if (reqId !== requestIdRef.current) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setCurrentPage(targetPage);
        if (res.lastDoc) {
          cursorsRef.current.set(targetPage + 1, res.lastDoc);
        }
      } catch (err: any) {
        if (reqId !== requestIdRef.current) return;
        setError(err?.message || 'Failed to load page');
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enabled, currentPage, pageSize]
  );

  const changePageSize = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize);
      resetAndFetch(newPageSize);
    },
    [resetAndFetch]
  );

  // Trigger reset whenever dependencies change
  useEffect(() => {
    resetAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const totalItemsEstimate = hasMore
    ? currentPage * pageSize + 1
    : Math.max(0, (currentPage - 1) * pageSize + items.length);

  return {
    items,
    currentPage,
    pageSize,
    hasMore,
    isLoading,
    error,
    goToPage,
    changePageSize,
    refresh: () => resetAndFetch(),
    totalItemsEstimate,
  };
}
