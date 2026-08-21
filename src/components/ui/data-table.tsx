'use client';

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  ArrowRightDoubleIcon,
  ArrowUp01Icon,
  Sorting01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  type ColumnDef,
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  type Row,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type * as React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * The v9 feature set backing every DataTable. Features are static per table, so
 * sorting/pagination are always registered here and toggled at runtime via the
 * `enableSorting` option and the page-size passed in `initialState`.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Column definition bound to the DataTable feature set. */
export type DataTableColumnDef<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

/** Row bound to the DataTable feature set. */
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  pageSize?: number;
  className?: string;
  showPagination?: boolean;
  tableFrameClassName?: string;
  tableClassName?: string;
  emptyMessage?: string;
  getRowProps?: (row: DataTableRow<TData>) => React.ComponentProps<'tr'>;
  enableSorting?: boolean;
  footerLeftContent?: React.ReactNode;
  compactPagination?: boolean;
  pageSizeOptions?: number[];
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageSize = 10,
  className,
  showPagination = true,
  tableFrameClassName,
  tableClassName,
  emptyMessage,
  getRowProps,
  enableSorting = true,
  footerLeftContent,
  compactPagination = false,
  pageSizeOptions = [10, 20, 30, 40, 50],
}: DataTableProps<TData>) {
  const { _ } = useLingui();
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    enableSorting,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: showPagination ? pageSize : 9999,
      },
    },
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      <div className={cn('min-h-0 flex-1 rounded-md border', tableFrameClassName)}>
        <div className="h-full overflow-y-auto">
          <Table className={tableClassName}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className="sticky top-0 z-10 bg-inherit text-left"
                        style={{
                          width: header.column.columnDef.size
                            ? `${header.column.getSize()}px`
                            : undefined,
                          maxWidth: header.column.columnDef.size
                            ? `${header.column.getSize()}px`
                            : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!enableSorting || !header.column.getCanSort()}
                            className={cn(
                              'inline-flex items-center gap-1.5 transition-colors',
                              !enableSorting || !header.column.getCanSort()
                                ? 'cursor-default'
                                : 'cursor-pointer hover:text-foreground'
                            )}
                          >
                            <FlexRender header={header} />
                            {enableSorting &&
                              header.column.getCanSort() &&
                              (header.column.getIsSorted() === 'asc' ? (
                                <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
                              ) : (
                                <HugeiconsIcon
                                  icon={Sorting01Icon}
                                  className="size-3.5 text-muted-foreground/60"
                                />
                              ))}
                          </button>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const rowProps = getRowProps?.(row);
                  const { className: rowClassName, ...restRowProps } = rowProps ?? {};
                  return (
                    <TableRow key={row.id} className={rowClassName} {...restRowProps}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="text-left"
                          style={{
                            width: cell.column.columnDef.size
                              ? `${cell.column.getSize()}px`
                              : undefined,
                            maxWidth: cell.column.columnDef.size
                              ? `${cell.column.getSize()}px`
                              : undefined,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyMessage ?? _(msg`No results.`)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {showPagination && (
        <div
          className={cn(
            'flex items-center justify-between px-2',
            compactPagination && 'min-h-7 px-1'
          )}
        >
          <div
            className={cn(
              'flex-1 text-muted-foreground text-xs',
              compactPagination && 'text-[11px]'
            )}
          >
            {footerLeftContent ?? _(msg`${table.getRowCount()} total`)}
          </div>
          <div
            className={cn(
              'flex items-center space-x-6 lg:space-x-8',
              compactPagination && 'space-x-3 lg:space-x-4'
            )}
          >
            <div className={cn('flex items-center space-x-2', compactPagination && 'space-x-1.5')}>
              <p className={cn('text-xs font-medium', compactPagination && 'text-[11px]')}>
                {_(msg`Rows per page`)}
              </p>
              <Select
                value={`${table.state.pagination.pageSize}`}
                onValueChange={(value: string) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger
                  className={cn(
                    'h-8 w-[70px]',
                    compactPagination && 'h-4 w-[62px] text-[10px] py-0'
                  )}
                >
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top" className="min-w-[60px]">
                  {pageSizeOptions.map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={cn('flex items-center space-x-2', compactPagination && 'space-x-1.5')}>
              <div
                className={cn(
                  'flex w-[100px] items-center justify-center text-xs font-medium',
                  compactPagination && 'w-auto px-1 text-[11px]'
                )}
              >
                {_(msg`Page ${table.state.pagination.pageIndex + 1} of ${table.getPageCount()}`)}
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  className={cn('hidden h-8 w-8 p-0 lg:flex', compactPagination && 'h-4 w-5')}
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">{_(msg`Go to first page`)}</span>
                  <HugeiconsIcon icon={ArrowLeftDoubleIcon} className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className={cn('h-8 w-8 p-0', compactPagination && 'h-4 w-5')}
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">{_(msg`Go to previous page`)}</span>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className={cn('h-8 w-8 p-0', compactPagination && 'h-4 w-5')}
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">{_(msg`Go to next page`)}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className={cn('hidden h-8 w-8 p-0 lg:flex', compactPagination && 'h-4 w-5')}
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">{_(msg`Go to last page`)}</span>
                  <HugeiconsIcon icon={ArrowRightDoubleIcon} className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
