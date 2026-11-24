import { useCallback, useEffect, useState } from 'react';
import {
  Edit2,
  ImageOff,
  Motorbike,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from '@/components/shared/Link';
import { bikesService } from '@/services/bikes';
import { formatPrice } from '@/lib/format';
import { getThumbnailUrl } from '@/lib/images';
import type { Bike, BikeStatus } from '@/types';

const STATUS_LABELS: Record<BikeStatus, string> = {
  BORRADOR: 'Borrador',
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
};

const statusBadgeClass = (status: BikeStatus) => {
  if (status === 'BORRADOR') return 'border-sf-border-strong bg-sf-elevated text-sf-ink-300';
  if (status === 'DISPONIBLE') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (status === 'RESERVADA') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return 'border-sf-red/40 bg-sf-red/10 text-sf-red-soft';
};

const getThumb = (bike: Bike) =>
  bike.images?.find((image) => image.isPrimary)?.url ?? bike.images?.[0]?.url;

export const Bikes = () => {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BikeStatus | 'TODOS'>('TODOS');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bikeToDelete, setBikeToDelete] = useState<Bike | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await bikesService.listAdmin({
        limit: 100,
        status: statusFilter === 'TODOS' ? undefined : statusFilter,
      });
      setBikes(response.data);
    } catch {
      setBikes([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Cambia el estado de una publicación con actualización optimista. */
  const changeStatus = async (bike: Bike, status: BikeStatus) => {
    if (status === bike.status || updatingStatusId) return;
    const previous = bike.status;
    setStatusError(null);
    setUpdatingStatusId(bike.id);
    setBikes((prev) =>
      prev.map((item) => (item.id === bike.id ? { ...item, status } : item)),
    );
    try {
      await bikesService.update(bike.id, { status });
    } catch {
      setBikes((prev) =>
        prev.map((item) => (item.id === bike.id ? { ...item, status: previous } : item)),
      );
      setStatusError('No se pudo cambiar el estado. Intentá de nuevo.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!bikeToDelete) return;
    setDeletingId(bikeToDelete.id);
    try {
      await bikesService.remove(bikeToDelete.id);
      setBikeToDelete(null);
      setLoading(true);
      void load();
    } catch {
      // El modal permanece abierto para que el usuario pueda reintentar.
    } finally {
      setDeletingId(null);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = bikes.filter((bike) => {
    if (statusFilter !== 'TODOS' && bike.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    const haystack = [bike.title, bike.model, bike.brand?.name ?? '', String(bike.year)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <div>
      <div className="mb-7 flex flex-col gap-5 border-b border-sf-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="micro-label text-sf-red">Inventario</span>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
            Motocicletas
          </h1>
          <p className="mt-2 text-sm text-sf-ink-400">
            Administración de publicaciones del catálogo.
          </p>
        </div>
        <Link to="/admin/motos/nuevo" className="btn btn-red self-start sm:self-auto">
          <Plus size={16} /> Nueva publicación
        </Link>
      </div>

      <div className="border border-sf-border bg-sf-surface">
        <div className="border-b border-sf-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sf-ink-500"
              />
              <input
                type="search"
                placeholder="Buscar por marca, modelo o título…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar publicaciones"
                className="h-11 w-full border border-sf-border-strong bg-sf-black pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-sf-ink-600 focus:border-sf-red"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setLoading(true);
                setStatusFilter(event.target.value as BikeStatus | 'TODOS');
              }}
              aria-label="Filtrar por estado"
              className="h-11 border border-sf-border-strong bg-sf-black px-4 text-sm text-white outline-none transition-colors focus:border-sf-red md:min-w-52"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="BORRADOR">Borradores</option>
              <option value="DISPONIBLE">Disponibles</option>
              <option value="RESERVADA">Reservadas</option>
              <option value="VENDIDA">Vendidas</option>
            </select>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-sf-ink-500">
            <Motorbike size={13} className="text-sf-red" />
            {filtered.length} publicación{filtered.length !== 1 ? 'es' : ''}
          </div>
          {statusError && (
            <p className="mt-2 text-xs text-sf-red-soft" role="alert">
              {statusError}
            </p>
          )}
        </div>

        <div className="divide-y divide-sf-border md:hidden">
          {loading ? (
            <p className="py-14 text-center text-sm text-sf-ink-500">
              Cargando publicaciones…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-14 text-center text-sm text-sf-ink-500">
              No se encontraron publicaciones.
            </p>
          ) : (
            filtered.map((bike) => {
              const thumb = getThumb(bike);
              return (
                <div key={bike.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden border border-sf-border bg-sf-black">
                      {thumb ? (
                        <img
                          src={getThumbnailUrl(thumb)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff size={18} className="text-sf-ink-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {bike.title}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-sf-ink-500">
                        {bike.brand?.name ?? ''} {bike.model} · {bike.year}
                      </p>
                      <select
                        value={bike.status}
                        disabled={updatingStatusId === bike.id}
                        onChange={(event) =>
                          void changeStatus(bike, event.target.value as BikeStatus)
                        }
                        aria-label={`Estado de ${bike.title}`}
                        className={`mt-2 border px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none disabled:opacity-50 ${statusBadgeClass(bike.status)}`}
                      >
                        {(Object.keys(STATUS_LABELS) as BikeStatus[]).map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-sf-border pt-3">
                    <span className="font-display text-lg text-white">
                      {formatPrice(bike.price, bike.currency)}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/motos/${bike.id}/editar`}
                        className="flex h-9 w-9 items-center justify-center border border-sf-border-strong text-sf-ink-300 transition-colors hover:border-sf-red hover:text-white"
                        title="Editar"
                        aria-label="Editar publicación"
                      >
                        <Edit2 size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setBikeToDelete(bike)}
                        className="flex h-9 w-9 items-center justify-center border border-sf-border-strong text-sf-ink-300 transition-colors hover:border-sf-red hover:bg-sf-red hover:text-white"
                        title="Eliminar"
                        aria-label="Eliminar publicación"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sf-border bg-sf-black/40 text-[10px] uppercase tracking-wider text-sf-ink-500">
                <th className="px-5 py-3.5 font-bold">Moto</th>
                <th className="px-4 py-3.5 font-bold">Año</th>
                <th className="px-4 py-3.5 font-bold">Precio</th>
                <th className="px-4 py-3.5 font-bold">Estado</th>
                <th className="px-5 py-3.5 text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sf-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-sm text-sf-ink-500">
                    Cargando publicaciones…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-sm text-sf-ink-500">
                    No se encontraron publicaciones.
                  </td>
                </tr>
              ) : (
                filtered.map((bike) => {
                  const thumb = getThumb(bike);
                  return (
                    <tr
                      key={bike.id}
                      className="transition-colors hover:bg-sf-elevated/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden border border-sf-border bg-sf-black">
                            {thumb ? (
                              <img
                                src={getThumbnailUrl(thumb)}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageOff size={16} className="text-sf-ink-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {bike.title}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-sf-ink-500">
                              {bike.brand?.name ?? ''} {bike.model}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-sf-ink-300">
                        {bike.year}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-display text-base text-white">
                          {formatPrice(bike.price, bike.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={bike.status}
                          disabled={updatingStatusId === bike.id}
                          onChange={(event) =>
                            void changeStatus(bike, event.target.value as BikeStatus)
                          }
                          aria-label={`Estado de ${bike.title}`}
                          className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none disabled:opacity-50 ${statusBadgeClass(bike.status)}`}
                        >
                          {(Object.keys(STATUS_LABELS) as BikeStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/motos/${bike.id}/editar`}
                            className="flex h-9 w-9 items-center justify-center border border-sf-border-strong text-sf-ink-300 transition-colors hover:border-sf-red hover:text-white"
                            title="Editar"
                            aria-label="Editar publicación"
                          >
                            <Edit2 size={16} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setBikeToDelete(bike)}
                            className="flex h-9 w-9 items-center justify-center border border-sf-border-strong text-sf-ink-300 transition-colors hover:border-sf-red hover:bg-sf-red hover:text-white"
                            title="Eliminar"
                            aria-label="Eliminar publicación"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {bikeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md border border-sf-border-strong bg-sf-surface shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-sf-border p-6">
              <div>
                <Motorbike size={22} className="text-sf-red" />
                <h2
                  id="delete-dialog-title"
                  className="mt-3 font-display text-xl uppercase text-white"
                >
                  Eliminar publicación
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBikeToDelete(null)}
                className="text-sf-ink-500 transition-colors hover:text-white"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-sf-ink-300">
                ¿Estás seguro de que querés eliminar{' '}
                <strong className="text-white">“{bikeToDelete.title}”</strong>? Esta
                acción no se puede deshacer.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBikeToDelete(null)}
                  className="btn border border-sf-border-strong text-sf-ink-200 hover:border-white hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingId !== null}
                  className="btn btn-red"
                >
                  {deletingId === bikeToDelete.id
                    ? 'Eliminando…'
                    : 'Eliminar publicación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
