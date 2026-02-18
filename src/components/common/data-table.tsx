'use client'

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  RowSelectionState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

export interface BulkAction<TData> {
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'destructive'
  action: (selectedRows: TData[]) => void
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  searchColumn?: string
  pageSize?: number
  onExport?: { excel?: () => void; pdf?: () => void; csv?: () => void }
  isLoading?: boolean
  onRowClick?: (row: TData) => void
  selectable?: boolean
  onBulkDelete?: (selectedRows: TData[]) => void
  onSelectionChange?: (selectedRows: TData[]) => void
  bulkActions?: BulkAction<TData>[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = '검색...',
  searchColumn,
  pageSize = 20,
  onExport,
  isLoading,
  onRowClick,
  selectable,
  onBulkDelete,
  onSelectionChange,
  bulkActions = [],
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile()
  const effectivePageSize = isMobile ? Math.min(pageSize, 10) : pageSize
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectColumn = useMemo<ColumnDef<TData, TValue>[]>(() => selectable
    ? [
        {
          id: 'select',
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="전체 선택"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="행 선택"
              onClick={(e) => e.stopPropagation()}
            />
          ),
          enableSorting: false,
          enableHiding: false,
        } as ColumnDef<TData, TValue>,
      ]
    : [], [selectable])

  const allColumns = useMemo(() => [...selectColumn, ...columns], [selectColumn, columns])

  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!selectable,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: effectivePageSize },
    },
  })

  // 선택 변경 콜백
  useEffect(() => {
    if (onSelectionChange) {
      const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
      onSelectionChange(selected)
    }
  }, [rowSelection, onSelectionChange, table])

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
  const hasSelection = selectedCount > 0

  // 전체 일괄 작업 목록 (삭제 포함)
  const allBulkActions: BulkAction<TData>[] = [
    ...bulkActions,
    ...(onBulkDelete
      ? [{
          label: '선택 삭제',
          icon: <Trash2 className="mr-1.5 h-4 w-4" />,
          variant: 'destructive' as const,
          action: onBulkDelete,
        }]
      : []),
  ]

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {searchColumn && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={
                (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''
              }
              onChange={(e) =>
                table.getColumn(searchColumn)?.setFilterValue(e.target.value)
              }
              className="pl-9"
            />
          </div>
        )}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {/* 일괄 작업 버튼 */}
          {hasSelection && allBulkActions.length > 0 && (
            allBulkActions.length === 1 ? (
              <Button
                variant={allBulkActions[0].variant === 'destructive' ? 'destructive' : 'secondary'}
                size="sm"
                onClick={() => allBulkActions[0].action(selectedRows)}
              >
                {allBulkActions[0].icon}
                <span className="hidden sm:inline">{allBulkActions[0].label}</span> ({selectedCount}건)
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    일괄 작업 ({selectedCount}건)
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allBulkActions.map((ba, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={() => ba.action(selectedRows)}
                      className={ba.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                    >
                      {ba.icon}
                      {ba.label} ({selectedCount}건)
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
          {/* 선택 해제 */}
          {hasSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetRowSelection()}
            >
              <XCircle className="mr-1 h-4 w-4" />
              선택 해제
            </Button>
          )}
          {onExport?.csv && (
            <Button variant="outline" size="sm" onClick={onExport.csv}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
          )}
          {onExport?.excel && (
            <Button variant="outline" size="sm" onClick={onExport.excel}>
              <Download className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
          )}
          {onExport?.pdf && (
            <Button variant="outline" size="sm" onClick={onExport.pdf}>
              <FileText className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Table with horizontal scroll on mobile */}
      <div className="relative rounded-md border">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Table className="min-w-[640px]">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap text-xs sm:text-sm">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.min(effectivePageSize, 5) }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {allColumns.map((_, j) => (
                      <TableCell key={j} className="py-2.5 sm:py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={onRowClick ? 'cursor-pointer hover:bg-muted/50 active:bg-muted/70' : ''}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-xs sm:text-sm py-2.5 sm:py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={allColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
          총 {table.getFilteredRowModel().rows.length}건
          {hasSelection && (
            <span className="ml-1 text-primary">
              ({selectedCount}건 선택)
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5 sm:gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-1.5 tabular-nums">
            {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
