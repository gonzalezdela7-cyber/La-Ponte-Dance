import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Mail,
  Users,
  Trash2,
  Archive,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  ExternalLink,
  Eye,
  Edit3,
  MessageCircle,
  Calculator as CalcIcon,
  Send,
  Save,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ChatSessionRecord,
  archiveFirestoreSession,
  deleteFirestoreSession,
} from '../lib/firebase.ts';
import {
  CalendarEventItem,
  ContactItem,
  GmailMessageSummary,
  DriveFileItem,
  SheetPreviewData,
  GoogleDocDetail,
  GoogleFormDetail,
  createStudioCalendarEvent,
  listGoogleContacts,
  listRecentGmailMessages,
  listUpcomingCalendarEvents,
  saveLaPonteDanceToGoogleContacts,
  sendGmailInquiry,
  listUserSpreadsheets,
  readSpreadsheetPreview,
  exportLaPonteRecordsToGoogleSheets,
  listUserGoogleDocs,
  readGoogleDocSummary,
  createLaPonteDossierGoogleDoc,
  listUserGoogleForms,
  getGoogleFormDetails,
  createLaPonteInquiryGoogleForm,
} from '../lib/workspace.ts';
import {
  CONFIGURACION_LA_PONTE_DANCE,
  ModalidadPago,
  calcularPresupuestoLaPonte,
  buildWhatsAppUrl,
} from '../data/config.ts';
import { CalculatorSummaryPayload } from './Calculator.tsx';

type WorkspaceTab =
  | 'records'
  | 'calendar'
  | 'gmail'
  | 'contacts'
  | 'sheets'
  | 'docs'
  | 'forms';

interface WorkspaceHubProps {
  user: User | null;
  accessToken: string | null;
  onLogin: () => Promise<any>;
  isLoggingIn: boolean;
  firestoreSessions: ChatSessionRecord[];
  sqlEstimates: any[];
  sqlInquiries: any[];
  pendingGmailDraft?: { subject: string; body: string } | null;
  onClearPendingGmailDraft?: () => void;
  onEditEstimateInCalculator?: (estimate: any) => void;
  onUpdateEstimate?: (estimateId: number, payload: CalculatorSummaryPayload) => Promise<void>;
  onDeleteEstimate?: (estimateId: number) => Promise<void>;
  onResendEstimateToContact?: (payload: CalculatorSummaryPayload) => void;
}

interface ConfirmationDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({
  user,
  accessToken,
  onLogin,
  isLoggingIn,
  firestoreSessions,
  sqlEstimates,
  sqlInquiries,
  pendingGmailDraft,
  onClearPendingGmailDraft,
  onEditEstimateInCalculator,
  onUpdateEstimate,
  onDeleteEstimate,
  onResendEstimateToContact,
}) => {
  const { CONFIRMADO, EJEMPLO_NO_OFICIAL } = CONFIGURACION_LA_PONTE_DANCE;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('records');
  const [historyFilterAge, setHistoryFilterAge] = useState<string>('todos');
  const [editingEstId, setEditingEstId] = useState<number | null>(null);
  const [editStudentCount, setEditStudentCount] = useState<number>(1);
  const [editAgeGroup, setEditAgeGroup] = useState<string>('');
  const [editActivity, setEditActivity] = useState<string>('');
  const [editFrequency, setEditFrequency] = useState<string>('');
  const [editExtras, setEditExtras] = useState<string>('');
  const [editContactName, setEditContactName] = useState<string>('');
  const [editContactPhone, setEditContactPhone] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingInlineEdit, setIsSavingInlineEdit] = useState<boolean>(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  // Google Sheets state
  const [spreadsheets, setSpreadsheets] = useState<DriveFileItem[]>([]);
  const [selectedSheetPreview, setSelectedSheetPreview] = useState<SheetPreviewData | null>(
    null
  );
  const [newSheetTitle, setNewSheetTitle] = useState<string>(
    `${CONFIRMADO.nombre} — Registro de Presupuestos (${CONFIRMADO.localidad})`
  );

  // Google Docs state
  const [docsList, setDocsList] = useState<DriveFileItem[]>([]);
  const [selectedDocDetail, setSelectedDocDetail] = useState<GoogleDocDetail | null>(null);
  const [newDocTitle, setNewDocTitle] = useState<string>(
    `Dossier Personalizado — ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`
  );
  const [newDocNotes, setNewDocNotes] = useState<string>(
    `Interesado/a en recibir confirmación de horarios y tarifas oficiales en ${CONFIRMADO.localidad}.`
  );

  // Google Forms state
  const [formsList, setFormsList] = useState<DriveFileItem[]>([]);
  const [selectedFormDetail, setSelectedFormDetail] = useState<GoogleFormDetail | null>(null);
  const [newFormTitle, setNewFormTitle] = useState<string>(
    `Pre-inscripción y Preferencias — ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`
  );

  const [loadingWorkspace, setLoadingWorkspace] = useState<boolean>(false);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Calendar new event form
  const [eventTitle, setEventTitle] = useState<string>(
    'Visita / Consulta La Ponte Dance (Torrijos)'
  );
  const [eventDate, setEventDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [eventTime, setEventTime] = useState<string>('18:00');

  // Gmail compose form
  const [mailSubject, setMailSubject] = useState<string>(
    `Solicitud de información — ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`
  );
  const [mailBody, setMailBody] = useState<string>(
    `Hola ${CONFIRMADO.nombre},\n\nMe gustaría recibir información sobre vuestras clases en ${CONFIRMADO.localidad} cuando estén confirmados los horarios y tarifas.\n\nUn saludo.`
  );

  // Mandatory Explicit Confirmation Modal State for mutating Workspace/Firestore operations
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialogState | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (pendingGmailDraft) {
      setActiveTab('gmail');
      setMailSubject(pendingGmailDraft.subject);
      setMailBody(pendingGmailDraft.body);
      if (onClearPendingGmailDraft) onClearPendingGmailDraft();
    }
  }, [pendingGmailDraft]);

  const loadWorkspaceTab = async (tab: Exclude<WorkspaceTab, 'records'>) => {
    if (!accessToken) return;
    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      if (tab === 'calendar') {
        const items = await listUpcomingCalendarEvents();
        setCalendarEvents(items);
      } else if (tab === 'gmail') {
        const msgs = await listRecentGmailMessages();
        setGmailMessages(msgs);
      } else if (tab === 'contacts') {
        const list = await listGoogleContacts();
        setContacts(list);
      } else if (tab === 'sheets') {
        const files = await listUserSpreadsheets();
        setSpreadsheets(files);
      } else if (tab === 'docs') {
        const files = await listUserGoogleDocs();
        setDocsList(files);
      } else if (tab === 'forms') {
        const files = await listUserGoogleForms();
        setFormsList(files);
      }
    } catch (err: any) {
      setWorkspaceError(err.message || 'No se pudo sincronizar con Google Workspace.');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    if (accessToken && activeTab !== 'records') {
      void loadWorkspaceTab(activeTab);
    }
  }, [activeTab, accessToken]);

  const handlePreviewSheet = async (spreadsheetId: string, tabName?: string) => {
    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      const preview = await readSpreadsheetPreview(spreadsheetId, tabName);
      setSelectedSheetPreview(preview);
    } catch (err: any) {
      setWorkspaceError(err.message || 'No se pudo previsualizar la hoja de cálculo.');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handlePreviewDoc = async (documentId: string) => {
    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      const detail = await readGoogleDocSummary(documentId);
      setSelectedDocDetail(detail);
    } catch (err: any) {
      setWorkspaceError(err.message || 'No se pudo leer el documento.');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handlePreviewForm = async (formId: string) => {
    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      const detail = await getGoogleFormDetails(formId);
      setSelectedFormDetail(detail);
    } catch (err: any) {
      setWorkspaceError(err.message || 'No se pudo consultar el formulario.');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const requestCreateCalendarEvent = () => {
    setConfirmDialog({
      title: '¿Crear recordatorio en tu Google Calendar?',
      description: `Se añadirá el evento "${eventTitle}" el día ${eventDate} a las ${eventTime} en tu calendario principal de Google Calendar con ubicación en ${CONFIRMADO.localidad}.`,
      confirmLabel: 'Confirmar y crear evento',
      onConfirm: async () => {
        const created = await createStudioCalendarEvent({
          title: eventTitle,
          date: eventDate,
          time: eventTime,
          description: `Recordatorio de contacto con ${CONFIRMADO.nombre} (${CONFIRMADO.telefono} · ${CONFIRMADO.email}).`,
        });
        setCalendarEvents((prev) => [created, ...prev]);
        setWorkspaceFeedback('Evento creado en tu Google Calendar.');
      },
    });
  };

  const requestSendGmail = () => {
    setConfirmDialog({
      title: '¿Enviar correo electrónico desde tu cuenta de Gmail?',
      description: `Se enviará un correo en tu nombre a ${CONFIRMADO.email} con el asunto "${mailSubject}".`,
      confirmLabel: 'Confirmar y enviar correo',
      onConfirm: async () => {
        await sendGmailInquiry({
          to: CONFIRMADO.email,
          subject: mailSubject,
          body: mailBody,
        });
        setWorkspaceFeedback(
          `Correo enviado correctamente a ${CONFIRMADO.email} mediante Gmail.`
        );
      },
    });
  };

  const requestSaveStudioContact = () => {
    setConfirmDialog({
      title: '¿Guardar a La Ponte Dance en tus Contactos de Google?',
      description: `Se creará un contacto nuevo con el nombre "${CONFIRMADO.nombre}", teléfono ${CONFIRMADO.telefono} y correo ${CONFIRMADO.email} en tu agenda de Google Contacts.`,
      confirmLabel: 'Confirmar y guardar contacto',
      onConfirm: async () => {
        const created = await saveLaPonteDanceToGoogleContacts();
        setContacts((prev) => [created, ...prev]);
        setWorkspaceFeedback(
          'Contacto oficial de La Ponte Dance añadido a tu Google Contacts.'
        );
      },
    });
  };

  const requestExportToGoogleSheets = () => {
    setConfirmDialog({
      title: '¿Crear hoja de cálculo en tu Google Sheets?',
      description: `Se creará una nueva hoja de cálculo titulada "${newSheetTitle}" en tu cuenta de Google Sheets con tus ${sqlEstimates.length} simulaciones (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria}) y ${sqlInquiries.length} consultas registradas.`,
      confirmLabel: 'Confirmar y exportar a Google Sheets',
      onConfirm: async () => {
        const created = await exportLaPonteRecordsToGoogleSheets({
          sheetTitle: newSheetTitle,
          estimates: sqlEstimates,
          inquiries: sqlInquiries,
        });
        setSpreadsheets((prev) => [
          {
            id: created.spreadsheetId,
            name: created.title,
            webViewLink: created.spreadsheetUrl,
          },
          ...prev,
        ]);
        const preview = await readSpreadsheetPreview(created.spreadsheetId);
        setSelectedSheetPreview(preview);
        setWorkspaceFeedback(
          `Hoja "${created.title}" creada y sincronizada en Google Sheets.`
        );
      },
    });
  };

  const requestCreateGoogleDoc = () => {
    setConfirmDialog({
      title: '¿Crear documento personalizado en tu Google Docs?',
      description: `Se creará un documento nuevo titulado "${newDocTitle}" en tu Google Docs con los datos confirmados de ${CONFIRMADO.nombre}, los puntos pendientes de confirmar y tus simulaciones de presupuesto (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria}).`,
      confirmLabel: 'Confirmar y crear Google Doc',
      onConfirm: async () => {
        const created = await createLaPonteDossierGoogleDoc({
          docTitle: newDocTitle,
          customNotes: newDocNotes,
          estimates: sqlEstimates,
        });
        setDocsList((prev) => [
          {
            id: created.documentId,
            name: created.title,
            webViewLink: created.documentUrl,
          },
          ...prev,
        ]);
        setSelectedDocDetail(created);
        setWorkspaceFeedback(`Documento "${created.title}" generado en tu Google Docs.`);
      },
    });
  };

  const requestCreateGoogleForm = () => {
    setConfirmDialog({
      title: '¿Crear formulario en tu Google Forms?',
      description: `Se creará un formulario interactivo titulado "${newFormTitle}" en tu cuenta de Google Forms con preguntas sobre grupo de edad (${CONFIRMADO.rangoGeneral}), frecuencia y datos de contacto.`,
      confirmLabel: 'Confirmar y crear Google Form',
      onConfirm: async () => {
        const created = await createLaPonteInquiryGoogleForm({
          formTitle: newFormTitle,
        });
        setFormsList((prev) => [
          {
            id: created.formId,
            name: created.title,
            webViewLink: created.editUri,
          },
          ...prev,
        ]);
        setSelectedFormDetail(created);
        setWorkspaceFeedback(`Formulario "${created.title}" creado en tu Google Forms.`);
      },
    });
  };

  const requestDeleteSession = (session: ChatSessionRecord) => {
    setConfirmDialog({
      title: '¿Eliminar esta nota guardada?',
      description: `Se eliminará permanentemente la consulta guardada sobre "${session.topic}".`,
      confirmLabel: 'Confirmar eliminación',
      onConfirm: async () => {
        await deleteFirestoreSession(session.id);
        setWorkspaceFeedback('Consulta eliminada correctamente.');
      },
    });
  };

  const buildPayloadFromEstimate = (est: any): CalculatorSummaryPayload => {
    const formattedSummary = [
      `Hola ${CONFIRMADO.nombre}, te reenvío mi simulación de presupuesto (#${est.id}) desde Mi Espacio:`,
      `• Nº Alumnos: ${est.studentCount} alumno(s)`,
      `• Grupo de edad: ${est.ageGroup}`,
      `• Actividad orientativa: ${est.activity}`,
      `• Frecuencia: ${est.frequency}`,
      `• Extras: ${est.extras}`,
      `• Estimación prototipo: ${est.estimatedAmount} €/mes (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria})`,
      est.contactName ? `• Nombre: ${est.contactName}` : '',
      est.contactPhone ? `• Teléfono: ${est.contactPhone}` : '',
      est.notes ? `• Notas: ${est.notes}` : '',
      `Me gustaría recibir información sobre disponibilidad y tarifas oficiales cuando estén confirmadas.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      studentCount: Number(est.studentCount) || 1,
      studentLabel: `${est.studentCount} alumno(s)`,
      ageGroup: est.ageGroup,
      activity: est.activity,
      frequency: est.frequency,
      extras: est.extras,
      estimatedAmount: Number(est.estimatedAmount) || 0,
      contactName: est.contactName || user?.displayName || '',
      contactPhone: est.contactPhone || '',
      notes: est.notes || '',
      formattedSummary,
    };
  };

  const startInlineEdit = (est: any) => {
    setEditingEstId(est.id);
    setEditStudentCount(Number(est.studentCount) || 1);
    setEditAgeGroup(est.ageGroup || EJEMPLO_NO_OFICIAL.edades[0].label);
    setEditActivity(est.activity || EJEMPLO_NO_OFICIAL.actividadesOrientativas[0].label);
    setEditFrequency(est.frequency || EJEMPLO_NO_OFICIAL.frecuencias[0].label);
    setEditExtras(est.extras || EJEMPLO_NO_OFICIAL.extras[0].label);
    setEditContactName(est.contactName || '');
    setEditContactPhone(est.contactPhone || '');
    setEditNotes(est.notes || '');
  };

  const computeInlineEstimatedAmount = () => {
    const freq =
      EJEMPLO_NO_OFICIAL.frecuencias.find((f) => f.label === editFrequency) ||
      EJEMPLO_NO_OFICIAL.frecuencias[0];
    const extrasLower = editExtras.toLowerCase();
    let modalidadPago: ModalidadPago = 'mensual';
    if (extrasLower.includes('anual')) modalidadPago = 'anual';
    else if (extrasLower.includes('trimestral')) modalidadPago = 'trimestral';

    const incluirMatricula =
      !extrasLower.includes('sin matrícula') && !extrasLower.includes('sin matricula');

    const resultado = calcularPresupuestoLaPonte({
      numAlumnos: editStudentCount,
      horasSemanales: freq.horasSemanales || 1,
      modalidadPago,
      incluirMatricula,
    });

    return Math.round(resultado.desgloseEconomico.cuotaMensualEquivalente);
  };

  const handleSaveInlineEdit = async (estimateId: number) => {
    if (!onUpdateEstimate) return;
    if (!editContactName.trim() || !editContactPhone.trim()) {
      setWorkspaceError('El nombre y el teléfono son obligatorios para actualizar el presupuesto.');
      return;
    }

    setIsSavingInlineEdit(true);
    setWorkspaceError(null);
    setWorkspaceFeedback(null);
    try {
      const recalculatedAmount = computeInlineEstimatedAmount();
      const updatedObj = {
        id: estimateId,
        studentCount: editStudentCount,
        ageGroup: editAgeGroup,
        activity: editActivity,
        frequency: editFrequency,
        extras: editExtras,
        estimatedAmount: recalculatedAmount,
        contactName: editContactName.trim(),
        contactPhone: editContactPhone.trim(),
        notes: editNotes.trim(),
      };
      const payload = buildPayloadFromEstimate(updatedObj);
      await onUpdateEstimate(estimateId, payload);
      setEditingEstId(null);
      setWorkspaceFeedback(`Presupuesto #${estimateId} actualizado correctamente.`);
    } catch (err: any) {
      setWorkspaceError(err.message || 'No se pudo actualizar el presupuesto.');
    } finally {
      setIsSavingInlineEdit(false);
    }
  };

  const requestDeleteEstimate = (est: any) => {
    if (!onDeleteEstimate) return;
    setConfirmDialog({
      title: `¿Eliminar el presupuesto #${est.id} de tu historial?`,
      description: `Se eliminará permanentemente la simulación de ${est.ageGroup} (${est.frequency} · ${est.estimatedAmount} €/mes orientativos).`,
      confirmLabel: 'Confirmar eliminación',
      onConfirm: async () => {
        await onDeleteEstimate(est.id);
        setWorkspaceFeedback(`Presupuesto #${est.id} eliminado de tu historial.`);
      },
    });
  };

  const handleResendViaGmailFromHistory = (est: any) => {
    const payload = buildPayloadFromEstimate(est);
    setMailSubject(`Simulación de presupuesto #${est.id} — ${CONFIRMADO.nombre} (${est.ageGroup})`);
    setMailBody(payload.formattedSummary);
    setActiveTab('gmail');
    setWorkspaceFeedback(
      `Borrador del presupuesto #${est.id} cargado en la pestaña Gmail. Pulsa "Enviar correo con confirmación previa" para remitirlo a ${CONFIRMADO.email}.`
    );
  };

  const handleExecuteConfirm = async () => {
    if (!confirmDialog) return;
    setIsExecutingConfirm(true);
    setWorkspaceError(null);
    setWorkspaceFeedback(null);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err: any) {
      setWorkspaceError(err.message || 'La operación no pudo completarse.');
      setConfirmDialog(null);
    } finally {
      setIsExecutingConfirm(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-white border border-[#E8C5C8] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Sincroniza tu presupuesto y documentos con Google Workspace
          </h3>
          <p className="text-sm text-[#222222]/75 leading-relaxed">
            Inicia sesión con tu cuenta de Google para exportar tu simulación a{' '}
            <strong>Google Sheets</strong>, generar un dossier en <strong>Google Docs</strong>,
            crear o consultar formularios en <strong>Google Forms</strong>, agendar en{' '}
            <strong>Google Calendar</strong>, enviar desde <strong>Gmail</strong> o guardar a{' '}
            {CONFIRMADO.nombre} (`{CONFIRMADO.telefono}`) en <strong>Google Contacts</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogin}
          disabled={isLoggingIn}
          className="gsi-material-button shrink-0"
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
    );
  }

  return (
    <div className="bg-white border border-[#E8C5C8] rounded-2xl p-6 md:p-8 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[#E8C5C8]/60">
        <div>
          <h3 className="text-2xl font-semibold text-[#222222]">
            Mi Espacio Personal y Ecosistema Google Workspace
          </h3>
          <p className="text-xs text-[#222222]/70 mt-0.5">
            Sesión iniciada como {user.displayName || user.email} · {CONFIRMADO.nombre} (
            {CONFIRMADO.localidad})
          </p>
        </div>

        {/* Interactive Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FBF8F6] border border-[#E8C5C8] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'records'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Mis Presupuestos ({sqlEstimates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Google Sheets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'docs'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Google Docs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forms')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'forms'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Google Forms
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gmail')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'gmail'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Gmail
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'contacts'
                ? 'bg-[#5C1329] text-white'
                : 'text-[#222222]/75 hover:text-[#222222]'
            }`}
          >
            Contacts
          </button>
        </div>
      </div>

      {workspaceFeedback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E8C5C8]/45 text-[#222222] text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#5C1329] shrink-0" />
          <span>{workspaceFeedback}</span>
        </div>
      )}

      {workspaceError && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#5C1329]/10 text-[#5C1329] text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{workspaceError}</span>
          </div>
          {!accessToken && (
            <button
              type="button"
              onClick={onLogin}
              className="px-3 py-1 rounded-md bg-[#5C1329] text-white text-xs font-semibold whitespace-nowrap"
            >
              Autorizar permisos Google
            </button>
          )}
        </div>
      )}

      {/* TAB 1: Saved Estimates History Panel, Inquiries & Chatbot Orientation Sessions */}
      {activeTab === 'records' && (
        <div className="space-y-8">
          {/* Dedicated Budget History Panel */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E8C5C8]/60">
              <div>
                <h4 className="text-xl font-semibold text-[#222222]">
                  Historial de Presupuestos Calculados ({sqlEstimates.length})
                </h4>
                <p className="text-xs text-[#222222]/70">
                  Visualiza todas tus simulaciones anteriores, edítalas aquí mismo o en la calculadora de 8 pasos, y vuelve a enviarlas por WhatsApp, Gmail o formulario web.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sqlEstimates.length > 1 && (
                  <select
                    value={historyFilterAge}
                    onChange={(e) => setHistoryFilterAge(e.target.value)}
                    aria-label="Filtrar historial por grupo de edad"
                    className="px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs font-medium text-[#222222]"
                  >
                    <option value="todos">Todos los grupos ({sqlEstimates.length})</option>
                    {EJEMPLO_NO_OFICIAL.edades.map((ed) => (
                      <option key={ed.id} value={ed.label}>
                        {ed.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('sheets')}
                  className="px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs font-semibold text-[#5C1329] hover:border-[#5C1329]"
                >
                  Exportar a Sheets
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className="px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs font-semibold text-[#5C1329] hover:border-[#5C1329]"
                >
                  Crear Dossier en Docs
                </button>
              </div>
            </div>

            {sqlEstimates.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#222222]">
                    Aún no tienes presupuestos en tu historial
                  </div>
                  <p className="text-xs text-[#222222]/70">
                    Utiliza la Calculadora de 8 pasos y pulsa "Guardar en Mi Espacio" o envíalo por WhatsApp para que quede registrado aquí.
                  </p>
                </div>
                <a
                  href="#presupuesto"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] shrink-0"
                >
                  <CalcIcon className="w-4 h-4" />
                  Ir a la Calculadora (8 pasos)
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sqlEstimates
                  .filter((est) =>
                    historyFilterAge === 'todos' ? true : est.ageGroup === historyFilterAge
                  )
                  .map((est) => {
                    const isEditingThis = editingEstId === est.id;
                    const createdDateStr = est.createdAt
                      ? new Date(est.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Reciente';
                    const payload = buildPayloadFromEstimate(est);
                    const whatsappResendUrl = buildWhatsAppUrl(payload.formattedSummary);

                    return (
                      <div
                        key={est.id}
                        className="p-5 rounded-2xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-4 transition-all"
                      >
                        {/* Top row: Metadata + Price */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C1329] font-semibold">
                              <span>Presupuesto #{est.id}</span>
                              <span aria-hidden="true">·</span>
                              <span>Calculado el {createdDateStr}</span>
                              <span aria-hidden="true">·</span>
                              <span className="underline decoration-[#E8C5C8]">
                                {EJEMPLO_NO_OFICIAL.etiquetaObligatoria}
                              </span>
                            </div>
                            <h5 className="text-lg font-bold text-[#222222]">
                              {est.ageGroup} — {est.activity} ({est.frequency})
                            </h5>
                            <div className="text-xs text-[#222222]/80 flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>
                                <strong>Alumnos:</strong> {est.studentCount}
                              </span>
                              <span>
                                <strong>Extras:</strong> {est.extras}
                              </span>
                              <span>
                                <strong>Contacto:</strong> {est.contactName} ({est.contactPhone})
                              </span>
                            </div>
                            {est.notes && (
                              <p className="text-xs text-[#222222]/75 italic pt-0.5">
                                Nota: "{est.notes}"
                              </p>
                            )}
                          </div>

                          <div className="sm:text-right shrink-0 bg-white px-4 py-2.5 rounded-xl border border-[#E8C5C8]">
                            <div className="text-xl font-bold text-[#5C1329] tabular-nums">
                              {isEditingThis
                                ? `${computeInlineEstimatedAmount()} €/mes`
                                : `${est.estimatedAmount} €/mes`}
                            </div>
                            <div className="text-[10px] font-medium text-[#222222]/65">
                              Estimación orientativa no oficial
                            </div>
                          </div>
                        </div>

                        {/* Inline Editor Form (when user clicks "Editar aquí") */}
                        {isEditingThis && (
                          <div className="p-4 rounded-xl bg-white border border-[#5C1329]/30 space-y-4">
                            <div className="flex items-center justify-between border-b border-[#E8C5C8]/60 pb-2">
                              <span className="text-xs font-bold text-[#5C1329]">
                                Editando parámetros del Presupuesto #{est.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingEstId(null)}
                                className="text-xs text-[#222222]/60 hover:text-[#222222] inline-flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Cerrar edición
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Nº de alumnos
                                </label>
                                <select
                                  value={editStudentCount}
                                  onChange={(e) => setEditStudentCount(Number(e.target.value))}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                >
                                  {EJEMPLO_NO_OFICIAL.alumnos.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Grupo de edad (3 a 99 años)
                                </label>
                                <select
                                  value={editAgeGroup}
                                  onChange={(e) => setEditAgeGroup(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                >
                                  {EJEMPLO_NO_OFICIAL.edades.map((ed) => (
                                    <option key={ed.id} value={ed.label}>
                                      {ed.label} ({ed.rango})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Actividad orientativa
                                </label>
                                <select
                                  value={editActivity}
                                  onChange={(e) => setEditActivity(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                >
                                  {EJEMPLO_NO_OFICIAL.actividadesOrientativas.map((act) => (
                                    <option key={act.id} value={act.label}>
                                      {act.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Frecuencia semanal
                                </label>
                                <select
                                  value={editFrequency}
                                  onChange={(e) => setEditFrequency(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                >
                                  {EJEMPLO_NO_OFICIAL.frecuencias.map((f) => (
                                    <option key={f.id} value={f.label}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Extras orientativos
                                </label>
                                <select
                                  value={editExtras}
                                  onChange={(e) => setEditExtras(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                >
                                  {EJEMPLO_NO_OFICIAL.extras.map((ex) => (
                                    <option key={ex.id} value={ex.label}>
                                      {ex.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Nombre de contacto *
                                </label>
                                <input
                                  type="text"
                                  value={editContactName}
                                  onChange={(e) => setEditContactName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Teléfono / WhatsApp *
                                </label>
                                <input
                                  type="tel"
                                  value={editContactPhone}
                                  onChange={(e) => setEditContactPhone(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-[#222222] mb-1">
                                  Notas o preferencias horarias
                                </label>
                                <input
                                  type="text"
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  placeholder="Ej. Preferencia horario de tarde..."
                                  className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-xs text-[#222222]"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingEstId(null)}
                                className="px-3.5 py-2 rounded-lg border border-[#E8C5C8] text-xs font-semibold text-[#222222] hover:bg-[#FBF8F6]"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingInlineEdit}
                                onClick={() => void handleSaveInlineEdit(est.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f]"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {isSavingInlineEdit ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action Bar: Re-send (WhatsApp, Gmail, Contact Form) & Edit (Inline or 8-Step Calculator) */}
                        <div className="pt-3 border-t border-[#E8C5C8]/60 flex flex-wrap items-center justify-between gap-3">
                          {/* Re-send actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-[#222222]/65 mr-1">
                              Volver a enviar:
                            </span>
                            <a
                              href={whatsappResendUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp ({CONFIRMADO.telefono})
                            </a>

                            <button
                              type="button"
                              onClick={() => handleResendViaGmailFromHistory(est)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#5C1329]" />
                              Gmail
                            </button>

                            {onResendEstimateToContact && (
                              <button
                                type="button"
                                onClick={() => onResendEstimateToContact(payload)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors"
                              >
                                <Send className="w-3.5 h-3.5 text-[#5C1329]" />
                                Formulario Web
                              </button>
                            )}
                          </div>

                          {/* Edit & Delete actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                isEditingThis ? setEditingEstId(null) : startInlineEdit(est)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#5C1329]/40 bg-white text-[#5C1329] text-xs font-semibold hover:bg-[#5C1329] hover:text-white transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {isEditingThis ? 'Cerrar editor' : 'Editar aquí'}
                            </button>

                            {onEditEstimateInCalculator && (
                              <button
                                type="button"
                                onClick={() => onEditEstimateInCalculator(est)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors"
                              >
                                <CalcIcon className="w-3.5 h-3.5 text-[#5C1329]" />
                                Editar en Calculadora (8 pasos)
                              </button>
                            )}

                            {onDeleteEstimate && (
                              <button
                                type="button"
                                onClick={() => requestDeleteEstimate(est)}
                                title="Eliminar presupuesto del historial"
                                className="p-1.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222]/60 hover:text-[#5C1329] hover:border-[#5C1329] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Secondary Row: Sent Inquiries & Saved Chatbot Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-[#E8C5C8]/60">
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-[#222222]">
                Consultas enviadas desde la Web ({sqlInquiries.length})
              </h4>
              {sqlInquiries.length === 0 ? (
                <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                  Aún no has registrado consultas mediante el formulario de contacto.
                </p>
              ) : (
                <div className="space-y-2">
                  {sqlInquiries.slice(0, 4).map((inq) => (
                    <div
                      key={inq.id}
                      className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/70 text-xs space-y-1"
                    >
                      <div className="font-semibold text-[#222222]">
                        {inq.name} · {inq.phone} ({inq.source})
                      </div>
                      <p className="text-[#222222]/75 line-clamp-2">{inq.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-[#222222]">
                Notas y Orientaciones del Chatbot ({firestoreSessions.length})
              </h4>
              {firestoreSessions.length === 0 ? (
                <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                  Puedes guardar cualquier orientación del Chatbot pulsando el icono de marcador en la cabecera del asistente.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {firestoreSessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#5C1329]">
                          Tema: {s.topic} · Estado:{' '}
                          {s.status === 'archived' ? 'Archivada' : 'Activa'}
                        </div>
                        <p className="text-xs text-[#222222]/80 leading-relaxed">{s.summary}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => archiveFirestoreSession(s.id)}
                            title="Archivar nota"
                            className="p-1.5 rounded-lg text-[#222222]/60 hover:text-[#5C1329] hover:bg-white transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteSession(s)}
                          title="Eliminar nota"
                          className="p-1.5 rounded-lg text-[#222222]/60 hover:text-[#5C1329] hover:bg-white transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Google Sheets */}
      {activeTab === 'sheets' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#5C1329]" />
              Exportar presupuestos y consultas a Google Sheets
            </h4>
            {!accessToken ? (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <p className="text-xs text-[#222222]/80">
                  Autoriza el acceso a Google Sheets para crear hojas de cálculo con tus simulaciones orientativas o inspeccionar tus archivos existentes.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Google Sheets
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF8F6] p-4 rounded-xl border border-[#E8C5C8]">
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Título de la nueva hoja de cálculo
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <p className="text-[11px] text-[#222222]/70">
                  Se incluirán los datos confirmados de {CONFIRMADO.nombre} ({CONFIRMADO.localidad}), la etiqueta obligatoria{' '}
                  <strong>{EJEMPLO_NO_OFICIAL.etiquetaObligatoria}</strong> y tus {sqlEstimates.length}{' '}
                  simulaciones guardadas.
                </p>
                <button
                  type="button"
                  onClick={requestExportToGoogleSheets}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear y exportar a Google Sheets
                </button>
              </div>
            )}

            {selectedSheetPreview && (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#222222]">
                      Vista previa: {selectedSheetPreview.title}
                    </div>
                    <div className="text-[11px] text-[#5C1329]">
                      Pestaña activa: {selectedSheetPreview.activeSheetName}
                    </div>
                  </div>
                  {selectedSheetPreview.spreadsheetUrl && (
                    <a
                      href={selectedSheetPreview.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C1329] hover:underline"
                    >
                      Abrir en Sheets <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {selectedSheetPreview.sheetNames.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSheetPreview.sheetNames.map((tabName) => (
                      <button
                        key={tabName}
                        type="button"
                        onClick={() =>
                          void handlePreviewSheet(selectedSheetPreview.spreadsheetId, tabName)
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          selectedSheetPreview.activeSheetName === tabName
                            ? 'bg-[#5C1329] text-white'
                            : 'bg-white border border-[#E8C5C8] text-[#222222]'
                        }`}
                      >
                        {tabName}
                      </button>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto border border-[#E8C5C8] rounded-lg bg-white">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <tbody>
                      {selectedSheetPreview.rows.length === 0 ? (
                        <tr>
                          <td className="p-3 text-[#222222]/60">
                            La pestaña seleccionada no contiene filas.
                          </td>
                        </tr>
                      ) : (
                        selectedSheetPreview.rows.slice(0, 8).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-[#E8C5C8]/50">
                            {row.slice(0, 6).map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-2.5 py-1.5 truncate max-w-[160px] text-[#222222]"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Tus hojas recientes en Google Sheets
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('sheets')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Consultando Google Sheets...</p>
            ) : spreadsheets.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No se encontraron hojas de cálculo recientes o aún no has exportado ninguna.
              </p>
            ) : (
              <div className="space-y-2">
                {spreadsheets.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-semibold text-[#222222] truncate">{f.name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handlePreviewSheet(f.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E8C5C8] bg-white text-[#222222] hover:border-[#5C1329] font-medium"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5C1329]" />
                        Ver filas
                      </button>
                      {f.webViewLink && (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5C1329] font-semibold hover:underline"
                        >
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Google Docs */}
      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#5C1329]" />
              Generar Dossier Personalizado en Google Docs
            </h4>
            {!accessToken ? (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <p className="text-xs text-[#222222]/80">
                  Autoriza Google Docs para crear un documento con toda la información oficial de {CONFIRMADO.nombre} y tus simulaciones de presupuesto.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Google Docs
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF8F6] p-4 rounded-xl border border-[#E8C5C8]">
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Título del documento en Google Docs
                  </label>
                  <input
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Notas o preferencias personales a incluir en el documento
                  </label>
                  <textarea
                    rows={3}
                    value={newDocNotes}
                    onChange={(e) => setNewDocNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <button
                  type="button"
                  onClick={requestCreateGoogleDoc}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear Dossier en Google Docs
                </button>
              </div>
            )}

            {selectedDocDetail && (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#222222]">
                    {selectedDocDetail.title}
                  </div>
                  <a
                    href={selectedDocDetail.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C1329] hover:underline shrink-0"
                  >
                    Abrir en Google Docs <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <pre className="text-[11px] text-[#222222]/80 whitespace-pre-wrap font-sans bg-white p-3 rounded-lg border border-[#E8C5C8] max-h-48 overflow-y-auto">
                  {selectedDocDetail.excerpt}
                </pre>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Tus documentos recientes en Google Docs
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('docs')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Consultando Google Docs...</p>
            ) : docsList.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No se encontraron documentos recientes.
              </p>
            ) : (
              <div className="space-y-2">
                {docsList.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="font-semibold text-[#222222] truncate">{d.name}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handlePreviewDoc(d.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E8C5C8] bg-white text-[#222222] hover:border-[#5C1329] font-medium"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5C1329]" />
                        Extracto
                      </button>
                      {d.webViewLink && (
                        <a
                          href={d.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5C1329] font-semibold hover:underline"
                        >
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Google Forms */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#5C1329]" />
              Formularios de Pre-inscripción en Google Forms
            </h4>
            {!accessToken ? (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <p className="text-xs text-[#222222]/80">
                  Autoriza Google Forms para generar un formulario de recogida de preferencias (grupos de {CONFIRMADO.rangoGeneral}) o consultar respuestas.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Google Forms
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF8F6] p-4 rounded-xl border border-[#E8C5C8]">
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Título del formulario en Google Forms
                  </label>
                  <input
                    type="text"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <p className="text-[11px] text-[#222222]/70">
                  Crea un formulario estructurado con preguntas sobre grupo de edad ({CONFIRMADO.rangoGeneral}), frecuencia semanal y contacto para compartir con alumnos o familiares.
                </p>
                <button
                  type="button"
                  onClick={requestCreateGoogleForm}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear formulario en Google Forms
                </button>
              </div>
            )}

            {selectedFormDetail && (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-2 text-xs">
                <div className="font-bold text-[#222222]">{selectedFormDetail.title}</div>
                {selectedFormDetail.description && (
                  <p className="text-[11px] text-[#222222]/75 leading-relaxed">
                    {selectedFormDetail.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] font-semibold text-[#5C1329]">
                  <span>Preguntas: {selectedFormDetail.questionCount}</span>
                  <span>·</span>
                  <span>Respuestas recibidas: {selectedFormDetail.responseCount}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={selectedFormDetail.responderUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                  >
                    Abrir vista pública <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={selectedFormDetail.editUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8C5C8] bg-white text-[#222222] text-xs font-semibold"
                  >
                    Editar en Google Forms
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Tus formularios en Google Forms
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('forms')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Consultando Google Forms...</p>
            ) : formsList.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No se encontraron formularios en tu cuenta de Google Forms.
              </p>
            ) : (
              <div className="space-y-2">
                {formsList.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="font-semibold text-[#222222] truncate">{f.name}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handlePreviewForm(f.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E8C5C8] bg-white text-[#222222] hover:border-[#5C1329] font-medium"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5C1329]" />
                        Ver respuestas
                      </button>
                      {f.webViewLink && (
                        <a
                          href={f.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5C1329] font-semibold hover:underline"
                        >
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Google Calendar */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#5C1329]" />
              Agendar recordatorio de visita o consulta
            </h4>
            {!accessToken ? (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <p className="text-xs text-[#222222]/80">
                  Para ver tu agenda o crear un recordatorio en Google Calendar, vuelve a conectar tu sesión con permisos de Google Workspace.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Google Calendar
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF8F6] p-4 rounded-xl border border-[#E8C5C8]">
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Título del recordatorio
                  </label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#222222] mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#222222] mb-1">
                      Hora
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestCreateCalendarEvent}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Añadir recordatorio a Google Calendar
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Tus próximos eventos en Google Calendar
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('calendar')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Consultando Google Calendar...</p>
            ) : calendarEvents.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No hay eventos próximos o aún no se ha sincronizado el calendario.
              </p>
            ) : (
              <div className="space-y-2">
                {calendarEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#222222]">{ev.summary}</div>
                      <div className="text-[#222222]/65 tabular-nums">{ev.start}</div>
                    </div>
                    {ev.htmlLink && (
                      <a
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5C1329] font-semibold hover:underline shrink-0"
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Gmail */}
      {activeTab === 'gmail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#5C1329]" />
              Enviar consulta a {CONFIRMADO.email} vía Gmail
            </h4>
            {!accessToken ? (
              <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
                <p className="text-xs text-[#222222]/80">
                  Autoriza el acceso a Gmail para enviar tu resumen de presupuesto o consulta directamente desde tu cuenta.
                </p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Gmail
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-[#FBF8F6] p-4 rounded-xl border border-[#E8C5C8]">
                <div className="text-xs text-[#222222]/70">
                  Destinatario oficial: <strong>{CONFIRMADO.email}</strong>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#222222] mb-1">
                    Mensaje
                  </label>
                  <textarea
                    rows={4}
                    value={mailBody}
                    onChange={(e) => setMailBody(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8C5C8] bg-white text-xs text-[#222222]"
                  />
                </div>
                <button
                  type="button"
                  onClick={requestSendGmail}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Enviar correo con confirmación previa
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Mensajes recientes en tu bandeja de Gmail
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('gmail')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Cargando mensajes de Gmail...</p>
            ) : gmailMessages.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No se encontraron mensajes recientes para mostrar.
              </p>
            ) : (
              <div className="space-y-2">
                {gmailMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] text-xs space-y-1"
                  >
                    <div className="font-semibold text-[#222222] truncate">{msg.subject}</div>
                    <div className="text-[11px] text-[#5C1329] truncate">{msg.from}</div>
                    <p className="text-[#222222]/70 line-clamp-1">{msg.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Google Contacts */}
      {activeTab === 'contacts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-[#222222] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#5C1329]" />
              Guardar ficha oficial de {CONFIRMADO.nombre}
            </h4>
            <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] space-y-3">
              <div className="text-xs space-y-1 text-[#222222]/85">
                <div>
                  <strong>Nombre:</strong> {CONFIRMADO.nombre}
                </div>
                <div>
                  <strong>Teléfono / WhatsApp:</strong> {CONFIRMADO.telefono}
                </div>
                <div>
                  <strong>Email:</strong> {CONFIRMADO.email}
                </div>
                <div>
                  <strong>Localidad:</strong> {CONFIRMADO.localidad}
                </div>
              </div>
              {!accessToken ? (
                <button
                  type="button"
                  onClick={onLogin}
                  className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
                >
                  Activar Google Contacts
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestSaveStudioContact}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Guardar La Ponte Dance en mis Contactos de Google
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[#222222]">
                Tus contactos en Google Contacts
              </h4>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => void loadWorkspaceTab('contacts')}
                  className="inline-flex items-center gap-1 text-xs text-[#5C1329] hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              )}
            </div>
            {loadingWorkspace ? (
              <p className="text-xs text-[#222222]/60">Consultando Google Contacts...</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-[#222222]/65 p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8]/60">
                No se encontraron contactos o la agenda está vacía.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {contacts.map((c) => (
                  <div
                    key={c.resourceName}
                    className="p-3 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] text-xs space-y-0.5"
                  >
                    <div className="font-semibold text-[#222222] truncate">{c.displayName}</div>
                    {c.phone && <div className="text-[#5C1329] tabular-nums">{c.phone}</div>}
                    {c.email && <div className="text-[#222222]/65 truncate">{c.email}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Explicit User Confirmation Modal */}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E8C5C8] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-xl font-semibold text-[#222222]">{confirmDialog.title}</h4>
            <p className="text-sm text-[#222222]/80 leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg border border-[#E8C5C8] text-xs font-semibold text-[#222222] hover:bg-[#FBF8F6]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={handleExecuteConfirm}
                className="px-4 py-2 rounded-lg bg-[#5C1329] text-white text-xs font-semibold hover:bg-[#460e1f]"
              >
                {isExecutingConfirm ? 'Procesando...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
