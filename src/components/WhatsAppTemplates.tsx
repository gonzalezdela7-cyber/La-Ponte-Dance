import React, { useState } from 'react';
import {
  Copy,
  Check,
  MessageCircle,
  Sparkles,
  ExternalLink,
  Instagram,
  Phone,
} from 'lucide-react';
import {
  CONFIGURACION_LA_PONTE_DANCE,
  PLANTILLAS_WHATSAPP_OFICIALES,
  WhatsAppTemplateItem,
  buildWhatsAppUrl,
} from '../data/config.ts';

export const WhatsAppTemplates: React.FC = () => {
  const { CONFIRMADO } = CONFIGURACION_LA_PONTE_DANCE;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    PLANTILLAS_WHATSAPP_OFICIALES[0].id
  );
  const [customTexts, setCustomTexts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const tpl of PLANTILLAS_WHATSAPP_OFICIALES) {
      initial[tpl.id] = tpl.mensaje;
    }
    return initial;
  });

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2500);
    } catch {
      // Fallback copy if clipboard API fails
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2500);
    }
  };

  const handleResetTemplate = (tpl: WhatsAppTemplateItem) => {
    setCustomTexts((prev) => ({
      ...prev,
      [tpl.id]: tpl.mensaje,
    }));
  };

  return (
    <div className="bg-white border border-[#E8C5C8] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E8C5C8]/70">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5C1329]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guía Operativa Oficial · WhatsApp Business & Atención al Cliente</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#222222]">
            Plantillas Oficiales de Respuesta para WhatsApp ({CONFIRMADO.telefono})
          </h3>
          <p className="text-xs sm:text-sm text-[#222222]/75 max-w-3xl leading-relaxed">
            Textos verificados listos para copiar y pegar en <strong>WhatsApp Business</strong> o enviar directamente en un clic, cumpliendo la regla de veracidad sobre datos confirmados ({CONFIRMADO.localidad}, de {CONFIRMADO.rangoGeneral}) y datos <strong>[PENDIENTE DE CONFIRMAR]</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={CONFIRMADO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#5C1329]/30 bg-[#FBF8F6] text-[#5C1329] text-xs font-bold hover:bg-[#E8C5C8]/30 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>{CONFIRMADO.instagramHandle}</span>
          </a>
          <a
            href={buildWhatsAppUrl(
              customTexts[selectedTemplateId] || PLANTILLAS_WHATSAPP_OFICIALES[0].mensaje
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:opacity-95 transition-opacity"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Probar plantilla activa en WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {PLANTILLAS_WHATSAPP_OFICIALES.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTemplateId(tpl.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#5C1329] text-white border-[#5C1329] shadow-xs'
                  : 'bg-[#FBF8F6] text-[#222222]/85 border-[#E8C5C8] hover:border-[#5C1329]'
              }`}
            >
              {tpl.numero}: {tpl.titulo.split('(')[0].trim()}
            </button>
          );
        })}
      </div>

      {/* Grid of All 6 Official Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLANTILLAS_WHATSAPP_OFICIALES.map((tpl) => {
          const currentText = customTexts[tpl.id] ?? tpl.mensaje;
          const isCopied = copiedId === tpl.id;
          const isHighlighted = selectedTemplateId === tpl.id;

          return (
            <div
              key={tpl.id}
              onClick={() => setSelectedTemplateId(tpl.id)}
              className={`rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all border ${
                isHighlighted
                  ? 'bg-[#FBF8F6] border-[#5C1329] ring-1 ring-[#5C1329]/20'
                  : 'bg-[#FBF8F6]/60 border-[#E8C5C8] hover:border-[#5C1329]/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#5C1329] bg-[#E8C5C8]/50 px-2.5 py-0.5 rounded-md mb-1">
                      {tpl.numero}
                    </span>
                    <h4 className="text-base font-bold text-[#222222] leading-snug">
                      {tpl.titulo}
                    </h4>
                  </div>

                  {currentText !== tpl.mensaje && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetTemplate(tpl);
                      }}
                      className="text-[11px] text-[#5C1329] underline hover:opacity-80 shrink-0"
                    >
                      Restaurar original
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#222222]/75 leading-relaxed">
                  <strong>Objetivo:</strong> {tpl.objetivo}
                </p>

                {/* Editable WhatsApp Message Preview Box */}
                <div className="relative">
                  <label htmlFor={`tpl-${tpl.id}`} className="sr-only">
                    Texto de {tpl.numero}
                  </label>
                  <textarea
                    id={`tpl-${tpl.id}`}
                    rows={8}
                    value={currentText}
                    onChange={(e) =>
                      setCustomTexts((prev) => ({
                        ...prev,
                        [tpl.id]: e.target.value,
                      }))
                    }
                    className="w-full p-3.5 rounded-xl bg-white border border-[#E2DDD9] text-xs sm:text-[13px] text-[#222222] leading-relaxed font-sans focus:outline-none focus:border-[#5C1329] resize-y"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8C5C8]/60">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopy(tpl.id, currentText);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isCopied
                      ? 'bg-[#25D366] text-white'
                      : 'bg-[#5C1329] text-white hover:bg-[#460e1f]'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Plantilla copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar mensaje</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={buildWhatsAppUrl(currentText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#25D366] bg-white text-[#1da851] text-xs font-bold hover:bg-[#25D366] hover:text-white transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Abrir en WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
