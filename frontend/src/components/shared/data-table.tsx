'use client';

import {
  type ColumnDef,
  columnVisibilityFeature,
  createColumnHelper,
  metaHelper,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

/** Meta kolom DataTable (tipe dibatasi ke tabel ini lewat `metaHelper`, bukan global). */
export interface DataTableColumnMeta {
  /** Nama kolom di menu "Kolom" (default: id kolom). */
  label?: string;
  /** Class tambahan untuk sel header & body (mis. `text-right`, lebar). */
  className?: string;
  /** Class tambahan khusus sel body (mis. `font-mono`). */
  cellClassName?: string;
}

/**
 * Fitur TanStack Table v9 yang dipakai DataTable: sorting & paginasi (diproses server — tanpa
 * row model client) dan visibilitas kolom. Didefinisikan sekali di module scope (harus stabil).
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Helper kolom bertipe untuk DataTable: `const col = createDataTableColumnHelper<Karyawan>()`. */
export const createDataTableColumnHelper = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>();

/**
 * Tipe hasil `helper.columns([...])`. `any` mengikuti signature resmi TanStack Table v9
 * (`columnHelper.columns`): tiap kolom punya tipe nilai sel berbeda yang sudah dicek saat definisi.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCellValue = any;
export type DataTableColumns<TData extends RowData> = Array<
  ColumnDef<DataTableFeatures, TData, AnyCellValue>
>;

const SEARCH_DEBOUNCE_MS = 400;

export interface DataTableSearch {
  /** Nilai pencarian yang sudah diterapkan (mis. dari URL / state query). */
  value: string;
  /** Dipanggil setelah pengguna berhenti mengetik 400 ms. */
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumns<TData>;
  data: TData[];
  /** Total baris di server (`meta.total`). */
  rowCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  search?: DataTableSearch;
  /** Slot filter tambahan (select status, rentang tanggal, dll.). */
  filters?: ReactNode;
  /** Aksi di kanan toolbar (mis. tombol export). */
  actions?: ReactNode;
  /** Pemuatan pertama → skeleton. */
  isLoading?: boolean;
  /** Pemuatan ulang di latar (data lama tetap tampil, sedikit diredupkan). */
  isFetching?: boolean;
  /** Pesan error → ErrorState dengan tombol coba lagi. */
  error?: string | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  getRowId?: (row: TData) => string;
  initialColumnVisibility?: ColumnVisibilityState;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Tabel data generik (TanStack Table) dengan sorting & paginasi **server-side**: komponen hanya
 * menampilkan `data` halaman ini dan melaporkan perubahan state; pemanggil yang mengambil data.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  rowCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  search,
  filters,
  actions,
  isLoading,
  isFetching,
  error,
  onRetry,
  emptyState,
  getRowId,
  initialColumnVisibility,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: DataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    initialColumnVisibility ?? {},
  );

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    rowCount,
    state: { pagination, sorting, columnVisibility },
    onPaginationChange,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    sortDescFirst: false,
  });

  const pageCount = table.getPageCount();
  const firstRow = rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min(rowCount, (pagination.pageIndex + 1) * pagination.pageSize);
  const visibleColumns = table.getVisibleLeafColumns().length;
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  return (
    <div className={cn('space-y-3', className)}>
      {search || filters || actions || hideableColumns.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {search ? (
              <SearchInput
                search={search}
                onSearched={() => onPaginationChange((state) => ({ ...state, pageIndex: 0 }))}
              />
            ) : null}
            {filters}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {hideableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-h-10">
                    <Settings2Icon aria-hidden="true" />
                    Kolom
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Tampilkan kolom</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hideableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => column.toggleVisibility(checked)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {column.columnDef.meta?.label ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table aria-busy={isLoading || isFetching}>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn('h-11', meta?.className)}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUpIcon className="size-3.5" aria-hidden="true" />
                          ) : sorted === 'desc' ? (
                            <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(isFetching && !isLoading && 'opacity-60 transition-opacity')}>
            {isLoading ? (
              Array.from({ length: Math.min(pagination.pageSize, 8) }, (_, index) => (
                <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                  {Array.from({ length: visibleColumns }, (__, cell) => (
                    <TableCell key={cell} className="h-12">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns}>
                  <ErrorState message={error} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns}>
                  {emptyState ?? (
                    <EmptyState
                      title={search?.value ? 'Tidak ada hasil' : 'Belum ada data'}
                      description={
                        search?.value
                          ? `Tidak ada data yang cocok dengan "${search.value}".`
                          : undefined
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'h-12',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.cellClassName,
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col-reverse gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground" aria-live="polite">
          {isLoading ? 'Memuat…' : `Menampilkan ${firstRow}–${lastRow} dari ${rowCount} data`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground sm:inline">Baris per halaman</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(size) => onPaginationChange({ pageIndex: 0, pageSize: Number(size) })}
            >
              <SelectTrigger className="h-10 w-20" aria-label="Baris per halaman">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            Hal {pageCount === 0 ? 0 : pagination.pageIndex + 1} / {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <PageButton
              label="Halaman pertama"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              <ChevronsLeftIcon aria-hidden="true" />
            </PageButton>
            <PageButton
              label="Halaman sebelumnya"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </PageButton>
            <PageButton
              label="Halaman berikutnya"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRightIcon aria-hidden="true" />
            </PageButton>
            <PageButton
              label="Halaman terakhir"
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              <ChevronsRightIcon aria-hidden="true" />
            </PageButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-10"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Input pencarian dengan debounce 400 ms; halaman kembali ke 1 setiap kata kunci berubah. */
function SearchInput({ search, onSearched }: { search: DataTableSearch; onSearched: () => void }) {
  const [text, setText] = useState(search.value);
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const latest = useRef({ search, onSearched });

  useEffect(() => {
    latest.current = { search, onSearched };
  });

  // Nilai dari luar berubah (mis. reset filter) → sinkronkan input saat render
  // (pola "adjust state on prop change", tanpa effect).
  const [syncedValue, setSyncedValue] = useState(search.value);
  if (search.value !== syncedValue) {
    setSyncedValue(search.value);
    if (text.trim() !== search.value) setText(search.value);
  }

  useEffect(() => {
    const { search: current, onSearched: resetPage } = latest.current;
    if (debounced === current.value) return;
    current.onChange(debounced);
    resetPage();
  }, [debounced]);

  return (
    <div className="relative w-full sm:w-72">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={search.placeholder ?? 'Cari…'}
        aria-label={search.placeholder ?? 'Cari'}
        className="h-10 pr-9 pl-9"
      />
      {text ? (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label="Hapus pencarian"
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
