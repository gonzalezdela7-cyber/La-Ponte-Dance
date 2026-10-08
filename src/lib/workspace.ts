import { getAccessToken } from './firebase.ts';
import { CONFIGURACION_LA_PONTE_DANCE } from '../data/config.ts';

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  htmlLink?: string;
}

export interface GmailMessageSummary {
  id: string;
  snippet: string;
  subject: string;
  from: string;
}

export interface ContactItem {
  resourceName: string;
  displayName: string;
  email?: string;
  phone?: string;
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function listUpcomingCalendarEvents(
  explicitToken?: string | null
): Promise<CalendarEventItem[]> {
  const token = explicitToken || (await getAccessToken());
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const nowIso = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      nowIso
    )}&maxResults=8&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudieron cargar los eventos de Google Calendar.');
  }
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || 'Evento sin título',
    start: item.start?.dateTime || item.start?.date || '',
    htmlLink: item.htmlLink,
  }));
}

function addOneHourToTime(timeHHMM: string): string {
  const [hhStr, mmStr] = timeHHMM.split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr || 0);
  const nextHh = (hh + 1) % 24;
  return `${String(nextHh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export async function checkCalendarSlotConflict(
  date: string,
  time: string,
  explicitToken?: string | null
): Promise<{ hasConflict: boolean; conflictingEvents: CalendarEventItem[] }> {
  const token = explicitToken || (await getAccessToken());
  if (!token) return { hasConflict: false, conflictingEvents: [] };

  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      startDateTime.toISOString()
    )}&timeMax=${encodeURIComponent(
      endDateTime.toISOString()
    )}&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    return { hasConflict: false, conflictingEvents: [] };
  }

  const data = await res.json();
  const items: CalendarEventItem[] = (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || 'Evento en tu calendario',
    start: item.start?.dateTime || item.start?.date || '',
    htmlLink: item.htmlLink,
  }));

  return {
    hasConflict: items.length > 0,
    conflictingEvents: items,
  };
}

export async function bookTrialClassOnGoogleCalendar(params: {
  studentName: string;
  studentPhone: string;
  ageGroup: string;
  activity: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
  accessToken?: string | null;
}): Promise<CalendarEventItem> {
  const token = params.accessToken || (await getAccessToken());
  if (!token) throw new Error('Token de Google Calendar no disponible. Inicia sesión con Google.');

  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR } = CONFIGURACION_LA_PONTE_DANCE;
  const endTimeStr = addOneHourToTime(params.preferredTime);

  const summary = `Clase de Prueba Gratuita — ${CONFIRMADO.nombre} (${params.ageGroup})`;
  const description = [
    `Reserva de Clase de Prueba Gratuita sincronizada automáticamente con ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`,
    `• Alumno/a: ${params.studentName}`,
    `• Teléfono / WhatsApp: ${params.studentPhone}`,
    `• Grupo de edad: ${params.ageGroup}`,
    `• Modalidad orientativa: ${params.activity}`,
    params.notes ? `• Observaciones: ${params.notes}` : '',
    '',
    `Contacto oficial de ${CONFIRMADO.nombre}:`,
    `• WhatsApp / Teléfono: ${CONFIRMADO.telefono}`,
    `• Email: ${CONFIRMADO.email}`,
    `• Instagram: ${CONFIRMADO.instagramHandle} (${CONFIRMADO.instagramUrl})`,
    `• Nota: ${PENDIENTE_DE_CONFIRMAR.horarios} y ${PENDIENTE_DE_CONFIRMAR.direccionExacta}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const eventPayload = {
    summary,
    location: `${CONFIRMADO.localidad} — ${CONFIRMADO.nombre}`,
    description,
    start: {
      dateTime: `${params.preferredDate}T${params.preferredTime}:00`,
      timeZone: 'Europe/Madrid',
    },
    end: {
      dateTime: `${params.preferredDate}T${endTimeStr}:00`,
      timeZone: 'Europe/Madrid',
    },
    attendees: [
      {
        email: CONFIRMADO.email,
        displayName: CONFIRMADO.nombre,
      },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 1440 },
      ],
    },
  };

  let res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }
  );

  // Fallback if sendUpdates=all or attendee invite is restricted on the user's calendar
  if (!res.ok) {
    const { attendees: _omit, ...fallbackPayload } = eventPayload;
    res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      }
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        'No se pudo añadir automáticamente la clase de prueba en tu Google Calendar.'
    );
  }

  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    start: created.start?.dateTime || created.start?.date || '',
    htmlLink: created.htmlLink,
  };
}

export async function updateGoogleCalendarTrialEvent(params: {
  eventId: string;
  preferredDate: string;
  preferredTime: string;
  accessToken?: string | null;
}): Promise<CalendarEventItem> {
  const token = params.accessToken || (await getAccessToken());
  if (!token) throw new Error('Token de Google Calendar no disponible.');

  const endTimeStr = addOneHourToTime(params.preferredTime);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      params.eventId
    )}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: {
          dateTime: `${params.preferredDate}T${params.preferredTime}:00`,
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: `${params.preferredDate}T${endTimeStr}:00`,
          timeZone: 'Europe/Madrid',
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error('No se pudo actualizar la fecha/hora del evento en Google Calendar.');
  }

  const updated = await res.json();
  return {
    id: updated.id,
    summary: updated.summary,
    start: updated.start?.dateTime || updated.start?.date || '',
    htmlLink: updated.htmlLink,
  };
}

export async function deleteGoogleCalendarEvent(
  eventId: string,
  explicitToken?: string | null
): Promise<void> {
  const token = explicitToken || (await getAccessToken());
  if (!token) throw new Error('Token de Google Calendar no disponible.');

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      eventId
    )}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('No se pudo eliminar el evento de Google Calendar.');
  }
}

export async function createStudioCalendarEvent(params: {
  title: string;
  date: string;
  time: string;
  description: string;
}): Promise<CalendarEventItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const startDateTime = new Date(`${params.date}T${params.time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: params.title,
        location: CONFIGURACION_LA_PONTE_DANCE.CONFIRMADO.localidad,
        description: params.description,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
      }),
    }
  );

  if (!res.ok) {
    throw new Error('No se pudo crear el recordatorio en Google Calendar.');
  }
  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    start: created.start?.dateTime || created.start?.date || '',
    htmlLink: created.htmlLink,
  };
}

export async function listRecentGmailMessages(): Promise<GmailMessageSummary[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=4',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!listRes.ok) {
    throw new Error('No se pudieron consultar los mensajes de Gmail.');
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];

  const details = await Promise.all(
    messages.slice(0, 4).map(async (m: { id: string }) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!detailRes.ok) {
        return {
          id: m.id,
          snippet: '',
          subject: 'Mensaje de Gmail',
          from: '',
        };
      }
      const d = await detailRes.json();
      const headers: { name: string; value: string }[] = d.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(Sin asunto)';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      return {
        id: d.id,
        snippet: d.snippet || '',
        subject,
        from,
      };
    })
  );

  return details;
}

export async function sendGmailInquiry(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const mimeMessage = [
    `To: ${params.to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.body,
  ].join('\r\n');

  const raw = encodeBase64Url(mimeMessage);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    throw new Error('No se pudo enviar el correo mediante Gmail.');
  }
  return await res.json();
}

export async function listGoogleContacts(): Promise<ContactItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const res = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=6',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudieron cargar los contactos de Google Contacts.');
  }
  const data = await res.json();
  return (data.connections || []).map((c: any) => ({
    resourceName: c.resourceName,
    displayName: c.names?.[0]?.displayName || 'Contacto sin nombre',
    email: c.emailAddresses?.[0]?.value,
    phone: c.phoneNumbers?.[0]?.value,
  }));
}

export async function saveLaPonteDanceToGoogleContacts(): Promise<ContactItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const { CONFIRMADO } = CONFIGURACION_LA_PONTE_DANCE;
  const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      names: [
        {
          givenName: CONFIRMADO.nombre,
          familyName: 'Torrijos',
        },
      ],
      phoneNumbers: [
        {
          value: CONFIRMADO.telefono,
          type: 'mobile',
        },
      ],
      emailAddresses: [
        {
          value: CONFIRMADO.email,
          type: 'work',
        },
      ],
      addresses: [
        {
          city: 'Torrijos',
          region: 'Toledo',
          country: 'España',
          type: 'work',
        },
      ],
      biographies: [
        {
          value: `Estudio de danza en ${CONFIRMADO.localidad}. Público: niños, jóvenes, adultos y parejas (${CONFIRMADO.rangoGeneral}). Instagram: ${CONFIRMADO.instagramHandle}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar el contacto en Google Contacts.');
  }
  const created = await res.json();
  return {
    resourceName: created.resourceName,
    displayName: created.names?.[0]?.displayName || CONFIRMADO.nombre,
    email: created.emailAddresses?.[0]?.value || CONFIRMADO.email,
    phone: created.phoneNumbers?.[0]?.value || CONFIRMADO.telefono,
  };
}

// ============================================================================
// GOOGLE SHEETS API (https://sheets.googleapis.com/v4/spreadsheets)
// ============================================================================

export interface DriveFileItem {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface SheetPreviewData {
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
  activeSheetName: string;
  rows: string[][];
  spreadsheetUrl?: string;
}

export async function listUserSpreadsheets(): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=6&orderBy=modifiedTime desc&fields=files(id,name,webViewLink,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudieron listar tus hojas de cálculo de Google Sheets.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function readSpreadsheetPreview(
  spreadsheetId: string,
  selectedSheetName?: string
): Promise<SheetPreviewData> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  // Best Practice: Always fetch spreadsheet metadata first to identify actual tab names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!metaRes.ok) {
    throw new Error('No se pudieron obtener los metadatos de la hoja de cálculo.');
  }
  const meta = await metaRes.json();
  const sheetNames: string[] = (meta.sheets || [])
    .map((s: any) => s.properties?.title)
    .filter(Boolean);

  const activeSheetName =
    selectedSheetName && sheetNames.includes(selectedSheetName)
      ? selectedSheetName
      : sheetNames[0] || 'Hoja 1';

  const range = `${activeSheetName}!A1:F10`;
  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!valRes.ok) {
    throw new Error('No se pudieron leer las celdas de la hoja seleccionada.');
  }
  const valData = await valRes.json();

  return {
    spreadsheetId,
    title: meta.properties?.title || 'Hoja de cálculo',
    sheetNames,
    activeSheetName,
    rows: valData.values || [],
    spreadsheetUrl: meta.spreadsheetUrl,
  };
}

export async function exportLaPonteRecordsToGoogleSheets(params: {
  sheetTitle?: string;
  estimates: any[];
  inquiries: any[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const { CONFIRMADO, EJEMPLO_NO_OFICIAL } = CONFIGURACION_LA_PONTE_DANCE;
  const title =
    params.sheetTitle?.trim() ||
    `${CONFIRMADO.nombre} — Registro de Presupuestos (${CONFIRMADO.localidad})`;

  // 1. Create the spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
    }),
  });

  if (!createRes.ok) {
    throw new Error('No se pudo crear la hoja de cálculo en Google Sheets.');
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Dynamically inspect the first tab name from metadata (never hardcode "Sheet1")
  const firstTabName: string = created.sheets?.[0]?.properties?.title || 'Hoja 1';

  const values: string[][] = [
    [
      'Estudio Oficial',
      CONFIRMADO.nombre,
      'Localidad',
      CONFIRMADO.localidad,
      'WhatsApp Oficial',
      CONFIRMADO.telefono,
    ],
    [
      'Aviso de Tarifas',
      EJEMPLO_NO_OFICIAL.etiquetaObligatoria,
      'Rango de Edad',
      CONFIRMADO.rangoGeneral,
      'Email Oficial',
      CONFIRMADO.email,
    ],
    [],
    [
      'Fecha',
      'Grupo de Edad',
      'Nº Alumnos',
      'Modalidad Orientativa',
      'Frecuencia',
      'Estimación (€/mes — NO OFICIAL)',
    ],
  ];

  if (params.estimates.length === 0) {
    values.push([
      new Date().toISOString().split('T')[0],
      'Pendiente de simulación',
      '1',
      'Orientación general',
      '1 día/semana',
      '35 (€/mes ejemplo no oficial)',
    ]);
  } else {
    params.estimates.forEach((est) => {
      values.push([
        est.createdAt
          ? new Date(est.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        String(est.ageGroup || ''),
        String(est.studentCount || 1),
        String(est.activity || ''),
        String(est.frequency || ''),
        `${est.estimatedAmount} €/mes (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria})`,
      ]);
    });
  }

  if (params.inquiries.length > 0) {
    values.push([]);
    values.push(['Consultas Registradas', 'Nombre', 'Teléfono', 'Origen', 'Mensaje', '']);
    params.inquiries.forEach((inq) => {
      values.push([
        inq.createdAt
          ? new Date(inq.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        String(inq.name || ''),
        String(inq.phone || ''),
        String(inq.source || 'Web'),
        String(inq.message || ''),
        '',
      ]);
    });
  }

  const range = `${firstTabName}!A1`;
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error('Se creó la hoja pero no se pudieron escribir las filas iniciales.');
  }

  return { spreadsheetId, spreadsheetUrl, title };
}

// ============================================================================
// GOOGLE DOCS API (https://docs.googleapis.com/v1/documents)
// ============================================================================

export interface GoogleDocDetail {
  documentId: string;
  title: string;
  excerpt: string;
  documentUrl: string;
}

export async function listUserGoogleDocs(): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.document' and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=6&orderBy=modifiedTime desc&fields=files(id,name,webViewLink,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudieron listar tus documentos de Google Docs.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function readGoogleDocSummary(documentId: string): Promise<GoogleDocDetail> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudo leer el contenido del documento en Google Docs.');
  }
  const docData = await res.json();

  const textParts: string[] = [];
  const contentElements: any[] = docData.body?.content || [];
  for (const el of contentElements) {
    const elements = el.paragraph?.elements || [];
    for (const run of elements) {
      if (run.textRun?.content) {
        textParts.push(run.textRun.content);
      }
    }
  }

  const fullText = textParts.join('').trim();
  return {
    documentId: docData.documentId || documentId,
    title: docData.title || 'Documento sin título',
    excerpt: fullText.slice(0, 420) || '(Documento sin texto)',
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

export async function createLaPonteDossierGoogleDoc(params: {
  docTitle?: string;
  customNotes?: string;
  estimates: any[];
}): Promise<GoogleDocDetail> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR, EJEMPLO_NO_OFICIAL } =
    CONFIGURACION_LA_PONTE_DANCE;

  const title =
    params.docTitle?.trim() ||
    `Dossier Personalizado — ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`;

  // 1. Create empty Google Doc
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    throw new Error('No se pudo crear el documento en Google Docs.');
  }
  const created = await createRes.json();
  const documentId: string = created.documentId;

  const estimateLines =
    params.estimates.length > 0
      ? params.estimates
          .map(
            (e, idx) =>
              `  ${idx + 1}. Grupo: ${e.ageGroup} | Alumnos: ${e.studentCount} | Actividad: ${
                e.activity
              } | Frecuencia: ${e.frequency} | Estimación orientativa: ${
                e.estimatedAmount
              } €/mes (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria})`
          )
          .join('\n')
      : `  • Aún no se han guardado simulaciones desde la calculadora de 8 pasos (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria}).`;

  const bodyText = [
    `${CONFIRMADO.nombre.toUpperCase()} — DOSSIER DE ORIENTACIÓN Y PRESUPUESTO`,
    `Generado el ${new Date().toLocaleDateString('es-ES')}\n`,
    `1. DATOS OFICIALES CONFIRMADOS`,
    `• Estudio: ${CONFIRMADO.nombre}`,
    `• Localidad: ${CONFIRMADO.localidad}`,
    `• Teléfono / WhatsApp: ${CONFIRMADO.telefono}`,
    `• Correo electrónico: ${CONFIRMADO.email}`,
    `• Instagram: ${CONFIRMADO.instagramHandle} (${CONFIRMADO.instagramUrl})`,
    `• Público: ${CONFIRMADO.publico.join(', ')} (${CONFIRMADO.rangoGeneral})\n`,
    `2. INFORMACIÓN PENDIENTE DE CONFIRMAR OFICIALMENTE`,
    `• Dirección física exacta: ${PENDIENTE_DE_CONFIRMAR.direccionExacta}`,
    `• Catálogo definitivo de disciplinas: ${PENDIENTE_DE_CONFIRMAR.catalogoDisciplinas}`,
    `• Horarios definitivos: ${PENDIENTE_DE_CONFIRMAR.horarios}`,
    `• Tarifas reales, matrículas y descuentos: ${PENDIENTE_DE_CONFIRMAR.tarifasReales}\n`,
    `3. SIMULACIONES DE PRESUPUESTO (${EJEMPLO_NO_OFICIAL.etiquetaObligatoria})`,
    estimateLines,
    '',
    params.customNotes?.trim()
      ? `4. NOTAS Y CONSULTAS PERSONALES\n${params.customNotes.trim()}\n`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  // 2. Insert structured content via batchUpdate
  const batchRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: bodyText,
            },
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    throw new Error('Se creó el documento pero no se pudo insertar el texto del dossier.');
  }

  return {
    documentId,
    title,
    excerpt: bodyText.slice(0, 420),
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

// ============================================================================
// GOOGLE FORMS API (https://forms.googleapis.com/v1/forms)
// ============================================================================

export interface GoogleFormDetail {
  formId: string;
  title: string;
  description?: string;
  responderUri: string;
  editUri: string;
  questionCount: number;
  responseCount: number;
}

export async function listUserGoogleForms(): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.form' and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=6&orderBy=modifiedTime desc&fields=files(id,name,webViewLink,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('No se pudieron listar tus formularios de Google Forms.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function getGoogleFormDetails(formId: string): Promise<GoogleFormDetail> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const [formRes, responsesRes] = await Promise.all([
    fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!formRes.ok) {
    throw new Error('No se pudo obtener la información del formulario en Google Forms.');
  }

  const formData = await formRes.json();
  let responseCount = 0;
  if (responsesRes.ok) {
    const respData = await responsesRes.json();
    responseCount = (respData.responses || []).length;
  }

  return {
    formId: formData.formId || formId,
    title: formData.info?.title || 'Formulario de Google Forms',
    description: formData.info?.description || '',
    responderUri:
      formData.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
    questionCount: (formData.items || []).length,
    responseCount,
  };
}

export async function createLaPonteInquiryGoogleForm(params: {
  formTitle?: string;
}): Promise<GoogleFormDetail> {
  const token = await getAccessToken();
  if (!token) throw new Error('Token de Google Workspace no disponible.');

  const { CONFIRMADO, PENDIENTE_DE_CONFIRMAR } = CONFIGURACION_LA_PONTE_DANCE;
  const title =
    params.formTitle?.trim() ||
    `Pre-inscripción y Preferencias — ${CONFIRMADO.nombre} (${CONFIRMADO.localidad})`;

  // 1. Create form (Forms API v1 only allows info.title and info.documentTitle on initial POST)
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error('No se pudo crear el formulario en Google Forms.');
  }

  const created = await createRes.json();
  const formId: string = created.formId;

  const description = `Formulario orientativo de interés para clases en ${CONFIRMADO.nombre} (${CONFIRMADO.localidad}). Público: ${CONFIRMADO.publico.join(
    ', '
  )} (${CONFIRMADO.rangoGeneral}). Contacto oficial: WhatsApp ${CONFIRMADO.telefono} · ${
    CONFIRMADO.email
  }. Nota: ${PENDIENTE_DE_CONFIRMAR.horarios} y ${PENDIENTE_DE_CONFIRMAR.tarifasReales}.`;

  // 2. Add description and structured items via batchUpdate
  const batchRes = await fetch(
    `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateFormInfo: {
              info: {
                title,
                description,
              },
              updateMask: 'description',
            },
          },
          {
            createItem: {
              item: {
                title: 'Grupo de edad del alumno/a (3 a 99 años)',
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: [
                        { value: 'Infantil (3 a 11 años)' },
                        { value: 'Jóvenes (12 a 17 años)' },
                        { value: 'Adultos (18 a 99 años)' },
                        { value: 'Parejas y Baile Nupcial' },
                      ],
                    },
                  },
                },
              },
              location: { index: 0 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Frecuencia orientativa de interés',
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: [
                        { value: '1 día por semana' },
                        { value: '2 días por semana' },
                        { value: '3 o más días / Intensivo' },
                      ],
                    },
                  },
                },
              },
              location: { index: 1 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Nombre, teléfono / WhatsApp y comentarios',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: {
                      paragraph: true,
                    },
                  },
                },
              },
              location: { index: 2 },
            },
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    throw new Error('Se creó el formulario pero no se pudieron añadir las preguntas.');
  }

  return {
    formId,
    title,
    description,
    responderUri:
      created.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
    questionCount: 3,
    responseCount: 0,
  };
}

