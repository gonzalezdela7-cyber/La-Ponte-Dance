import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Quote,
  Calendar,
  Calculator as CalcIcon,
} from 'lucide-react';
import { CONFIGURACION_LA_PONTE_DANCE } from '../data/config.ts';

interface StudentTestimonial {
  id: number;
  author: string;
  role: string;
  ageGroupId: string;
  ageBadge: string;
  location: string;
  rating: number;
  quote: string;
  highlight: string;
}

const TESTIMONIOS_PRUEBA: StudentTestimonial[] = [
  {
    id: 1,
    author: 'Elena M.',
    role: 'Madre de alumna (Grupo Infantil)',
    ageGroupId: 'ninos',
    ageBadge: 'Niños · Desde 3 años',
    location: 'Torrijos, Toledo',
    rating: 5,
    quote:
      'Mi hija de 5 años sale encantada cada semana. El trato es súper cercano, aprenden ritmo y coordinación jugando en un ambiente lleno de cariño y respeto.',
    highlight: 'Confianza y diversión para los más pequeños',
  },
  {
    id: 2,
    author: 'Carlos y Lucía',
    role: 'Alumnos en pareja (Baile Nupcial y Social)',
    ageGroupId: 'parejas',
    ageBadge: 'Parejas · Adultos',
    location: 'Torrijos, Toledo',
    rating: 5,
    quote:
      'Empezamos desde cero para preparar el baile de nuestra boda y la paciencia y elegancia con la que nos guiaron hicieron que disfrutáramos cada ensayo sin nervios.',
    highlight: 'Experiencia personalizada para parejas',
  },
  {
    id: 3,
    author: 'Carmen R.',
    role: 'Alumna (Grupo Adultos)',
    ageGroupId: 'adultos',
    ageBadge: 'Adultos · 3 a 99 años',
    location: 'Torrijos, Toledo',
    rating: 5,
    quote:
      'Pensaba que a mi edad ya era tarde para empezar a bailar, pero en La Ponte Dance te hacen sentir parte de una familia desde el primer minuto. Es mi momento favorito de desconexión.',
    highlight: 'Bienestar, ritmo y desconexión sin límite de edad',
  },
  {
    id: 4,
    author: 'Alejandro G.',
    role: 'Alumno (Grupo Jóvenes)',
    ageGroupId: 'jovenes',
    ageBadge: 'Jóvenes · Adolescentes',
    location: 'Torrijos, Toledo',
    rating: 5,
    quote:
      'Un estudio con muchísima energía en Torrijos. Mejoramos la técnica y la expresión corporal en cada sesión mientras trabajamos en equipo con muy buen ambiente.',
    highlight: 'Energía, técnica y compañerismo',
  },
];

interface StudentReviewsCarouselProps {
  onOpenTrialBooking: (ageId?: string) => void;
  onOpenCalculator: (ageId?: string) => void;
}

export const StudentReviewsCarousel: React.FC<StudentReviewsCarouselProps> = ({
  onOpenTrialBooking,
  onOpenCalculator,
}) => {
  const { CONFIRMADO } = CONFIGURACION_LA_PONTE_DANCE;
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const total = TESTIMONIOS_PRUEBA.length;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, handleNext]);

  const currentReview = TESTIMONIOS_PRUEBA[currentIndex];
  const secondaryIndex = (currentIndex + 1) % total;
  const secondaryReview = TESTIMONIOS_PRUEBA[secondaryIndex];

  return (
    <div
      className="space-y-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="text-xs font-medium text-[#5C1329]">
            Experiencias en {CONFIRMADO.nombre} · {CONFIRMADO.localidad} (Datos de demostración)
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#222222]">
            Opiniones de nuestros alumnos
          </h2>
          <p className="text-sm sm:text-base text-[#222222]/75">
            Descubre cómo viven la danza niños, jóvenes, adultos y parejas de{' '}
            <strong>{CONFIRMADO.rangoGeneral}</strong> en nuestro estudio de{' '}
            <strong>{CONFIRMADO.localidad}</strong>.
          </p>
        </div>

        {/* Carousel Navigation Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className="text-xs font-semibold text-[#222222]/65 tabular-nums mr-1">
            {currentIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Opinión anterior"
            className="p-2.5 rounded-xl border border-[#E8C5C8] bg-white text-[#5C1329] hover:bg-[#5C1329] hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Siguiente opinión"
            className="p-2.5 rounded-xl border border-[#E8C5C8] bg-white text-[#5C1329] hover:bg-[#5C1329] hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Simple Carousel Track (1 Featured Card on Mobile, 2 Cards on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Primary Active Testimonial Card */}
        <article className="lg:col-span-7 bg-white border-2 border-[#5C1329] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs transition-all">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C1329] bg-[#E8C5C8]/45 px-3 py-1 rounded-lg">
                {currentReview.ageBadge}
              </span>
              <div
                className="flex items-center gap-1 text-[#5C1329]"
                aria-label={`Valoración: ${currentReview.rating} de 5 estrellas`}
              >
                {Array.from({ length: currentReview.rating }).map((_, idx) => (
                  <Star key={idx} className="w-4 h-4 fill-[#5C1329] text-[#5C1329]" />
                ))}
              </div>
            </div>

            <div className="relative pt-1">
              <Quote className="w-8 h-8 text-[#E8C5C8] mb-2" />
              <blockquote className="font-display text-xl sm:text-2xl font-medium text-[#222222] leading-relaxed">
                “{currentReview.quote}”
              </blockquote>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8C5C8]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-base text-[#222222]">{currentReview.author}</div>
              <div className="text-xs text-[#222222]/70">
                {currentReview.role} · {currentReview.location}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenTrialBooking(currentReview.ageGroupId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                Probar este grupo
              </button>
              <button
                type="button"
                onClick={() => onOpenCalculator(currentReview.ageGroupId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors cursor-pointer"
              >
                <CalcIcon className="w-3.5 h-3.5 text-[#5C1329]" />
                Calcular cuota
              </button>
            </div>
          </div>
        </article>

        {/* Secondary Next Testimonial Preview Card (Desktop) */}
        <article className="hidden lg:flex lg:col-span-5 bg-white/80 border border-[#E8C5C8] rounded-2xl p-6 sm:p-8 flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#5C1329]">
                {secondaryReview.ageBadge}
              </span>
              <div className="flex items-center gap-0.5 text-[#5C1329]">
                {Array.from({ length: secondaryReview.rating }).map((_, idx) => (
                  <Star key={idx} className="w-3.5 h-3.5 fill-[#5C1329] text-[#5C1329]" />
                ))}
              </div>
            </div>

            <blockquote className="text-base text-[#222222]/85 leading-relaxed italic">
              “{secondaryReview.quote}”
            </blockquote>
          </div>

          <div className="pt-4 border-t border-[#E8C5C8]/60 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-sm text-[#222222]">
                {secondaryReview.author}
              </div>
              <div className="text-xs text-[#222222]/65">{secondaryReview.role}</div>
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="text-xs font-semibold text-[#5C1329] hover:underline cursor-pointer"
            >
              Leer siguiente →
            </button>
          </div>
        </article>
      </div>

      {/* Pagination Dots */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {TESTIMONIOS_PRUEBA.map((item, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Ver opinión de ${item.author}`}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                isActive
                  ? 'w-8 bg-[#5C1329]'
                  : 'w-2.5 bg-[#E8C5C8] hover:bg-[#5C1329]/50'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
