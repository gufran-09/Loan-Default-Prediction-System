'use client'

import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  itemName?: string
  compact?: boolean
  showPageSize?: boolean
  showJumpToPage?: boolean
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemName = 'items',
  compact = false,
  showPageSize = true,
  showJumpToPage = true,
  className,
}: PaginationProps) {
  const [jumpInput, setJumpInput] = useState('')

  if (totalPages <= 0) return null

  // Ensure current page is within bounds
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== activePage) {
      onPageChange(page)
    }
  }

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  // Calculate start and end item numbers
  const startItem = totalItems !== undefined ? (totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1) : null
  const endItem = totalItems !== undefined ? Math.min(activePage * pageSize, totalItems) : null

  // Generate pagination buttons array
  const getPageNumbers = (): (number | 'ellipsis-start' | 'ellipsis-end')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages]
    }

    if (activePage >= totalPages - 3) {
      return [
        1,
        'ellipsis-start',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ]
    }

    return [
      1,
      'ellipsis-start',
      activePage - 1,
      activePage,
      activePage + 1,
      'ellipsis-end',
      totalPages,
    ]
  }

  const pageNumbers = getPageNumbers()

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 text-xs text-muted-foreground',
          className
        )}
      >
        <div>
          {totalItems !== undefined ? (
            <span>
              Showing <strong className="font-semibold text-foreground">{startItem}–{endItem}</strong> of{' '}
              <strong className="font-semibold text-foreground">{totalItems}</strong> {itemName}
            </span>
          ) : (
            <span>
              Page <strong className="font-semibold text-foreground">{activePage}</strong> of{' '}
              <strong className="font-semibold text-foreground">{totalPages}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => handlePageChange(activePage - 1)}
            aria-label="Previous page"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="px-2 font-mono text-[11px] font-medium text-foreground">
            {activePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => handlePageChange(activePage + 1)}
            aria-label="Next page"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={cn(
        'flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground',
        className
      )}
    >
      {/* Left side: Item count & Page size selector */}
      <div className="flex flex-wrap items-center gap-3">
        {totalItems !== undefined && (
          <div>
            Showing <span className="font-medium text-foreground">{startItem}</span> to{' '}
            <span className="font-medium text-foreground">{endItem}</span> of{' '}
            <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> {itemName}
          </div>
        )}

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <label htmlFor="pageSizeSelect" className="text-muted-foreground whitespace-nowrap">
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/50 focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
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

      {/* Right side: Page navigation buttons & Jump input */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {/* First page button */}
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => handlePageChange(1)}
            aria-label="First page"
            title="First page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsLeft className="size-4" />
          </button>

          {/* Previous page button */}
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => handlePageChange(activePage - 1)}
            aria-label="Previous page"
            title="Previous page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) => {
              if (p === 'ellipsis-start' || p === 'ellipsis-end') {
                return (
                  <span
                    key={`${p}-${idx}`}
                    className="flex size-8 items-center justify-center text-muted-foreground"
                    aria-hidden="true"
                  >
                    <MoreHorizontal className="size-4" />
                  </span>
                )
              }

              const isCurrent = p === activePage
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
                    isCurrent
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'border border-border bg-card text-foreground hover:bg-muted'
                  )}
                >
                  {p}
                </button>
              )
            })}
          </div>

          {/* Next page button */}
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => handlePageChange(activePage + 1)}
            aria-label="Next page"
            title="Next page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>

          {/* Last page button */}
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => handlePageChange(totalPages)}
            aria-label="Last page"
            title="Last page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>

        {/* Optional quick jump to page */}
        {showJumpToPage && totalPages > 5 && (
          <form onSubmit={handleJump} className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-border">
            <span className="text-muted-foreground">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(activePage)}
              className="h-8 w-14 rounded-md border border-border bg-card px-2 text-center text-xs font-mono text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!jumpInput}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
