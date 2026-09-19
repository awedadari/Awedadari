import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
  compact?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'items',
  className = '',
  compact = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  if (totalItems <= 0) {
    return null;
  }

  // Generate page numbers with ellipses
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-1 text-xs text-slate-400 ${className}`}
    >
      {/* Item range and total count */}
      <div className="flex items-center gap-2 text-[11px] font-medium">
        <span>
          Showing <strong className="text-white font-mono">{startItem}</strong>–
          <strong className="text-white font-mono">{endItem}</strong> of{' '}
          <strong className="text-white font-mono">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-750">
            <span className="text-[10px] text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-900 border border-slate-750 rounded-lg px-2 py-0.5 text-[11px] text-slate-200 focus:outline-hidden focus:border-amber-500 font-mono"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First Page */}
          {!compact && (
            <button
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage === 1}
              aria-label="First page"
              className="p-1.5 rounded-lg border border-slate-750 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            aria-label="Previous page"
            className="p-1.5 px-2.5 rounded-lg border border-slate-750 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-bold"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-slate-600 font-mono text-[10px]"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === safeCurrentPage;
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-mono font-bold transition-all ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-900 text-slate-300 border border-slate-750 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            aria-label="Next page"
            className="p-1.5 px-2.5 rounded-lg border border-slate-750 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-bold"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          {!compact && (
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Last page"
              className="p-1.5 rounded-lg border border-slate-750 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
