import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  MessageCircle,
  Bookmark,
  Send,
  Loader2,
  Instagram,
  RotateCcw,
} from 'lucide-react';
import { CONFIGURACION_LA_PONTE_DANCE, buildWhatsAppUrl } from '../data/config.ts';

interface ChatbotProps {
  isOpen: boolean;
  initialTopic?: string | null;
  onToggle: () => void;
  onClose: () => void;
  onGoToCalculator: () => void;
  onGoToTrialBooking: () => void;
  onGoToContact: () => void;
  onSaveSessionToFirestore?: (topic: string, summary: string) => Promise<void>;
  isAuthenticated: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  showContactActions?: boolean;
  showCalculatorAction?: boolean;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const Chatbot: React.FC<ChatbotProps> = ({
  isOpen,
  onToggle,
  onClose,
  onGoToCalculator,
  onSaveSessionToFirestore,
  isAuthenticated,
}) => {
  const { CONFIRMADO } = CONFIGURACION_LA_PONTE_DANCE;

  const initialWelcomeMessage: ChatMessage = {
    id: 'welcome',
    sender: 'bot',
    text: `¡Hola! 👋 Te doy la bienvenida al asistente digital con IA de ${CONFIRMADO.nombre} en ${CONFIRMADO.localidad}.\n\n¿En qué te puedo ayudar hoy? Escribe libremente cualquier consulta aquí abajo.`,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialWelcomeMessage]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastContextLabel, setLastContextLabel] = useState<string>('Conversación IA');
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus text input whenever the chatbot opens so the user can type immediately
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const sendMessageToAi = async (userMessage: string) => {
    const cleanText = userMessage.trim();
    if (!cleanText || isLoading) return;

    setLastContextLabel(cleanText.slice(0, 60));

    const nextUserMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: cleanText,
    };

    const normalized = normalizeText(cleanText);
    const isContactOrInstagramIntent =
      normalized.includes('whatsapp') ||
      normalized.includes('hablar') ||
      normalized.includes('telefono') ||
      normalized.includes('contacto') ||
      normalized.includes('email') ||
      normalized.includes('instagram') ||
      normalized.includes('redes');

    const isCalculatorIntent =
      normalized.includes('precio') ||
      normalized.includes('cuesta') ||
      normalized.includes('cuanto') ||
      normalized.includes('tarifas') ||
      normalized.includes('cuota') ||
      normalized.includes('presupuesto') ||
      normalized.includes('calculadora');

    const currentHistory = [...messages, nextUserMsg];
    setMessages(currentHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener respuesta del asistente.');
      }

      const replyText: string = data.reply || '';
      const replyNorm = normalizeText(replyText);

      setMessages((prev) => [
        ...prev,
        {
          id: `b_${Date.now() + 1}`,
          sender: 'bot',
          text: replyText,
          showContactActions:
            isContactOrInstagramIntent ||
            replyNorm.includes('instagram') ||
            replyNorm.includes('laponte_dance') ||
            replyNorm.includes('653860324'),
          showCalculatorAction:
            isCalculatorIntent || replyNorm.includes('calculadora'),
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b_err_${Date.now() + 1}`,
          sender: 'bot',
          text:
            error?.message ||
            `Puedes contactar directamente con ${CONFIRMADO.nombre} a través de sus canales oficiales:\n📱 Teléfono / WhatsApp: ${CONFIRMADO.telefono}\n✉️ Email: ${CONFIRMADO.email}\n📸 Instagram: ${CONFIRMADO.instagramHandle}`,
          showContactActions: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    void sendMessageToAi(inputText);
  };

  const handleResetChat = () => {
    setMessages([initialWelcomeMessage]);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleSaveCurrentChat = async () => {
    if (!onSaveSessionToFirestore) return;
    const lastBot = [...messages].reverse().find((m) => m.sender === 'bot');
    if (!lastBot) return;
    try {
      await onSaveSessionToFirestore(lastContextLabel, lastBot.text);
      setSavedFeedback('Conversación guardada en Mi Espacio.');
      setTimeout(() => setSavedFeedback(null), 3000);
    } catch {
      setSavedFeedback('Inicia sesión con Google verificado para guardar.');
      setTimeout(() => setSavedFeedback(null), 3000);
    }
  };

  const whatsappDirectUrl = buildWhatsAppUrl(
    `Hola ${CONFIRMADO.nombre}, quisiera solicitar información`
  );

  // Render message text turning @laponte_dance, @la_pontedance, or instagram URLs into clickable links
  const renderFormattedMessage = (text: string) => {
    const tokenRegex =
      /(https?:\/\/(?:www\.)?instagram\.com\/[^\s)]+|@laponte_dance|@la_pontedance|silviapontejuan@gmail\.com|653860324)/gi;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      if (
        lower === '@laponte_dance' ||
        lower === '@la_pontedance' ||
        lower.startsWith('http://instagram.com') ||
        lower.startsWith('https://instagram.com') ||
        lower.startsWith('https://www.instagram.com')
      ) {
        return (
          <a
            key={idx}
            href={CONFIRMADO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5C1329] font-bold underline hover:opacity-80"
          >
            {CONFIRMADO.instagramHandle}
          </a>
        );
      }
      if (lower === 'silviapontejuan@gmail.com') {
        return (
          <a
            key={idx}
            href={`mailto:${CONFIRMADO.email}`}
            className="text-[#5C1329] font-bold underline hover:opacity-80"
          >
            {CONFIRMADO.email}
          </a>
        );
      }
      if (lower === '653860324') {
        return (
          <a
            key={idx}
            href={whatsappDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5C1329] font-bold underline hover:opacity-80"
          >
            {CONFIRMADO.telefono}
          </a>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Abrir asistente con IA de La Ponte Dance"
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#5C1329] text-white shadow-md hover:bg-[#460e1f] transition-colors text-xs sm:text-sm font-semibold whitespace-nowrap"
        >
          {isOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>Cerrar asistente</span>
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4" />
              <span>Hablar con el asistente IA</span>
            </>
          )}
        </button>
      </div>

      {/* Chat Drawer / Window — Pure Free-Text Conversational Interface (No Topic Selection Buttons) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chatbot Oficial con IA de La Ponte Dance"
          className="fixed bottom-36 md:bottom-20 right-3 md:right-6 z-50 w-[calc(100vw-1.5rem)] max-w-[420px] bg-[#FBF8F6] border border-[#5C1329]/20 rounded-2xl shadow-2xl flex flex-col h-[520px] max-h-[75vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#5C1329] text-white px-4 py-3.5 flex items-center justify-between">
            <div>
              <h4 className="font-display text-lg font-semibold leading-tight">
                {CONFIRMADO.nombre}
              </h4>
              <p className="text-xs text-[#E8C5C8]">
                Asistente Digital Oficial con IA
              </p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reiniciar conversación"
                  className="p-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {isAuthenticated && onSaveSessionToFirestore && (
                <button
                  type="button"
                  onClick={handleSaveCurrentChat}
                  title="Guardar orientación en Mi Espacio"
                  className="p-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana del asistente"
                className="p-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {savedFeedback && (
            <div className="bg-[#E8C5C8] text-[#222222] px-4 py-1.5 text-xs font-medium text-center">
              {savedFeedback}
            </div>
          )}

          {/* Conversation Messages */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#FBF8F6]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-xs sm:text-sm whitespace-pre-line leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#5C1329] text-white rounded-br-xs'
                      : 'bg-white text-[#222222] border border-[#E2DDD9] rounded-bl-xs'
                  }`}
                >
                  <div>
                    {m.sender === 'bot' ? renderFormattedMessage(m.text) : m.text}
                  </div>

                  {/* Direct clickable links inside Bot Bubble when discussing Contact / Instagram / WhatsApp */}
                  {m.sender === 'bot' && m.showContactActions && (
                    <div className="mt-3 pt-2.5 border-t border-[#E8C5C8]/60 flex flex-wrap items-center gap-2">
                      <a
                        href={CONFIRMADO.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5C1329]/10 text-[#5C1329] text-xs font-bold underline hover:bg-[#5C1329]/20 transition-colors"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        <span>{CONFIRMADO.instagramHandle}</span>
                      </a>
                      <a
                        href={whatsappDirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-95 transition-opacity"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Abrir WhatsApp Directo</span>
                      </a>
                    </div>
                  )}

                  {/* Direct clickable link inside Bot Bubble when discussing Calculator / Prices */}
                  {m.sender === 'bot' && m.showCalculatorAction && (
                    <div className="mt-2.5 pt-2 border-t border-[#E8C5C8]/60">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGoToCalculator();
                        }}
                        className="text-xs font-bold text-[#5C1329] underline hover:opacity-80 inline-flex items-center gap-1"
                      >
                        📊 Abrir Calculadora de Presupuesto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3.5 py-2.5 text-xs bg-white text-[#222222]/75 border border-[#E8C5C8] inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5C1329]" />
                  <span>Escribiendo respuesta...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Clean Free-Text Chat Footer */}
          <div className="p-3 bg-white border-t border-[#E2DDD9]">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isLoading}
                placeholder="Escribe tu pregunta aquí..."
                className="flex-1 px-3.5 py-2.5 rounded-full border border-[#CCCCCC] bg-white text-xs sm:text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                aria-label="Enviar mensaje"
                className="px-4 py-2.5 rounded-full bg-[#5C1329] text-white text-xs font-bold hover:bg-[#460e1f] disabled:opacity-40 transition-colors shrink-0 inline-flex items-center gap-1.5"
              >
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
