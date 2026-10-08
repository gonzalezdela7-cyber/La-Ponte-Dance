/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  MessageCircle,
  Calculator as CalcIcon,
  HelpCircle,
  MapPin,
  Phone,
  Mail,
  Instagram,
  CheckCircle2,
  LogOut,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ASSETS,
  CONFIGURACION_LA_PONTE_DANCE,
  buildWhatsAppUrl,
} from './data/config.ts';
import {
  initAuth,
  googleSignIn,
  logout,
  getAuthBearerToken,
  OidcClaimsClient,
  subscribeUserSessions,
  subscribeUserTrialBookings,
  createFirestoreSession,
  ChatSessionRecord,
  TrialBookingFirestoreRecord,
} from './lib/firebase.ts';
import type { CalculatorSummaryPayload } from './components/Calculator.tsx';
import { LazyMount } from './components/LazyMount.tsx';

// Code-split heavy interactive components via React.lazy
const Calculator = lazy(() =>
  import('./components/Calculator.tsx').then((m) => ({ default: m.Calculator }))
);
const Chatbot = lazy(() =>
  import('./components/Chatbot.tsx').then((m) => ({ default: m.Chatbot }))
);
const WorkspaceHub = lazy(() =>
  import('./components/WorkspaceHub.tsx').then((m) => ({ default: m.WorkspaceHub }))
);
const TrialClassBooking = lazy(() =>
  import('./components/TrialClassBooking.tsx').then((m) => ({
    default: m.TrialClassBooking,
  }))
);
const StudioLocationMap = lazy(() =>
  import('./components/StudioLocationMap.tsx').then((m) => ({
    default: m.StudioLocationMap,
  }))
);
const WhatsAppTemplates = lazy(() =>
  import('./components/WhatsAppTemplates.tsx').then((m) => ({
    default: m.WhatsAppTemplates,
  }))
);
const StudentReviewsCarousel = lazy(() =>
  import('./components/StudentReviewsCarousel.tsx').then((m) => ({
    default: m.StudentReviewsCarousel,
  }))
);

export default function App() {
  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR, EJEMPLO_NO_OFICIAL } =
    CONFIGURACION_LA_PONTE_DANCE;

  // Auth & Cloud State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [oidcClaims, setOidcClaims] = useState<OidcClaimsClient | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [firestoreSessions, setFirestoreSessions] = useState<ChatSessionRecord[]>([]);
  const [firestoreTrialBookings, setFirestoreTrialBookings] = useState<
    TrialBookingFirestoreRecord[]
  >([]);
  const [sqlEstimates, setSqlEstimates] = useState<any[]>([]);
  const [sqlInquiries, setSqlInquiries] = useState<any[]>([]);
  const [sqlTrialBookings, setSqlTrialBookings] = useState<any[]>([]);

  // Interactive Ecosystem Routing & Pre-selections
  const [preselectedAgeId, setPreselectedAgeId] = useState<string | null>(null);
  const [preselectedTrialAgeId, setPreselectedTrialAgeId] = useState<string | null>(null);
  const [editingEstimate, setEditingEstimate] = useState<any | null>(null);
  const [chatbotOpen, setChatbotOpen] = useState<boolean>(false);
  const [chatbotTopic, setChatbotTopic] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [pendingGmailDraft, setPendingGmailDraft] = useState<{
    subject: string;
    body: string;
  } | null>(null);

  // Contact / Express Lead Form State
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactInterest, setContactInterest] = useState<string>('');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactConsent, setContactConsent] = useState<boolean>(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSubmitted, setContactSubmitted] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [cookiesAccepted, setCookiesAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cookiesAccepted') === 'true';
    } catch {
      return false;
    }
  });

  const handleAcceptCookies = () => {
    try {
      localStorage.setItem('cookiesAccepted', 'true');
    } catch {
      // ignore storage errors
    }
    setCookiesAccepted(true);
  };

  // Image error fallback tracking
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  // Google Maps Platform Demo Key Quota Warning State
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (u, token, claims) => {
        setUser(u);
        if (token) setAccessToken(token);
        if (claims) setOidcClaims(claims);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setOidcClaims(null);
        setFirestoreSessions([]);
        setFirestoreTrialBookings([]);
        setSqlEstimates([]);
        setSqlInquiries([]);
        setSqlTrialBookings([]);
      }
    );
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubFirestore = subscribeUserSessions(user.uid, (sessions) => {
      setFirestoreSessions(sessions);
    });
    const unsubTrialFirestore = subscribeUserTrialBookings(user.uid, (bookings) => {
      setFirestoreTrialBookings(bookings);
    });
    fetchSqlRecords(user);
    return () => {
      unsubFirestore();
      unsubTrialFirestore();
    };
  }, [user]);

  const fetchSqlRecords = async (currentUser: User) => {
    try {
      const bearerToken = await getAuthBearerToken(currentUser);
      const res = await fetch('/api/records', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSqlEstimates(data.estimates || []);
        setSqlInquiries(data.inquiries || []);
        setSqlTrialBookings(data.trialBookings || []);
      }
    } catch (error) {
      console.error('Could not load user SQL records:', error);
    }
  };

  const handleGoogleLogin = async (): Promise<{ user: User; accessToken: string } | null> => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      if (result.oidcClaims) setOidcClaims(result.oidcClaims);
      return result;
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      return null;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setOidcClaims(null);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenCalculatorForAge = (ageId?: string) => {
    if (ageId) setPreselectedAgeId(ageId);
    scrollToSection('presupuesto');
  };

  const handleOpenTrialBookingForAge = (ageId?: string) => {
    if (ageId) setPreselectedTrialAgeId(ageId);
    scrollToSection('clase-prueba');
  };

  const handleOpenChatbotTopic = (topic?: string) => {
    if (topic) setChatbotTopic(topic);
    setChatbotOpen(true);
  };

  const handleSaveEstimateToCloud = async (payload: CalculatorSummaryPayload) => {
    if (!user) return;
    const bearerToken = await getAuthBearerToken(user);
    const res = await fetch('/api/estimates', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created = await res.json();
      setSqlEstimates((prev) => [created, ...prev]);
    }
    await createFirestoreSession(
      `Presupuesto ${payload.ageGroup}`,
      `${payload.studentLabel} · ${payload.activity} · ${payload.frequency} · Estimación orientativa: ${payload.estimatedAmount} €/mes (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria})`
    );
  };

  const handleUpdateEstimateInCloud = async (
    estimateId: number,
    payload: CalculatorSummaryPayload
  ) => {
    if (!user) return;
    const bearerToken = await getAuthBearerToken(user);
    const res = await fetch(`/api/estimates/${estimateId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'No se pudo actualizar el presupuesto.');
    }
    const updated = await res.json();
    setSqlEstimates((prev) => prev.map((e) => (e.id === estimateId ? updated : e)));
    if (editingEstimate?.id === estimateId) {
      setEditingEstimate(null);
    }
  };

  const handleDeleteEstimateFromCloud = async (estimateId: number) => {
    if (!user) return;
    const bearerToken = await getAuthBearerToken(user);
    const res = await fetch(`/api/estimates/${estimateId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'No se pudo eliminar el presupuesto.');
    }
    setSqlEstimates((prev) => prev.filter((e) => e.id !== estimateId));
    if (editingEstimate?.id === estimateId) {
      setEditingEstimate(null);
    }
  };

  const handleEditEstimateInCalculator = (estimate: any) => {
    setEditingEstimate(estimate);
    scrollToSection('presupuesto');
  };

  const handleCompleteCalculatorToContact = (payload: CalculatorSummaryPayload) => {
    setContactName(payload.contactName);
    setContactPhone(payload.contactPhone);
    const lowerAge = payload.ageGroup.toLowerCase();
    if (lowerAge.includes('niñ') || lowerAge.includes('infantil') || lowerAge.includes('jóven') || lowerAge.includes('joven')) {
      setContactInterest('Clases Infantiles / Juveniles');
    } else if (lowerAge.includes('pareja') || lowerAge.includes('boda')) {
      setContactInterest('Bailes para Bodas y Eventos');
    } else if (lowerAge.includes('adult')) {
      setContactInterest('Clases para Adultos');
    } else {
      setContactInterest('Información General');
    }
    setContactMessage(payload.formattedSummary);
    setContactConsent(true);
    scrollToSection('contacto');
  };

  const handleSendCalculatorViaGmail = (payload: CalculatorSummaryPayload) => {
    setPendingGmailDraft({
      subject: `Simulación de presupuesto — ${CONFIRMADO.nombre} (${payload.ageGroup})`,
      body: payload.formattedSummary,
    });
    scrollToSection('mi-espacio');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) {
      setContactError('Por favor, introduce tu nombre de contacto.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 6) {
      setContactError('Por favor, introduce un teléfono o WhatsApp válido.');
      return;
    }
    if (!contactInterest) {
      setContactError('Por favor, selecciona qué te interesa principalmente.');
      return;
    }
    if (!contactConsent) {
      setContactError('Debes aceptar la Política de Privacidad antes de enviar.');
      return;
    }

    setContactError(null);

    const formattedMsg = contactMessage.trim()
      ? `Hola La Ponte Dance, soy ${contactName.trim()} (${contactPhone.trim()}). Quisiera solicitar información sobre: ${contactInterest}.\n\n${contactMessage.trim()}`
      : `Hola La Ponte Dance, soy ${contactName.trim()} (${contactPhone.trim()}). Quisiera solicitar información sobre: ${contactInterest}.`;

    if (user) {
      try {
        const bearerToken = await getAuthBearerToken(user);
        const res = await fetch('/api/inquiries', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: contactName.trim(),
            phone: contactPhone.trim(),
            message: `${contactInterest}${contactMessage.trim() ? ` — ${contactMessage.trim()}` : ''}`,
            source: 'Formulario Captación Exprés',
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setSqlInquiries((prev) => [created, ...prev]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setContactSubmitted(true);

    // Trigger anchor navigation to official WhatsApp in a new tab
    const waLink = document.createElement('a');
    waLink.href = `https://wa.me/34653860324?text=${encodeURIComponent(formattedMsg)}`;
    waLink.target = '_blank';
    waLink.rel = 'noopener noreferrer';
    document.body.appendChild(waLink);
    waLink.click();
    document.body.removeChild(waLink);
  };

  const faqBlocks = [
    {
      category: 'Sobre el Estudio y Edades',
      items: [
        {
          id: 0,
          question: '¿Dónde se encuentra situado el estudio?',
          content: (
            <>
              Nuestro estudio está situado en <strong>Torrijos (Toledo)</strong>. La dirección exacta con calle y número está actualmente <strong>[PENDIENTE DE CONFIRMAR]</strong>. Si deseas que te avisemos en cuanto confirmemos la ubicación física, escríbenos por WhatsApp al 📱{' '}
              <a
                href="https://wa.me/34653860324"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C1329] font-bold underline"
              >
                653860324
              </a>
              .
            </>
          ),
        },
        {
          id: 1,
          question: '¿A partir de qué edad se puede empezar a bailar?',
          content: (
            <>
              Ofrecemos un rango de edad general desde los <strong>3 hasta los 99 años</strong>. Contamos con alternativas adaptadas tanto para niños y jóvenes como para adultos o parejas.
            </>
          ),
        },
      ],
    },
    {
      category: 'Clases y Oferta',
      items: [
        {
          id: 2,
          question: '¿Qué clases o disciplinas están disponibles?',
          content: (
            <>
              El catálogo oficial y definitivo de disciplinas se encuentra <strong>[PENDIENTE DE CONFIRMAR]</strong>. Puedes registrar tu interés escribiendo a nuestro correo o teléfono para avisarte tras su publicación.
            </>
          ),
        },
      ],
    },
    {
      category: 'Tarifas y Presupuestos',
      items: [
        {
          id: 3,
          question: '¿Cuánto cuestan las mensualidades y matrículas?',
          content: (
            <>
              Las tarifas oficiales y gastos de matrícula están <strong>[PENDIENTE DE CONFIRMAR]</strong>. Puedes probar nuestra{' '}
              <button
                type="button"
                onClick={() => handleOpenCalculatorForAge()}
                className="text-[#5C1329] font-bold underline cursor-pointer"
              >
                herramienta de presupuesto orientativo
              </button>{' '}
              (que funciona con precios de ejemplo no oficiales) o consultar al 📱{' '}
              <a
                href="https://wa.me/34653860324"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C1329] font-bold underline"
              >
                653860324
              </a>
              .
            </>
          ),
        },
      ],
    },
    {
      category: 'Contacto',
      items: [
        {
          id: 4,
          question: '¿Cómo puedo contactar con La Ponte Dance?',
          content: (
            <>
              Puedes contactar a través de WhatsApp al{' '}
              <a
                href="https://wa.me/34653860324"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C1329] font-bold underline"
              >
                653860324
              </a>
              , enviando un email a{' '}
              <a
                href={`mailto:${CONFIRMADO.email}`}
                className="text-[#5C1329] font-bold underline"
              >
                {CONFIRMADO.email}
              </a>{' '}
              o en nuestro Instagram oficial{' '}
              <a
                href={CONFIRMADO.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C1329] font-bold underline"
              >
                {CONFIRMADO.instagramHandle}
              </a>
              .
            </>
          ),
        },
      ],
    },
  ];

  const generalWhatsAppUrl = buildWhatsAppUrl(
    `Hola ${CONFIRMADO.nombre}, visito vuestra web oficial y me gustaría solicitar información sobre las clases en ${CONFIRMADO.localidad}.`
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF8F6] text-[#222222] pb-16 md:pb-0">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* TOP BAR CONTRACT: Strictly 1 row, 3 zones (Brand Wordmark | 5-6 Nav Links | Primary Actions) */}
      <header className="sticky top-0 z-30 bg-[#FBF8F6]/95 backdrop-blur-xs border-b border-[#E8C5C8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#inicio"
            className="font-display text-2xl font-bold tracking-tight text-[#5C1329] whitespace-nowrap shrink-0"
          >
            {CONFIRMADO.nombre}
          </a>

          {/* Zone 2: Clean text navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#222222]/80">
            <a href="#inicio" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              Inicio
            </a>
            <a href="#estudio" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              El Estudio
            </a>
            <a href="#clases" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              Clases
            </a>
            <a href="#clase-prueba" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              Clase de Prueba
            </a>
            <a href="#presupuesto" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              Presupuesto
            </a>
            <a href="#contacto" className="hover:text-[#5C1329] transition-colors whitespace-nowrap">
              Contacto
            </a>
          </nav>

          {/* Zone 3: 1-2 primary actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!user ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Conectando...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="#mi-espacio"
                  title={`Sesión OIDC/JWT activa (${oidcClaims?.email || user.email})`}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#E8C5C8]/45 text-[#5C1329] text-xs font-semibold hover:bg-[#E8C5C8]/75 transition-colors"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#5C1329]" />
                  )}
                  <span className="max-w-[110px] truncate">
                    {user.displayName || user.email}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión OIDC/JWT de Google"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs font-medium text-[#222222] hover:border-[#5C1329] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="sm:hidden max-w-[90px] truncate">
                    {user.displayName || user.email}
                  </span>
                  <span className="hidden sm:inline">Salir</span>
                  <LogOut className="w-3.5 h-3.5 text-[#5C1329]" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => scrollToSection('contacto')}
              className="px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs sm:text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
            >
              Solicitar información
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* SECTION 1: INICIO (HERO) */}
        <section id="inicio" className="py-12 md:py-20 border-b border-[#E8C5C8]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                {/* Quiet unboxed metadata line */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5C1329]">
                  <span>Estudio de danza en {CONFIRMADO.localidad}</span>
                  <span aria-hidden="true">·</span>
                  <span>{CONFIRMADO.rangoGeneral}</span>
                  <span aria-hidden="true">·</span>
                  <span>Niños, jóvenes, adultos y parejas</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#222222] leading-[1.08]">
                  Elegancia, movimiento y formación para todas las edades en Torrijos.
                </h1>

                <p className="text-base sm:text-lg text-[#222222]/80 leading-relaxed max-w-xl">
                  Bienvenido al ecosistema digital oficial de <strong>{CONFIRMADO.nombre}</strong>. Reserva tu clase de prueba gratuita sincronizada con Google Calendar, simula tu presupuesto orientativo en 8 pasos o resuelve tus dudas al instante.
                </p>

                {/* Primary + Secondary CTA Pair */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection('contacto')}
                    className="px-6 py-3.5 rounded-xl bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
                  >
                    Solicitar información
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenTrialBookingForAge()}
                    className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#E8C5C8]/60 text-[#222222] border border-[#5C1329]/25 text-sm font-semibold hover:bg-[#E8C5C8] transition-colors whitespace-nowrap"
                  >
                    <Calendar className="w-4 h-4 text-[#5C1329]" />
                    Reservar clase de prueba gratuita
                  </button>
                </div>

                {/* Unboxed verified summary */}
                <div className="pt-4 border-t border-[#E8C5C8] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#222222]/75">
                  <span>WhatsApp directo: {CONFIRMADO.telefono}</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={CONFIRMADO.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#5C1329] hover:underline inline-flex items-center gap-1"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>{CONFIRMADO.instagramHandle}</span>
                  </a>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleOpenCalculatorForAge()}
                    className="font-semibold text-[#5C1329] hover:underline"
                  >
                    Calcular presupuesto (8 pasos)
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => scrollToSection('clases')}
                    className="font-semibold text-[#5C1329] hover:underline inline-flex items-center gap-1"
                  >
                    Ver clases <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hero 16:9 Editorial Visual with Fallback */}
              <div className="lg:col-span-6">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#E8C5C8] bg-[#E8C5C8]/30">
                  {!imgFailed.hero ? (
                    <img
                      src={ASSETS.heroDanceStudio}
                      alt="Interior luminoso de La Ponte Dance en Torrijos"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed((p) => ({ ...p, hero: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#5C1329] to-[#E8C5C8] text-white">
                      <span className="font-display text-3xl font-semibold">
                        {CONFIRMADO.nombre}
                      </span>
                      <span className="text-xs mt-2 opacity-90">
                        Estudio de Danza en {CONFIRMADO.localidad} ({CONFIRMADO.rangoGeneral})
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                    <div className="text-white space-y-1">
                      <div className="text-xs text-[#E8C5C8]">
                        {CONFIRMADO.localidad} · De {CONFIRMADO.edadMinima} a {CONFIRMADO.edadMaxima} años
                      </div>
                      <p className="font-display text-xl sm:text-2xl font-medium">
                        Un espacio creado para aprender, disfrutar y sentir la danza con cercanía y profesionalidad.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: EL ESTUDIO */}
        <section id="estudio" className="py-16 md:py-24 border-b border-[#E8C5C8]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5">
                <div className="aspect-4/3 rounded-2xl overflow-hidden border border-[#E8C5C8] bg-[#E8C5C8]/25">
                  {!imgFailed.studio ? (
                    <img
                      src={ASSETS.studioInterior}
                      alt="Sala de ensayo de La Ponte Dance en Torrijos"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed((p) => ({ ...p, studio: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-6 text-center text-[#5C1329]">
                      <span className="font-display text-2xl font-semibold">
                        El Estudio · {CONFIRMADO.localidad}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="text-xs font-medium text-[#5C1329]">
                  01. El Estudio · Identidad y Filosofía en {CONFIRMADO.localidad}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#222222]">
                  Pasión por el movimiento, formación cuidada y ambiente inclusivo.
                </h2>
                <p className="text-base text-[#222222]/80 leading-relaxed">
                  <strong>{CONFIRMADO.nombre}</strong> nace en <strong>{CONFIRMADO.localidad}</strong> con una vocación clara: acercar la danza y el baile a cualquier persona que quiera aprender, expresarse o compartir tiempo de calidad, desde los <strong>{CONFIRMADO.edadMinima} hasta los {CONFIRMADO.edadMaxima} años</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="border-l-2 border-[#5C1329] pl-4 space-y-1">
                    <h3 className="text-lg font-semibold text-[#222222]">
                      Datos Confirmados del Estudio
                    </h3>
                    <p className="text-xs text-[#222222]/75 leading-relaxed">
                      Localidad en {CONFIRMADO.localidad}, atención a {CONFIRMADO.publico.join(', ').toLowerCase()} ({CONFIRMADO.rangoGeneral}) y contacto directo en el {CONFIRMADO.telefono}.
                    </p>
                  </div>
                  <div className="border-l-2 border-[#E8C5C8] pl-4 space-y-1">
                    <h3 className="text-lg font-semibold text-[#222222]">
                      Transparencia Informativa
                    </h3>
                    <p className="text-xs text-[#222222]/75 leading-relaxed">
                      La dirección física exacta, el listado cerrado de profesorado y los horarios definitivos están marcados como pendientes de confirmación oficial.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection('contacto')}
                    className="px-5 py-3 rounded-xl bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
                  >
                    Solicitar información
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('clases')}
                    className="px-5 py-3 rounded-xl border border-[#5C1329] text-[#5C1329] text-sm font-semibold hover:bg-[#E8C5C8]/30 transition-colors whitespace-nowrap"
                  >
                    Ver clases
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: CLASES / ACTIVIDADES */}
        <section id="clases" className="py-16 md:py-24 border-b border-[#E8C5C8]/60 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="text-xs font-medium text-[#5C1329]">
                  02. Clases y Actividades · Grupos de {CONFIRMADO.rangoGeneral}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#222222]">
                  Modalidades adaptadas a cada etapa vital.
                </h2>
                <p className="text-sm sm:text-base text-[#222222]/75">
                  Elige tu grupo para <strong>reservar una clase de prueba gratuita sincronizada con Google Calendar</strong> o calcular tu presupuesto orientativo en 8 pasos.
                </p>
              </div>
              <div className="text-xs text-[#5C1329] border-l-2 border-[#5C1329] pl-3 py-1 max-w-xs">
                Nota oficial: {PENDIENTE_DE_CONFIRMAR.catalogoDisciplinas} y {PENDIENTE_DE_CONFIRMAR.horarios}.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {EJEMPLO_NO_OFICIAL.edades.map((grupo, idx) => (
                <div
                  key={grupo.id}
                  className="rounded-2xl border border-[#E8C5C8] bg-[#FBF8F6] overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-16/9 w-full overflow-hidden bg-[#E8C5C8]/30">
                    {!imgFailed[grupo.id] ? (
                      <img
                        src={grupo.imagen}
                        alt={`Clases para ${grupo.label} en La Ponte Dance`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed((p) => ({ ...p, [grupo.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-6 text-[#5C1329] font-display text-2xl">
                        {grupo.label} · {CONFIRMADO.nombre}
                      </div>
                    )}
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#5C1329]">
                        <span>0{idx + 1}. {grupo.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{grupo.rango}</span>
                        <span aria-hidden="true">·</span>
                        <span>Horarios pendientes de confirmar</span>
                      </div>
                      <h3 className="text-2xl font-bold text-[#222222]">{grupo.label}</h3>
                      <p className="text-sm text-[#222222]/80 leading-relaxed">
                        {grupo.descripcion}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-[#E8C5C8]/60">
                      <button
                        type="button"
                        onClick={() => handleOpenTrialBookingForAge(grupo.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs sm:text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
                      >
                        <Calendar className="w-4 h-4" />
                        Reservar clase de prueba
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCalculatorForAge(grupo.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222] text-xs sm:text-sm font-medium hover:border-[#5C1329] transition-colors whitespace-nowrap"
                      >
                        <CalcIcon className="w-4 h-4 text-[#5C1329]" />
                        Calcular presupuesto
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3.2: OPINIONES DE NUESTROS ALUMNOS (CARRUSEL INTERACTIVO) */}
        <section id="opiniones" className="py-16 md:py-24 border-b border-[#E8C5C8]/60 bg-[#FBF8F6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <LazyMount
              fallbackHeight="min-h-[340px]"
              label="Cargando opiniones de nuestros alumnos..."
            >
              <Suspense
                fallback={
                  <div className="min-h-[340px] rounded-2xl border border-[#E8C5C8] bg-white p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                    Cargando carrusel de opiniones...
                  </div>
                }
              >
                <StudentReviewsCarousel
                  onOpenTrialBooking={handleOpenTrialBookingForAge}
                  onOpenCalculator={handleOpenCalculatorForAge}
                />
              </Suspense>
            </LazyMount>
          </div>
        </section>

        {/* SECTION 3.5: RESERVA DE CLASE DE PRUEBA GRATUITA (GOOGLE CALENDAR SYNC) */}
        <section id="clase-prueba" className="py-16 md:py-24 border-b border-[#E8C5C8]/60 bg-[#FBF8F6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <LazyMount
              forceMount={Boolean(preselectedTrialAgeId)}
              fallbackHeight="min-h-[420px]"
              label="Cargando sistema de reserva de Clase de Prueba..."
            >
              <Suspense
                fallback={
                  <div className="min-h-[420px] rounded-2xl border border-[#E8C5C8] bg-white p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                    Cargando módulo de reservas...
                  </div>
                }
              >
                <TrialClassBooking
                  user={user}
                  accessToken={accessToken}
                  onLogin={handleGoogleLogin}
                  isLoggingIn={isLoggingIn}
                  preselectedAgeId={preselectedTrialAgeId}
                  sqlTrialBookings={sqlTrialBookings}
                  firestoreTrialBookings={firestoreTrialBookings}
                  onBookingSavedToSql={(newBooking) =>
                    setSqlTrialBookings((prev) => [newBooking, ...prev])
                  }
                  onBookingCancelledInSql={(cancelledId) =>
                    setSqlTrialBookings((prev) =>
                      prev.map((b) => (b.id === cancelledId ? { ...b, status: 'cancelled' } : b))
                    )
                  }
                />
              </Suspense>
            </LazyMount>
          </div>
        </section>

        {/* SECTION 4: CALCULADORA DE PRESUPUESTO (8 PASOS) */}
        <section id="presupuesto" className="py-16 md:py-24 border-b border-[#E8C5C8]/60 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="space-y-3 text-center max-w-2xl mx-auto">
              <div className="text-xs font-medium text-[#5C1329]">
                03. Planificador Interactivo · Flujo Conectado de 8 Pasos
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#222222]">
                Calculadora de Presupuesto Orientativo
              </h2>
              <p className="text-sm sm:text-base text-[#222222]/75">
                Configura número de alumnos, grupo de edad, actividad, frecuencia y extras. Al finalizar el paso 8 podrás enviar tu resumen directamente por WhatsApp o al formulario de contacto.
              </p>
            </div>

            <LazyMount
              forceMount={Boolean(preselectedAgeId || editingEstimate)}
              fallbackHeight="min-h-[380px]"
              label="Cargando Calculadora de Presupuesto..."
            >
              <Suspense
                fallback={
                  <div className="min-h-[380px] rounded-2xl border border-[#E8C5C8] bg-[#FBF8F6] p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                    Cargando calculadora interactiva...
                  </div>
                }
              >
                <Calculator
                  preselectedAgeId={preselectedAgeId}
                  editingEstimate={editingEstimate}
                  onCancelEditingEstimate={() => setEditingEstimate(null)}
                  onOpenChatbot={handleOpenChatbotTopic}
                  onCompleteToContact={handleCompleteCalculatorToContact}
                  onSaveEstimateToCloud={handleSaveEstimateToCloud}
                  onUpdateEstimateInCloud={handleUpdateEstimateInCloud}
                  onSendViaGmail={handleSendCalculatorViaGmail}
                  isAuthenticated={Boolean(user)}
                />
              </Suspense>
            </LazyMount>
          </div>
        </section>

        {/* SECTION 4.5: MI ESPACIO & GOOGLE WORKSPACE (GMAIL, CALENDAR, CONTACTS, CLOUD SQL & FIRESTORE) */}
        <section id="mi-espacio" className="py-14 border-b border-[#E8C5C8]/60 bg-[#FBF8F6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <LazyMount
              forceMount={Boolean(pendingGmailDraft)}
              fallbackHeight="min-h-[260px]"
              label="Cargando Mi Espacio y Google Workspace..."
            >
              <Suspense
                fallback={
                  <div className="min-h-[260px] rounded-2xl border border-[#E8C5C8] bg-white p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                    Cargando Mi Espacio...
                  </div>
                }
              >
                <WorkspaceHub
                  user={user}
                  accessToken={accessToken}
                  onLogin={handleGoogleLogin}
                  isLoggingIn={isLoggingIn}
                  firestoreSessions={firestoreSessions}
                  sqlEstimates={sqlEstimates}
                  sqlInquiries={sqlInquiries}
                  pendingGmailDraft={pendingGmailDraft}
                  onClearPendingGmailDraft={() => setPendingGmailDraft(null)}
                  onEditEstimateInCalculator={handleEditEstimateInCalculator}
                  onUpdateEstimate={handleUpdateEstimateInCloud}
                  onDeleteEstimate={handleDeleteEstimateFromCloud}
                  onResendEstimateToContact={handleCompleteCalculatorToContact}
                />
              </Suspense>
            </LazyMount>
          </div>
        </section>

        {/* SECTION 5: FAQ (PREGUNTAS FRECUENTES) */}
        <section id="faq" className="py-12 md:py-20 border-b border-[#E8C5C8]/60 bg-[#FBF8F6]">
          <div className="max-w-[768px] mx-auto px-4 py-6">
            <h2 className="text-[#5C1329] text-center text-[1.6rem] sm:text-3xl font-bold mb-6">
              Preguntas Frecuentes
            </h2>

            {faqBlocks.map((block) => (
              <div key={block.category}>
                <div className="text-[0.9rem] font-bold text-[#5C1329] uppercase tracking-[1px] mt-5 mb-2.5">
                  {block.category}
                </div>

                {block.items.map((item) => {
                  const isOpen = openFaqIndex === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-[#5C1329]/12 rounded-[10px] mb-2.5 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : item.id)}
                        className="w-full bg-transparent border-none p-4 text-left text-[0.98rem] font-semibold text-[#222222] cursor-pointer flex justify-between items-center gap-4"
                      >
                        <span>{item.question}</span>
                        <span className="text-[1.2rem] text-[#5C1329] font-bold shrink-0 leading-none">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="bg-[#FBF8F6] px-4 py-3.5 text-[0.9rem] leading-[1.5] text-[#222222] border-t border-[#5C1329]/10">
                          <div>{item.content}</div>
                          <div className="flex flex-wrap items-center gap-4 pt-3 mt-2.5 border-t border-[#E8C5C8]/50">
                            <button
                              type="button"
                              onClick={() => handleOpenChatbotTopic()}
                              className="text-xs font-semibold text-[#5C1329] hover:underline inline-flex items-center gap-1"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              Preguntar al Asistente IA
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTrialBookingForAge()}
                              className="text-xs font-semibold text-[#222222]/75 hover:text-[#5C1329] hover:underline inline-flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Reservar clase de prueba gratuita
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCalculatorForAge()}
                              className="text-xs font-semibold text-[#222222]/75 hover:text-[#5C1329] hover:underline inline-flex items-center gap-1"
                            >
                              <CalcIcon className="w-3.5 h-3.5" />
                              Calcular presupuesto
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 6: CONTACTO */}
        <section id="contacto" className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Official Contact Details */}
              <div className="lg:col-span-5 space-y-6">
                <div className="text-xs font-medium text-[#5C1329]">
                  05. Contacto Oficial · {CONFIRMADO.localidad}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#222222]">
                  Contactar con {CONFIRMADO.nombre}
                </h2>
                <p className="text-sm sm:text-base text-[#222222]/80 leading-relaxed">
                  Estamos a tu disposición en <strong>{CONFIRMADO.localidad}</strong> para orientarte sobre grupos de edad ({CONFIRMADO.rangoGeneral}), confirmar tu clase de prueba gratuita o resolver cualquier consulta.
                </p>

                <div className="space-y-4 pt-2 border-t border-[#E8C5C8]">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-[#5C1329] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#222222]/65">Teléfono y WhatsApp Oficial</div>
                      <a
                        href={generalWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-[#222222] hover:text-[#5C1329] tabular-nums"
                      >
                        {CONFIRMADO.telefono}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-[#5C1329] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#222222]/65">Correo Electrónico</div>
                      <a
                        href={`mailto:${CONFIRMADO.email}`}
                        className="text-base font-semibold text-[#222222] hover:text-[#5C1329]"
                      >
                        {CONFIRMADO.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Instagram className="w-5 h-5 text-[#5C1329] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#222222]/65">Instagram Oficial</div>
                      <a
                        href={CONFIRMADO.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-bold text-[#5C1329] underline hover:opacity-80"
                      >
                        {CONFIRMADO.instagramHandle}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#5C1329] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-[#222222]/65">Localidad</div>
                      <div className="text-base font-semibold text-[#222222]">
                        {CONFIRMADO.localidad}
                      </div>
                      <div className="text-xs text-[#222222]/65 mt-0.5">
                        {PENDIENTE_DE_CONFIRMAR.direccionExacta}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={generalWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Hablar por WhatsApp
                  </a>

                  <a
                    href={CONFIRMADO.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[#5C1329]/30 bg-white text-[#5C1329] text-sm font-semibold hover:bg-[#E8C5C8]/30 transition-colors whitespace-nowrap"
                  >
                    <Instagram className="w-4 h-4" />
                    Ir a {CONFIRMADO.instagramHandle}
                  </a>

                  <button
                    type="button"
                    onClick={() => handleOpenChatbotTopic('contacto')}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[#E8C5C8] bg-white text-[#222222] text-sm font-semibold hover:border-[#5C1329] transition-colors whitespace-nowrap"
                  >
                    <HelpCircle className="w-4 h-4 text-[#5C1329]" />
                    Resolver mis dudas
                  </button>
                </div>
              </div>

              {/* FORMULARIO DE CAPTACIÓN EXPRÉS */}
              <div className="lg:col-span-7">
                <div className="bg-[#FBF8F6] border border-[#E8C5C8] rounded-[16px] px-5 py-10 sm:px-8 max-w-[540px] mx-auto lg:mx-0 lg:max-w-none shadow-xs">
                  <div className="space-y-1.5 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[1.3rem] sm:text-2xl font-bold text-[#5C1329] mt-0">
                        ¿Quieres recibir información de nuestras clases?
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleOpenCalculatorForAge()}
                        className="text-xs font-semibold text-[#5C1329] hover:underline inline-flex items-center gap-1"
                      >
                        <CalcIcon className="w-3.5 h-3.5" />
                        Calcular cuota orientativa
                      </button>
                    </div>
                    <p className="text-sm text-[#222222]/80">
                      Déjanos tus datos y nos pondremos en contacto contigo directamente.
                    </p>
                  </div>

                  <form id="expressLeadForm" onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="flex flex-col text-left">
                      <label
                        htmlFor="leadName"
                        className="text-[0.85rem] font-bold mb-1.5 text-[#222222]"
                      >
                        Nombre de contacto *
                      </label>
                      <input
                        type="text"
                        id="leadName"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Tu nombre o el de tu hijo/a"
                        required
                        className="p-3 rounded-[8px] border border-[#CCCCCC] bg-white text-[0.95rem] text-[#222222] focus:outline-none focus:border-[#5C1329]"
                      />
                    </div>

                    <div className="flex flex-col text-left">
                      <label
                        htmlFor="leadPhone"
                        className="text-[0.85rem] font-bold mb-1.5 text-[#222222]"
                      >
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        id="leadPhone"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Ej: 600000000"
                        required
                        className="p-3 rounded-[8px] border border-[#CCCCCC] bg-white text-[0.95rem] text-[#222222] focus:outline-none focus:border-[#5C1329]"
                      />
                    </div>

                    <div className="flex flex-col text-left">
                      <label
                        htmlFor="leadInterest"
                        className="text-[0.85rem] font-bold mb-1.5 text-[#222222]"
                      >
                        ¿Qué te interesa principal? *
                      </label>
                      <select
                        id="leadInterest"
                        value={contactInterest}
                        onChange={(e) => setContactInterest(e.target.value)}
                        required
                        className="p-3 rounded-[8px] border border-[#CCCCCC] bg-white text-[0.95rem] text-[#222222] focus:outline-none focus:border-[#5C1329]"
                      >
                        <option value="" disabled>
                          Selecciona una opción
                        </option>
                        <option value="Clases Infantiles / Juveniles">
                          Clases Infantiles / Juveniles
                        </option>
                        <option value="Clases para Adultos">Clases para Adultos</option>
                        <option value="Bailes para Bodas y Eventos">
                          Clases especiales para Bodas / Eventos
                        </option>
                        <option value="Información General">Información General</option>
                      </select>
                    </div>

                    {contactMessage && (
                      <div className="flex flex-col text-left">
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="leadSummary"
                            className="text-[0.85rem] font-bold text-[#222222]"
                          >
                            Resumen adjunto de la calculadora (opcional)
                          </label>
                          <button
                            type="button"
                            onClick={() => setContactMessage('')}
                            className="text-xs text-[#5C1329] hover:underline"
                          >
                            Quitar resumen
                          </button>
                        </div>
                        <textarea
                          id="leadSummary"
                          rows={3}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          className="p-3 rounded-[8px] border border-[#CCCCCC] bg-white text-xs text-[#222222] focus:outline-none focus:border-[#5C1329]"
                        />
                      </div>
                    )}

                    {/* Checkbox RGPD obligatorio */}
                    <div className="flex items-start gap-2 text-[0.8rem] mb-5 text-left text-[#222222]/90">
                      <input
                        type="checkbox"
                        id="rgpdConsent"
                        checked={contactConsent}
                        onChange={(e) => setContactConsent(e.target.checked)}
                        required
                        className="mt-0.5 accent-[#5C1329] cursor-pointer"
                      />
                      <label htmlFor="rgpdConsent" className="cursor-pointer">
                        He leído y acepto la{' '}
                        <button
                          type="button"
                          onClick={() => setShowPrivacyModal(true)}
                          className="text-[#5C1329] font-semibold underline hover:opacity-80"
                        >
                          Política de Privacidad
                        </button>
                        .
                      </label>
                    </div>

                    {contactError && (
                      <div className="p-3 rounded-lg bg-[#5C1329]/10 text-[#5C1329] text-xs font-medium">
                        {contactError}
                      </div>
                    )}

                    {contactSubmitted && (
                      <div className="p-4 rounded-xl bg-[#E8C5C8]/45 border border-[#5C1329]/30 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#5C1329]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>¡Solicitud lista para enviar a {CONFIRMADO.nombre}!</span>
                        </div>
                        <p className="text-xs text-[#222222]/85">
                          Si no se ha abierto WhatsApp automáticamente, pulsa aquí para enviar tu mensaje directo:
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={`https://wa.me/34653860324?text=${encodeURIComponent(
                              contactMessage.trim()
                                ? `Hola La Ponte Dance, soy ${contactName.trim()} (${contactPhone.trim()}). Quisiera solicitar información sobre: ${contactInterest}.\n\n${contactMessage.trim()}`
                                : `Hola La Ponte Dance, soy ${contactName.trim()} (${contactPhone.trim()}). Quisiera solicitar información sobre: ${contactInterest}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-95"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Abrir WhatsApp Oficial ({CONFIRMADO.telefono})
                          </a>
                          <a
                            href={`mailto:${CONFIRMADO.email}?subject=${encodeURIComponent(
                              `Solicitud de información: ${contactInterest} — ${contactName}`
                            )}&body=${encodeURIComponent(
                              `Hola La Ponte Dance, soy ${contactName} (${contactPhone}). Quisiera solicitar información sobre: ${contactInterest}.${
                                contactMessage.trim() ? `\n\n${contactMessage.trim()}` : ''
                              }`
                            )}`}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#5C1329] text-[#5C1329] text-xs font-semibold hover:bg-white"
                          >
                            <Mail className="w-4 h-4" />
                            Enviar por Email
                          </a>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-[#5C1329] text-white border-none p-[14px] rounded-[8px] font-bold text-[1rem] cursor-pointer transition-colors hover:bg-[#E8C5C8] hover:text-[#5C1329]"
                    >
                      Solicitar Información Personalizada
                    </button>
                  </form>
                </div>

                {/* Modal informativo de Política de Privacidad */}
                {showPrivacyModal && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                  >
                    <div className="bg-white border border-[#E8C5C8] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
                      <h4 className="text-xl font-bold text-[#5C1329]">
                        Política de Privacidad · {CONFIRMADO.nombre}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#222222]/85 leading-relaxed">
                        Responsable del tratamiento: <strong>{CONFIRMADO.nombre}</strong> ({CONFIRMADO.localidad}). Correo de contacto: <strong>{CONFIRMADO.email}</strong> · Teléfono / WhatsApp: <strong>{CONFIRMADO.telefono}</strong>.
                      </p>
                      <p className="text-xs text-[#222222]/75 leading-relaxed">
                        Finalidad: Atender tu solicitud de información personalizada sobre clases de danza y actividades del estudio. Textos legales definitivos: {CONFIGURACION_LA_PONTE_DANCE.meta.avisoLegalPendiente}.
                      </p>
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setContactConsent(true);
                            setShowPrivacyModal(false);
                          }}
                          className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-bold hover:bg-[#460e1f]"
                        >
                          Aceptar y cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PLANTILLAS OFICIALES DE RESPUESTA PARA WHATSAPP (1 CLIC) */}
            <div className="mt-12">
              <LazyMount
                fallbackHeight="min-h-[340px]"
                label="Cargando plantillas oficiales de WhatsApp..."
              >
                <Suspense
                  fallback={
                    <div className="min-h-[340px] rounded-2xl border border-[#E8C5C8] bg-white p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                      Cargando plantillas de WhatsApp...
                    </div>
                  }
                >
                  <WhatsAppTemplates />
                </Suspense>
              </LazyMount>
            </div>

            {/* Interactive Google Maps Platform Location & Route Calculator */}
            <div className="mt-12">
              <LazyMount
                fallbackHeight="min-h-[420px]"
                label="Cargando mapa interactivo y calculador de rutas en Torrijos..."
              >
                <Suspense
                  fallback={
                    <div className="min-h-[420px] rounded-2xl border border-[#E8C5C8] bg-white p-8 flex items-center justify-center text-xs font-medium text-[#5C1329] animate-pulse">
                      Cargando Google Maps...
                    </div>
                  }
                >
                  <StudioLocationMap />
                </Suspense>
              </LazyMount>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="bg-white border-t border-[#E8C5C8] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-1.5">
            <div className="font-display text-2xl font-bold text-[#5C1329]">
              {CONFIRMADO.nombre}
            </div>
            <p className="text-xs text-[#222222]/75">
              Estudio de danza y clases de baile en {CONFIRMADO.localidad} · De {CONFIRMADO.edadMinima} a {CONFIRMADO.edadMaxima} años
            </p>
            <p className="text-[11px] text-[#222222]/60">
              Aviso Legal · Política de Privacidad · Cookies {CONFIGURACION_LA_PONTE_DANCE.meta.avisoLegalPendiente}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#222222]/80">
            <a href="#inicio" className="hover:text-[#5C1329]">Inicio</a>
            <a href="#estudio" className="hover:text-[#5C1329]">El Estudio</a>
            <a href="#clases" className="hover:text-[#5C1329]">Clases</a>
            <a href="#clase-prueba" className="hover:text-[#5C1329]">Clase de Prueba</a>
            <a href="#presupuesto" className="hover:text-[#5C1329]">Presupuesto</a>
            <a href="#faq" className="hover:text-[#5C1329]">FAQ</a>
            <a href="#contacto" className="hover:text-[#5C1329]">Contacto</a>
            <a
              href={CONFIRMADO.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#5C1329] underline hover:opacity-80"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>{CONFIRMADO.instagramHandle}</span>
            </a>
          </div>
        </div>
      </footer>

      {/* STICKY BOTTOM BAR PARA MÓVIL (<= 768px) */}
      <div className="min-[769px]:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.12)] flex px-[12px] py-[8px] gap-[10px] z-40">
        <a
          href="https://wa.me/34653860324?text=Hola%20La%20Ponte%20Dance,%20quisiera%20solicitar%20informaci%C3%B3n"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-[8px] text-[0.88rem] font-bold no-underline bg-[#25D366] text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          🟢 WhatsApp Directo
        </a>
        <a
          href="#presupuesto"
          onClick={(e) => {
            e.preventDefault();
            handleOpenCalculatorForAge();
          }}
          className="flex-1 flex items-center justify-center rounded-[8px] text-[0.88rem] font-bold no-underline bg-[#5C1329] text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          📊 Calcular Cuota
        </a>
      </div>

      {/* FLOATING CHATBOT (Code-split with React.lazy + Suspense) */}
      <Suspense fallback={null}>
        <Chatbot
          isOpen={chatbotOpen}
          initialTopic={chatbotTopic}
          onToggle={() => setChatbotOpen((o) => !o)}
          onClose={() => setChatbotOpen(false)}
          onGoToCalculator={() => handleOpenCalculatorForAge()}
          onGoToTrialBooking={() => handleOpenTrialBookingForAge()}
          onGoToContact={() => scrollToSection('contacto')}
          onSaveSessionToFirestore={createFirestoreSession}
          isAuthenticated={Boolean(user)}
        />
      </Suspense>

      {/* BANNER DE COOKIES */}
      {!cookiesAccepted && (
        <div
          id="cookieBanner"
          className="fixed bottom-[72px] min-[769px]:bottom-[20px] left-[20px] right-[20px] max-w-[480px] bg-white p-[16px] rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-[#5C1329] z-50"
        >
          <p className="text-[0.82rem] m-0 mb-[12px] text-[#222222] leading-relaxed">
            Utilizamos cookies propias y de terceros para mejorar tu experiencia y analizar la navegación en la web de La Ponte Dance.
          </p>
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleAcceptCookies}
              className="px-[16px] py-[8px] rounded-[6px] border-none font-bold cursor-pointer bg-[#5C1329] text-white text-xs sm:text-sm hover:bg-[#460e1f] transition-colors"
            >
              Aceptar todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
