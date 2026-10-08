import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  XCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { CONFIGURACION_LA_PONTE_DANCE, buildWhatsAppUrl } from '../data/config.ts';
import {
  bookTrialClassOnGoogleCalendar,
  checkCalendarSlotConflict,
  deleteGoogleCalendarEvent,
  listUpcomingCalendarEvents,
  CalendarEventItem,
} from '../lib/workspace.ts';
import {
  createFirestoreTrialBooking,
  cancelFirestoreTrialBooking,
  TrialBookingFirestoreRecord,
  getAuthBearerToken,
} from '../lib/firebase.ts';

interface TrialClassBookingProps {
  user: User | null;
  accessToken: string | null;
  onLogin: () => Promise<{ user: User; accessToken: string } | null>;
  isLoggingIn: boolean;
  preselectedAgeId?: string | null;
  sqlTrialBookings: any[];
  firestoreTrialBookings: TrialBookingFirestoreRecord[];
  onBookingSavedToSql: (booking: any) => void;
  onBookingCancelledInSql: (bookingId: number) => void;
}

const TIME_SLOTS = [
  { time: '11:00', label: '11:00 h (Mañana orientativa)' },
  { time: '17:00', label: '17:00 h (Tarde — Infantil / Jóvenes)' },
  { time: '18:00', label: '18:00 h (Tarde — Jóvenes / Adultos)' },
  { time: '19:00', label: '19:00 h (Tarde — Adultos / Parejas)' },
  { time: '20:00', label: '20:00 h (Tarde / Noche — Adultos / Parejas)' },
];

export const TrialClassBooking: React.FC<TrialClassBookingProps> = ({
  user,
  accessToken,
  onLogin,
  isLoggingIn,
  preselectedAgeId,
  sqlTrialBookings,
  firestoreTrialBookings,
  onBookingSavedToSql,
  onBookingCancelledInSql,
}) => {
  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR, EJEMPLO_NO_OFICIAL } =
    CONFIGURACION_LA_PONTE_DANCE;

  const [studentName, setStudentName] = useState<string>('');
  const [studentPhone, setStudentPhone] = useState<string>('');
  const [ageId, setAgeId] = useState<string>('adultos');
  const [activityId, setActivityId] = useState<string>('danza-estudio');
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState<string>('18:00');
  const [notes, setNotes] = useState<string>('');
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);

  // Real-time Google Calendar availability & live upcoming events state
  const [checkingConflict, setCheckingConflict] = useState<boolean>(false);
  const [conflictEvents, setConflictEvents] = useState<CalendarEventItem[]>([]);
  const [liveCalendarEvents, setLiveCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [loadingLiveCalendar, setLoadingLiveCalendar] = useState<boolean>(false);

  // Mandatory explicit confirmation modal before mutating Google Calendar
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [bookingToCancel, setBookingToCancel] = useState<{
    sqlId?: number;
    firestoreId?: string;
    calendarEventId?: string | null;
    summaryLabel: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastBookedResult, setLastBookedResult] = useState<{
    studentName: string;
    ageGroup: string;
    activity: string;
    preferredDate: string;
    preferredTime: string;
    calendarEvent: CalendarEventItem;
  } | null>(null);

  useEffect(() => {
    if (user?.displayName && !studentName) {
      setStudentName(user.displayName);
    }
  }, [user]);

  useEffect(() => {
    if (preselectedAgeId) {
      setAgeId(preselectedAgeId);
    }
  }, [preselectedAgeId]);

  const refreshLiveCalendarEvents = async (tokenOverride?: string | null) => {
    const tokenToUse = tokenOverride || accessToken;
    if (!tokenToUse) return;
    setLoadingLiveCalendar(true);
    try {
      const items = await listUpcomingCalendarEvents(tokenToUse);
      setLiveCalendarEvents(items);
    } catch {
      // Ignore silent background refresh errors
    } finally {
      setLoadingLiveCalendar(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      void refreshLiveCalendarEvents(accessToken);
    } else {
      setLiveCalendarEvents([]);
    }
  }, [accessToken]);

  // Check user's Google Calendar for conflicts whenever date/time changes and accessToken is present
  useEffect(() => {
    let active = true;
    if (!accessToken || !preferredDate || !preferredTime) {
      setConflictEvents([]);
      return;
    }
    setCheckingConflict(true);
    checkCalendarSlotConflict(preferredDate, preferredTime, accessToken)
      .then((res) => {
        if (active) {
          setConflictEvents(res.conflictingEvents);
        }
      })
      .catch(() => {
        if (active) setConflictEvents([]);
      })
      .finally(() => {
        if (active) setCheckingConflict(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, preferredDate, preferredTime]);

  const selectedAge =
    EJEMPLO_NO_OFICIAL.edades.find((e) => e.id === ageId) || EJEMPLO_NO_OFICIAL.edades[0];
  const selectedActivity =
    EJEMPLO_NO_OFICIAL.actividadesOrientativas.find((a) => a.id === activityId) ||
    EJEMPLO_NO_OFICIAL.actividadesOrientativas[0];

  const handleRequestBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!studentName.trim()) {
      setFormError('Por favor, indica el nombre del alumno/a.');
      return;
    }
    if (!studentPhone.trim() || studentPhone.trim().length < 6) {
      setFormError('Por favor, indica un teléfono o WhatsApp válido (mínimo 6 dígitos).');
      return;
    }
    if (!preferredDate || !preferredTime) {
      setFormError('Selecciona una fecha y franja horaria orientativa.');
      return;
    }
    if (!privacyAccepted) {
      setFormError('Debes aceptar la casilla de protección de datos antes de reservar.');
      return;
    }

    // Open mandatory user confirmation dialog before creating event in Google Calendar
    setShowConfirmModal(true);
  };

  const handleConfirmAndSyncCalendar = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      let activeUser = user;
      let activeToken = accessToken;

      // If the user hasn't connected Google Calendar yet (or reloaded the page), authenticate automatically now
      if (!activeUser || !activeToken) {
        const loginResult = await onLogin();
        if (!loginResult || !loginResult.accessToken) {
          throw new Error(
            'Es necesario autorizar el acceso a tu cuenta de Google para añadir automáticamente la reserva a tu Google Calendar.'
          );
        }
        activeUser = loginResult.user;
        activeToken = loginResult.accessToken;
      }

      // 1. Automatically add event to the user's Google Calendar via Google Calendar API
      const createdCalendarEvent = await bookTrialClassOnGoogleCalendar({
        studentName: studentName.trim(),
        studentPhone: studentPhone.trim(),
        ageGroup: selectedAge.label,
        activity: selectedActivity.label,
        preferredDate,
        preferredTime,
        notes: notes.trim(),
        accessToken: activeToken,
      });

      // 2. Save in Firestore (/trialBookings/{bookingId})
      try {
        await createFirestoreTrialBooking({
          studentName: studentName.trim(),
          studentPhone: studentPhone.trim(),
          ageGroup: selectedAge.label,
          activity: selectedActivity.label,
          preferredDate,
          preferredTime,
          calendarEventId: createdCalendarEvent.id,
        });
      } catch (fsErr) {
        console.warn('Firestore trialBooking save warning:', fsErr);
      }

      // 3. Save in Cloud SQL (/api/trial-bookings)
      try {
        const bearerToken = await getAuthBearerToken(activeUser);
        const sqlRes = await fetch('/api/trial-bookings', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            studentName: studentName.trim(),
            studentPhone: studentPhone.trim(),
            ageGroup: selectedAge.label,
            activity: selectedActivity.label,
            preferredDate,
            preferredTime,
            calendarEventId: createdCalendarEvent.id,
            calendarHtmlLink: createdCalendarEvent.htmlLink,
            notes: notes.trim(),
          }),
        });

        if (sqlRes.ok) {
          const savedSql = await sqlRes.json();
          onBookingSavedToSql(savedSql);
        }
      } catch (sqlErr) {
        console.warn('Cloud SQL trialBooking save warning:', sqlErr);
      }

      // 4. Refresh live Google Calendar events list so the user sees it immediately
      await refreshLiveCalendarEvents(activeToken);

      setLastBookedResult({
        studentName: studentName.trim(),
        ageGroup: selectedAge.label,
        activity: selectedActivity.label,
        preferredDate,
        preferredTime,
        calendarEvent: createdCalendarEvent,
      });
      setShowConfirmModal(false);
    } catch (err: any) {
      setFormError(
        err.message ||
          'No se pudo añadir automáticamente la reserva a Google Calendar. Comprueba los permisos de tu cuenta de Google.'
      );
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      let activeUser = user;
      let activeToken = accessToken;

      if (bookingToCancel.calendarEventId && !activeToken) {
        const loginResult = await onLogin();
        if (loginResult) {
          activeUser = loginResult.user;
          activeToken = loginResult.accessToken;
        }
      }

      if (bookingToCancel.calendarEventId && activeToken) {
        await deleteGoogleCalendarEvent(bookingToCancel.calendarEventId, activeToken);
      }
      if (bookingToCancel.firestoreId) {
        await cancelFirestoreTrialBooking(bookingToCancel.firestoreId);
      }
      if (bookingToCancel.sqlId && activeUser) {
        const bearerToken = await getAuthBearerToken(activeUser);
        const res = await fetch(`/api/trial-bookings/${bookingToCancel.sqlId}/cancel`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { Authorization: `Bearer ${bearerToken}` },
        });
        if (res.ok) {
          onBookingCancelledInSql(bookingToCancel.sqlId);
        }
      }
      if (activeToken) {
        await refreshLiveCalendarEvents(activeToken);
      }
      setBookingToCancel(null);
    } catch (err: any) {
      setFormError(err.message || 'No se pudo cancelar la reserva en Google Calendar.');
      setBookingToCancel(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8C5C8] rounded-2xl p-6 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E8C5C8]/60">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5C1329]">
            <span>Sincronización automática con Google Calendar API</span>
            <span aria-hidden="true">·</span>
            <span>{CONFIRMADO.nombre} ({CONFIRMADO.localidad})</span>
            <span aria-hidden="true">·</span>
            <span>Sin coste ni compromiso</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#222222]">
            Reserva tu Clase de Prueba Gratuita
          </h3>
          <p className="text-sm text-[#222222]/75 leading-relaxed">
            Completa tus datos y elige fecha y franja preferida. Al confirmar la reserva, el evento se <strong>añadirá automáticamente a tu Google Calendar</strong> mediante Google Calendar API (con recordatorio automático e invitación a <strong>{CONFIRMADO.email}</strong>).
          </p>
        </div>

        {!user || !accessToken ? (
          <div className="bg-[#FBF8F6] border border-[#E8C5C8] rounded-xl p-4 flex flex-col items-start sm:items-center gap-2.5 shrink-0">
            <span className="text-xs font-medium text-[#222222]/80">
              Conecta Google Calendar ahora o al confirmar tu reserva:
            </span>
            <button
              type="button"
              onClick={() => void onLogin()}
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
          </div>
        ) : (
          <div className="bg-[#FBF8F6] border border-[#E8C5C8] rounded-xl px-4 py-3 text-xs text-[#222222]/80 shrink-0">
            <div className="font-semibold text-[#5C1329] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Google Calendar conectado y listo
            </div>
            <div className="mt-0.5">{user.email}</div>
          </div>
        )}
      </div>

      {/* Main Booking Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <form onSubmit={handleRequestBooking} className="lg:col-span-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#222222] mb-1.5">
                Nombre del alumno/a *
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#222222] mb-1.5">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                placeholder="Ej. 600 000 000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
              />
            </div>
          </div>

          {/* Age Group Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#222222] mb-2">
              Grupo de edad ({CONFIRMADO.rangoGeneral}) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {EJEMPLO_NO_OFICIAL.edades.map((item) => {
                const active = ageId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAgeId(item.id)}
                    className={`min-h-[48px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors text-center ${
                      active
                        ? 'bg-[#5C1329] text-white border-[#5C1329]'
                        : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#222222] mb-1.5">
              Modalidad orientativa ({PENDIENTE_DE_CONFIRMAR.catalogoDisciplinas}) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EJEMPLO_NO_OFICIAL.actividadesOrientativas.map((act) => {
                const active = activityId === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActivityId(act.id)}
                    className={`p-3 rounded-xl text-left text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-[#5C1329] text-white border-[#5C1329]'
                        : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                    }`}
                  >
                    {act.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date and Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#222222] mb-1.5">
                Fecha preferida para la prueba *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={preferredDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#222222] mb-1.5">
                Franja horaria preferida *
              </label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.time} value={slot.time}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-Time Google Calendar Availability / Conflict Status */}
          {accessToken && (
            <div className="p-3.5 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] text-xs">
              {checkingConflict ? (
                <span className="text-[#222222]/70">
                  Comprobando disponibilidad en tu Google Calendar para el {preferredDate} a las {preferredTime}...
                </span>
              ) : conflictEvents.length > 0 ? (
                <div className="flex items-start gap-2 text-[#5C1329]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Aviso de agenda:</strong> Ya tienes {conflictEvents.length} evento(s) en tu Google Calendar en esa franja ({conflictEvents.map((e) => e.summary).join(', ')}). Puedes elegir otra hora o continuar igualmente.
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#222222]/80">
                  <CheckCircle2 className="w-4 h-4 text-[#5C1329] shrink-0" />
                  <span>
                    Franja libre en tu Google Calendar ({preferredDate} · {preferredTime} h). Nota: {PENDIENTE_DE_CONFIRMAR.horarios}.
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#222222] mb-1.5">
              Observaciones o experiencia previa (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Nivel iniciación, vamos en pareja, preferencia de día..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[#222222]/80 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 accent-[#5C1329]"
            />
            <span>
              Acepto que {CONFIRMADO.nombre} gestione mi solicitud de clase de prueba gratuita y se añada automáticamente el evento a mi Google Calendar ({CONFIRMADO.email}). {CONFIGURACION_LA_PONTE_DANCE.meta.avisoLegalPendiente}.
            </span>
          </label>

          {formError && (
            <div className="p-3 rounded-lg bg-[#5C1329]/10 text-[#5C1329] text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || isLoggingIn}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
            >
              <Calendar className="w-4 h-4" />
              {isSubmitting
                ? 'Añadiendo a tu Google Calendar...'
                : 'Reservar clase de prueba y añadir a Google Calendar'}
            </button>
          </div>
        </form>

        {/* Right Column: Confirmation Card, Synced Bookings & Live Calendar Feed */}
        <div className="lg:col-span-5 space-y-5">
          {lastBookedResult && (
            <div className="p-5 rounded-2xl bg-[#FBF8F6] border-2 border-[#5C1329] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C1329]">
                <Sparkles className="w-4 h-4" />
                <span>¡Evento Añadido a tu Google Calendar!</span>
              </div>
              <div className="space-y-1 text-xs text-[#222222]/85">
                <div>
                  <strong>Evento:</strong> {lastBookedResult.calendarEvent.summary}
                </div>
                <div>
                  <strong>Alumno/a:</strong> {lastBookedResult.studentName}
                </div>
                <div>
                  <strong>Grupo y modalidad:</strong> {lastBookedResult.ageGroup} · {lastBookedResult.activity}
                </div>
                <div>
                  <strong>Fecha y hora en calendario:</strong> {lastBookedResult.preferredDate} a las {lastBookedResult.preferredTime} h (Europe/Madrid)
                </div>
                <div>
                  <strong>Estudio invitado:</strong> {CONFIRMADO.email} ({CONFIRMADO.nombre})
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                {lastBookedResult.calendarEvent.htmlLink && (
                  <a
                    href={lastBookedResult.calendarEvent.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir evento en mi Google Calendar
                  </a>
                )}
                <a
                  href={buildWhatsAppUrl(
                    `Hola ${CONFIRMADO.nombre}, acabo de reservar una Clase de Prueba Gratuita sincronizada en Google Calendar:\n• Alumno/a: ${lastBookedResult.studentName}\n• Grupo: ${lastBookedResult.ageGroup}\n• Fecha solicitada: ${lastBookedResult.preferredDate} a las ${lastBookedResult.preferredTime} h\nQuedo a la espera de vuestra confirmación de horario definitivo.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#5C1329] text-[#5C1329] text-xs font-semibold hover:bg-white"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Confirmar por WhatsApp ({CONFIRMADO.telefono})
                </a>
              </div>
            </div>
          )}

          {/* User's Synced Trial Bookings */}
          <div className="p-5 rounded-2xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5C1329]" />
              Tus Clases de Prueba Reservadas ({sqlTrialBookings.length})
            </h4>

            {sqlTrialBookings.length === 0 ? (
              <p className="text-xs text-[#222222]/65 leading-relaxed">
                Todavía no tienes reservas de clase de prueba registradas. Al completar el formulario, tu reserva se añadirá automáticamente a tu Google Calendar y aparecerá aquí.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sqlTrialBookings.map((booking) => {
                  const matchingFs = firestoreTrialBookings.find(
                    (f) => f.calendarEventId === booking.calendarEventId
                  );
                  const isCancelled = booking.status === 'cancelled';
                  return (
                    <div
                      key={booking.id}
                      className="p-3.5 rounded-xl bg-white border border-[#E8C5C8] space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-[#222222]">
                            {booking.studentName} · {booking.ageGroup}
                          </div>
                          <div className="text-[#5C1329] font-medium tabular-nums">
                            {booking.preferredDate} a las {booking.preferredTime} h
                          </div>
                          <div className="text-[#222222]/65">{booking.activity}</div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            isCancelled ? 'text-[#222222]/45 line-through' : 'text-[#5C1329]'
                          }`}
                        >
                          {isCancelled ? 'Cancelada' : 'En Google Calendar'}
                        </span>
                      </div>

                      {!isCancelled && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8C5C8]/50">
                          {booking.calendarHtmlLink ? (
                            <a
                              href={booking.calendarHtmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#5C1329] font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver en Google Calendar
                            </a>
                          ) : (
                            <span className="text-[#222222]/50">Sincronizado con Calendar</span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setBookingToCancel({
                                sqlId: booking.id,
                                firestoreId: matchingFs?.id,
                                calendarEventId: booking.calendarEventId,
                                summaryLabel: `${booking.studentName} (${booking.preferredDate} · ${booking.preferredTime} h)`,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[#222222]/65 hover:text-[#5C1329]"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancelar reserva
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Google Calendar Events Feed */}
          {accessToken && (
            <div className="p-5 rounded-2xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#222222] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#5C1329]" />
                  Próximos eventos en tu Google Calendar
                </h4>
                <button
                  type="button"
                  onClick={() => void refreshLiveCalendarEvents()}
                  disabled={loadingLiveCalendar}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C1329] hover:underline"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLiveCalendar ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
              {liveCalendarEvents.length === 0 ? (
                <p className="text-xs text-[#222222]/65">
                  No hay eventos próximos en tu calendario principal.
                </p>
              ) : (
                <div className="space-y-2">
                  {liveCalendarEvents.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-white border border-[#E8C5C8]/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#222222] truncate">{ev.summary}</div>
                        <div className="text-[11px] text-[#222222]/65 tabular-nums">
                          {ev.start ? new Date(ev.start).toLocaleString('es-ES') : ''}
                        </div>
                      </div>
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5C1329] font-semibold hover:underline shrink-0 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MANDATORY CONFIRMATION DIALOG FOR CREATING GOOGLE CALENDAR EVENT */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E8C5C8] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-xl font-semibold text-[#222222]">
              ¿Confirmar reserva y añadir a tu Google Calendar?
            </h4>
            <p className="text-sm text-[#222222]/80 leading-relaxed">
              Se añadirá automáticamente el evento <strong>"Clase de Prueba Gratuita — {CONFIRMADO.nombre} ({selectedAge.label})"</strong> a tu Google Calendar para el día <strong>{preferredDate}</strong> a las <strong>{preferredTime} h</strong> y se enviará invitación al calendario oficial de <strong>{CONFIRMADO.nombre} ({CONFIRMADO.email})</strong>.
            </p>
            {(!user || !accessToken) && (
              <div className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] text-xs text-[#5C1329]">
                Al pulsar en confirmar se abrirá la ventana de acceso de Google para autorizar la inserción automática en tu Google Calendar.
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E8C5C8] text-xs font-semibold text-[#222222] hover:bg-[#FBF8F6]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAndSyncCalendar}
                className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f]"
              >
                {isSubmitting ? 'Añadiendo a Google Calendar...' : 'Confirmar y añadir a Google Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG FOR CANCELLING/DELETING GOOGLE CALENDAR EVENT */}
      {bookingToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E8C5C8] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-xl font-semibold text-[#222222]">
              ¿Cancelar clase de prueba y eliminar de Google Calendar?
            </h4>
            <p className="text-sm text-[#222222]/80 leading-relaxed">
              Se eliminará el evento de tu Google Calendar y se marcará como cancelada la reserva de <strong>{bookingToCancel.summaryLabel}</strong>.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setBookingToCancel(null)}
                className="px-4 py-2 rounded-lg border border-[#E8C5C8] text-xs font-semibold text-[#222222] hover:bg-[#FBF8F6]"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCancelBooking}
                className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f]"
              >
                {isSubmitting ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
