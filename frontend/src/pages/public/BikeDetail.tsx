import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  Phone,
  Share2,
  Heart,
  Fuel,
  Gauge,
  Calendar,
  Tag,
  MessageCircle,
  Clock,
  Timer,
  Route,
  Bike as BikeIcon,
} from 'lucide-react';
import { Link } from '@/components/shared/Link';
import { BikeCard } from '@/components/public/BikeCard';
import { ConditionTag, FeaturedTag, StatusTag } from '@/components/public/BikeBadges';
import { SectionHeading } from '@/components/public/SectionHeading';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useFavoritesStore } from '@/stores/favorites';
import { bikesService } from '@/services/bikes';
import { getThumbnailUrl } from '@/lib/images';
import type { Bike } from '@/types';
import { buildBikeWhatsAppLink, BUSINESS } from '@/lib/constants';
import {
  featureLabel,
  formatDisplacement,
  formatMileage,
  formatPrice,
  formatUsageHours,
  usageLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export const BikeDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [bike, setBike] = useState<Bike | null>(null);
  const [related, setRelated] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const bikeId = bike?.id ?? slug ?? '';
  const isFavorite = useFavoritesStore((state) => state.isFavorite(bikeId));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);

  const loadBike = useCallback(async () => {
    if (!slug) return;
    // eslint-disable-next-line react/set-state-in-effect -- reinicio del estado antes de cada carga
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const data = await bikesService.getBySlug(slug);
      bikesService.trackVisit(data.id).catch(() => {});
      setBike(data);
      setActiveImage(0);

      try {
        const all = await bikesService.list({ limit: 8 });
        const relatedList = Array.isArray(all.data) ? all.data : [];
        setRelated(relatedList.filter((item) => item.id !== data.id).slice(0, 4));
      } catch {
        setRelated([]);
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setBike(null);
      setRelated([]);
      if (status === 404) setNotFound(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- carga asíncrona de la ficha
    loadBike();
  }, [loadBike, reloadKey]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-sf-black text-gray-500" role="status">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 border-2 border-white/10 border-t-sf-red animate-spin" />
          <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.3em]">Cargando ficha...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-sf flex min-h-[70vh] flex-col justify-center py-12">
        <ErrorState
          title="No pudimos cargar la ficha"
          onRetry={() => setReloadKey((key) => key + 1)}
        />
        <Link to="/motos" className="btn btn-ghost mx-auto mt-6 px-6 py-3 text-xs">
          <ChevronLeft size={15} /> Volver al catálogo
        </Link>
      </div>
    );
  }

  if (!bike || notFound) {
    return (
      <div className="container-sf flex min-h-[70vh] items-center py-12">
        <EmptyState
          icon={<BikeIcon size={30} />}
          code="404"
          title={<>Moto no encontrada</>}
          description="La publicación buscada no existe o ya no está disponible."
          actions={
            <Link to="/motos" className="btn btn-red px-6 py-3 text-xs">
              Volver al catálogo
            </Link>
          }
          className="w-full"
        />
      </div>
    );
  }

  const images = bike.images ?? [];
  const features = bike.features ?? [];
  const currentImage = images[activeImage] ?? images[0];
  const whatsappLink = buildBikeWhatsAppLink(bike);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: bike.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // El usuario canceló el diálogo de compartir.
    }
  };

  // null, 0 y motos 0 km nunca se muestran como si tuvieran horas cargadas.
  const usageHours = bike.condition === 'USADA' ? formatUsageHours(bike.usageHours) : null;
  const specs = [
    { icon: <Calendar size={18} />, label: 'Año', value: String(bike.year) },
    { icon: <Gauge size={18} />, label: 'Cilindrada', value: formatDisplacement(bike.displacementCc) },
    { icon: <Fuel size={18} />, label: 'Kilómetros', value: formatMileage(bike.condition === 'NUEVA' ? 0 : bike.mileageKm) },
    ...(usageHours ? [{ icon: <Timer size={18} />, label: 'Horas de uso', value: usageHours }] : []),
    ...(bike.usage ? [{ icon: <Route size={18} />, label: 'Uso', value: usageLabel(bike.usage) }] : []),
    { icon: <Tag size={18} />, label: 'Categoría', value: bike.condition === 'NUEVA' ? '0 km' : 'Usada' },
  ];

  return (
    <div className="min-h-screen bg-sf-black text-sf-white">
      {/* Breadcrumb */}
      <div className="border-b border-white/5 bg-black">
        <nav className="container-sf flex h-12 items-center gap-2 overflow-x-auto text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500" aria-label="Ruta de navegación">
          <Link to="/motos" className="shrink-0 transition-colors hover:text-sf-red">Catálogo</Link>
          <span className="text-gray-700">/</span>
          <span className="shrink-0 text-gray-300">{bike.brand?.name ?? 'Moto'}</span>
          <span className="text-gray-700">/</span>
          <span className="truncate text-white">{bike.title}</span>
        </nav>
      </div>

      {/* Ficha principal */}
      <section className="track-lines">
        <div className="container-sf grid min-w-0 gap-10 py-10 lg:grid-cols-12 lg:gap-12 lg:py-16">
          {/* Galería */}
          <div className="min-w-0 lg:col-span-7">
            <div className="mb-4 flex items-center gap-3">
              <span className="font-display text-xs font-extrabold tracking-[0.2em] text-sf-red">01</span>
              <span className="h-px w-10 bg-sf-red" />
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-gray-500">Galería</span>
            </div>
            <div className="relative overflow-hidden border border-white/10 bg-black">
              <div className="aspect-[4/3] sm:aspect-[16/11]">
                {currentImage ? (
                  <img
                    key={currentImage.id}
                    src={currentImage.url}
                    alt={`${bike.brand?.name ?? ''} ${bike.model || bike.title} — vista ${activeImage + 1}`}
                    fetchPriority="high"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImagePlaceholder width={1200} height={900} label="Foto no disponible" className="h-full w-full" />
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-sf-red" aria-hidden="true" />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                    className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center border border-white/20 bg-black/70 text-white transition-colors hover:border-sf-red hover:bg-sf-red"
                    aria-label="Siguiente fotografía"
                  >
                    <ChevronRight size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center border border-white/20 bg-black/70 text-white transition-colors hover:border-sf-red hover:bg-sf-red"
                    aria-label="Fotografía anterior"
                  >
                    <ChevronLeft size={22} />
                  </button>
                </>
              )}
              <span className="pointer-events-none absolute bottom-4 right-4 border border-white/15 bg-black/80 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                {images.length ? `${String(activeImage + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}` : 'Sin fotos'}
              </span>
            </div>

            {images.length > 1 && (
              <div className="scrollbar-none mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Ver fotografía ${i + 1}`}
                    aria-current={i === activeImage ? 'true' : undefined}
                    className={cn(
                      'h-20 w-28 shrink-0 overflow-hidden border transition-all',
                      i === activeImage ? 'border-sf-red opacity-100' : 'border-white/10 opacity-50 hover:opacity-80'
                    )}
                  >
                    <img src={getThumbnailUrl(img.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}

            {/* Acciones secundarias */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleFavorite(bike.id)}
                className={cn(
                  'inline-flex items-center gap-2 border px-4 py-3 font-display text-[11px] font-bold uppercase tracking-widest transition-colors',
                  isFavorite ? 'border-sf-red bg-sf-red/15 text-sf-red-soft' : 'border-white/15 text-gray-300 hover:border-sf-red hover:text-white'
                )}
              >
                <Heart size={16} className={isFavorite ? 'fill-sf-red text-sf-red' : ''} />
                {isFavorite ? 'En favoritos' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 border border-white/15 px-4 py-3 font-display text-[11px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-sf-red hover:text-white"
              >
                <Share2 size={16} />
                {copied ? '¡Copiado!' : 'Compartir'}
              </button>
            </div>
          </div>

          {/* Información */}
          <div className="min-w-0 lg:col-span-5">
            <div className="flex flex-wrap items-center gap-2">
              <ConditionTag condition={bike.condition} />
              <StatusTag status={bike.status} />
              {bike.featured && <FeaturedTag />}
            </div>

            <p className="mt-6 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-sf-red">
              {bike.brand?.name ?? 'SF MOTOS'}
            </p>
            <h1 className="mt-2 break-words font-display text-5xl font-extrabold uppercase leading-[0.85] text-white sm:text-7xl">
              {bike.model || bike.title}
            </h1>
            <p className="mt-3 text-sm text-gray-400">{bike.title}</p>

            {/* Precio */}
            <div className="relative mt-7 border-y border-white/10 bg-sf-surface/60 py-6 pl-5 pr-5">
              <div className="absolute inset-y-0 left-0 w-[3px] bg-sf-red" aria-hidden="true" />
              <p className="field-label">{bike.price == null ? 'Precio' : 'Precio publicado'}</p>
              <p className={cn(
                'mt-1 break-words font-display font-extrabold leading-none text-white',
                bike.price == null ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl'
              )}>
                {formatPrice(bike.price, bike.currency)}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {bike.price == null
                  ? 'Consultanos por el precio, la disponibilidad y las condiciones de esta unidad.'
                  : 'Precio informado por la concesionaria. Consultanos por disponibilidad y condiciones de esta unidad.'}
              </p>
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-red mt-6 flex w-full items-center justify-center gap-2 py-4 text-sm"
            >
              <Phone size={20} />
              Consultar disponibilidad
            </a>
            <p className="mt-2 text-center text-[11px] text-gray-500">Te esperamos en {BUSINESS.address}</p>

            {/* Datos principales */}
            <div className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="font-display text-xs font-extrabold tracking-[0.2em] text-sf-red">02</span>
                <span className="h-px w-10 bg-sf-red" />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-gray-500">Datos principales</span>
              </div>
              <div className={cn(
                'grid grid-cols-2 gap-px border border-white/8 bg-white/8',
                usageHours ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
              )}>
                {specs.map((spec) => (
                  <div key={spec.label} className="min-w-0 bg-sf-surface p-4">
                    <div className="text-sf-red-soft">{spec.icon}</div>
                    <p className="field-label mt-3 !text-[9px]">{spec.label}</p>
                    <p className="mt-1 font-display text-lg font-bold text-white">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Características técnicas */}
            {features.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-display text-xs font-extrabold tracking-[0.2em] text-sf-red">03</span>
                  <span className="h-px w-10 bg-sf-red" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-gray-500">Características técnicas</span>
                </div>
                <dl className="border border-white/8">
                  {features.map((feature, index) => (
                    <div key={feature.id} className={cn('flex items-center justify-between gap-4 px-4 py-3', index % 2 === 1 && 'bg-white/[0.02]')}>
                      <dt className="text-xs text-gray-400">{featureLabel(feature.key)}</dt>
                      <dd className="text-right font-display text-sm font-bold uppercase text-white">{feature.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Descripción */}
            {bike.description && (
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-display text-xs font-extrabold tracking-[0.2em] text-sf-red">04</span>
                  <span className="h-px w-10 bg-sf-red" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-gray-500">Descripción</span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{bike.description}</p>
              </div>
            )}

            {/* Aviso prudente: no se inventan garantías ni condiciones */}
            <div className="mt-10 flex items-start gap-3 border border-white/10 bg-sf-surface p-5">
              <MessageCircle size={20} className="mt-0.5 shrink-0 text-sf-red" />
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wider text-white">Consultá las condiciones de esta unidad</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  Las características y condiciones de cada moto se confirman al consultar. Escribinos por WhatsApp para recibir la información disponible.
                </p>
              </div>
            </div>

            <p className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-600">
              <Clock size={12} /> Publicada el {new Date(bike.createdAt).toLocaleDateString('es-AR')}
            </p>
          </div>
        </div>
      </section>

      {/* Relacionadas */}
      {related.length > 0 && (
        <section className="bg-sf-paper text-sf-black">
          <div className="container-sf py-14 sm:py-20">
            <SectionHeading
              index="05"
              eyebrow="También te puede interesar"
              title={<>Similares</>}
              actionLabel="Ver catálogo"
              actionTo="/motos"
              tone="light"
            />
            <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {related.map((item) => (
                <div key={item.id} className="w-[78vw] max-w-xs shrink-0 snap-start sm:w-72 lg:w-auto lg:max-w-none">
                  <BikeCard bike={item} tone="light" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Retorno al catálogo */}
      <div className="container-sf py-10">
        <Link to="/motos" className="inline-flex items-center gap-2 border-b border-white/20 pb-1 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-gray-400 transition-colors hover:border-sf-red hover:text-sf-red">
          <ChevronLeft size={15} /> Volver al catálogo
        </Link>
      </div>
    </div>
  );
};
