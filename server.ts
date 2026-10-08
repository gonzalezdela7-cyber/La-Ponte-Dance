import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  requireAuth,
  AuthRequest,
  resolveAuthenticatedUser,
  signAppSessionJwt,
  SESSION_COOKIE_NAME,
} from './src/middleware/auth.ts';
import {
  cancelTrialBookingInDb,
  createBudgetEstimate,
  createInquiry,
  createTrialBooking,
  deleteBudgetEstimate,
  getOrCreateUser,
  getUserBudgetEstimates,
  getUserInquiries,
  getUserTrialBookings,
  updateBudgetEstimate,
} from './src/db/queries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const LA_PONTE_DANCE_SYSTEM_INSTRUCTION = `
  Eres el Asistente Digital Oficial de La Ponte Dance, estudio de danza en Torrijos (Toledo).
  El usuario puede conversar libremente contigo sobre cualquier duda relacionada con el estudio. Responde siempre en español con un tono cercano, elegante, amable y profesional.

  INFORMACIÓN OFICIAL CONFIRMADA:
  - Nombre: La Ponte Dance
  - Localidad: Torrijos, Toledo, España.
  - Teléfono / WhatsApp: 653860324
  - Email: silviapontejuan@gmail.com
  - Instagram oficial: @laponte_dance (https://instagram.com/laponte_dance)
  - Público: niños, jóvenes, adultos y parejas.
  - Rango general de edad: 3 a 99 años.

  INFORMACIÓN PENDIENTE DE CONFIRMAR:
  - Dirección exacta, horarios, tarifas, matrículas, descuentos, promociones, catálogo oficial de clases/disciplinas, normas de inscripción, disponibilidad de plazas y profesores.

  HERRAMIENTAS DISPONIBLES EN LA WEB OFICIAL:
  - Calculadora de presupuesto orientativo (8 pasos): permite simular una cuota mensual orientativa. Recuerda SIEMPRE que utiliza "PRECIOS DE EJEMPLO — NO OFICIALES" porque las tarifas reales están pendientes de confirmar.
  - Reserva de Clase de Prueba Gratuita: permite elegir grupo de edad, fecha y franja orientativa y añadir automáticamente el evento al Google Calendar del usuario.
  - Contacto directo por WhatsApp (653860324) o formulario de contacto.

  REGLA DE VERACIDAD (ESTRICTA):
  Nunca inventes tarifas, horarios, disciplinas cerradas ni direcciones exactas; indica siempre con transparencia que están PENDIENTES DE CONFIRMAR y ofrece contactar en el 653860324 o usar la calculadora orientativa. Si te preguntan por Instagram o redes sociales, facilita siempre el usuario @laponte_dance y el enlace https://instagram.com/laponte_dance.

  PAUTAS DE ATENCIÓN SEGÚN EL PERFIL DE CONSULTA:
  1. Bienvenida General: Saluda dando la bienvenida a La Ponte Dance en Torrijos (Toledo), pregunta nombre y edad (3 a 99 años), recuerda que horarios y tarifas están [PENDIENTE DE CONFIRMAR] y comparte Instagram https://instagram.com/laponte_dance.
  2. Clases Infantiles / Juveniles: Alternativas desde los 3 años en adelante; catálogo definitivo y horarios [PENDIENTE DE CONFIRMAR]; ofrece anotar nombre y edad exacta del niño/a para la lista de contacto prioritario.
  3. Clases para Adultos: Grupos para adultos hasta 99 años; horarios y modalidades [PENDIENTE DE CONFIRMAR]; sugiere indicar preferencia de mañana o tarde.
  4. Parejas / Bodas y Eventos: Atención para parejas y bailes nupciales; tarifas y horarios [PENDIENTE DE CONFIRMAR]; pregunta fecha o disponibilidad.
  5. Tarifas y Presupuestos: Tarifas oficiales y matrículas [PENDIENTE DE CONFIRMAR]; aclara que el simulador web usa precios de ejemplo no oficiales.
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // OIDC / JWT Session Exchange Endpoint (Google OAuth + Firebase OIDC)
  app.post('/api/auth/session', async (req, res) => {
    try {
      const { idToken, accessToken, googleIdToken } = req.body || {};
      const tokenToVerify = idToken || googleIdToken || accessToken;
      if (!tokenToVerify) {
        return res
          .status(400)
          .json({ error: 'Se requiere un token OIDC o OAuth de Google para iniciar sesión.' });
      }

      req.headers.authorization = `Bearer ${tokenToVerify}`;
      const verified = await resolveAuthenticatedUser(req);
      if (!verified) {
        return res
          .status(401)
          .json({ error: 'No se pudo verificar el token OIDC/JWT de Google.' });
      }

      const uid = verified.uid || (verified as any).sub;
      const email = verified.email || 'user@lapontedance.es';
      const name = (verified as any).name || null;
      const picture = (verified as any).picture || null;
      const emailVerified = Boolean(
        (verified as any).email_verified ?? true
      );

      await getOrCreateUser(uid, email, name);

      const sessionJwt = signAppSessionJwt({
        uid,
        email,
        email_verified: emailVerified,
        name,
        picture,
      });

      // Set cross-origin iframe compatible HttpOnly cookie (SameSite=None; Secure)
      res.cookie(SESSION_COOKIE_NAME, sessionJwt, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json({
        authenticated: true,
        sessionJwt,
        oidcClaims: {
          sub: uid,
          uid,
          email,
          email_verified: emailVerified,
          name,
          picture,
          iss: (verified as any).iss || 'https://accounts.google.com',
          aud: (verified as any).aud || 'ringed-mile-3f38q',
          exp: (verified as any).exp,
        },
      });
    } catch (error: any) {
      console.error('Error in /api/auth/session:', error);
      res
        .status(500)
        .json({ error: error.message || 'Error al establecer la sesión OIDC/JWT.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    const u = req.user!;
    res.json({
      authenticated: true,
      user: {
        uid: u.uid,
        sub: (u as any).sub || u.uid,
        email: u.email,
        email_verified: (u as any).email_verified ?? true,
        name: (u as any).name || null,
        picture: (u as any).picture || null,
        iss: (u as any).iss,
        aud: (u as any).aud,
        exp: (u as any).exp,
      },
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ success: true });
  });

  app.post('/api/chatbot', async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Por favor, escribe un mensaje válido.' });
      }

      const formattedHistory = Array.isArray(history)
        ? history
            .slice(-10)
            .map((m: { sender?: string; text?: string }) =>
              `${m.sender === 'user' ? 'Usuario' : 'Asistente'}: ${String(m.text || '')}`
            )
            .join('\n')
        : '';

      const prompt = formattedHistory
        ? `Historial reciente de la conversación:\n${formattedHistory}\n\nNuevo mensaje del usuario: ${message.trim()}`
        : message.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: LA_PONTE_DANCE_SYSTEM_INSTRUCTION,
          temperature: 0.4,
        },
      });

      const replyText =
        response.text ||
        'En La Ponte Dance (Torrijos, Toledo) ofrecemos formación para niños, jóvenes, adultos y parejas de 3 a 99 años. Puedes escribirnos por WhatsApp al 653860324 para cualquier consulta.';

      res.json({ reply: replyText });
    } catch (error: any) {
      console.error('Error in /api/chatbot:', error);
      res.status(500).json({
        error:
          error?.message ||
          'No se pudo conectar con el asistente IA en este momento. Puedes escribirnos directamente al WhatsApp 653860324.',
      });
    }
  });

  app.get('/api/records', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'user@lapontedance.es';
      const name = req.user!.name || null;

      await getOrCreateUser(uid, email, name);
      const [estimates, savedInquiries, trialBookings] = await Promise.all([
        getUserBudgetEstimates(uid),
        getUserInquiries(uid),
        getUserTrialBookings(uid),
      ]);

      res.json({ estimates, inquiries: savedInquiries, trialBookings });
    } catch (error: any) {
      console.error('Failed to fetch user records:', error);
      res.status(500).json({ error: error.message || 'Error al obtener registros.' });
    }
  });

  app.post('/api/estimates', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'user@lapontedance.es';
      const name = req.user!.name || null;

      await getOrCreateUser(uid, email, name);

      const {
        studentCount,
        ageGroup,
        activity,
        frequency,
        extras,
        estimatedAmount,
        contactName,
        contactPhone,
        notes,
      } = req.body;

      if (!contactName || !contactPhone || !ageGroup || !activity || !frequency) {
        return res.status(400).json({ error: 'Faltan campos requeridos del presupuesto.' });
      }

      const created = await createBudgetEstimate({
        userUid: uid,
        studentCount: Number(studentCount) || 1,
        ageGroup: String(ageGroup).slice(0, 120),
        activity: String(activity).slice(0, 120),
        frequency: String(frequency).slice(0, 120),
        extras: String(extras || 'Sin extras').slice(0, 200),
        estimatedAmount: Number(estimatedAmount) || 0,
        contactName: String(contactName).slice(0, 120),
        contactPhone: String(contactPhone).slice(0, 40),
        notes: notes ? String(notes).slice(0, 500) : undefined,
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to save budget estimate:', error);
      res.status(500).json({ error: error.message || 'Error al guardar la estimación.' });
    }
  });

  app.put('/api/estimates/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const estimateId = Number(req.params.id);
      if (!estimateId) {
        return res.status(400).json({ error: 'ID de presupuesto inválido.' });
      }

      const {
        studentCount,
        ageGroup,
        activity,
        frequency,
        extras,
        estimatedAmount,
        contactName,
        contactPhone,
        notes,
      } = req.body;

      if (!contactName || !contactPhone || !ageGroup || !activity || !frequency) {
        return res.status(400).json({ error: 'Faltan campos requeridos del presupuesto.' });
      }

      const updated = await updateBudgetEstimate(estimateId, uid, {
        studentCount: Number(studentCount) || 1,
        ageGroup: String(ageGroup).slice(0, 120),
        activity: String(activity).slice(0, 120),
        frequency: String(frequency).slice(0, 120),
        extras: String(extras || 'Sin extras').slice(0, 200),
        estimatedAmount: Number(estimatedAmount) || 0,
        contactName: String(contactName).slice(0, 120),
        contactPhone: String(contactPhone).slice(0, 40),
        notes: notes ? String(notes).slice(0, 500) : undefined,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Presupuesto no encontrado.' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update budget estimate:', error);
      res.status(500).json({ error: error.message || 'Error al actualizar el presupuesto.' });
    }
  });

  app.delete('/api/estimates/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const estimateId = Number(req.params.id);
      if (!estimateId) {
        return res.status(400).json({ error: 'ID de presupuesto inválido.' });
      }
      const deleted = await deleteBudgetEstimate(estimateId, uid);
      if (!deleted) {
        return res.status(404).json({ error: 'Presupuesto no encontrado.' });
      }
      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error('Failed to delete budget estimate:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar el presupuesto.' });
    }
  });

  app.post('/api/inquiries', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'user@lapontedance.es';
      const userName = req.user!.name || null;

      await getOrCreateUser(uid, email, userName);

      const { name, phone, message, source } = req.body;
      if (!name || !phone || !message) {
        return res.status(400).json({ error: 'Nombre, teléfono y consulta son obligatorios.' });
      }

      const created = await createInquiry({
        userUid: uid,
        name: String(name).slice(0, 120),
        phone: String(phone).slice(0, 40),
        message: String(message).slice(0, 1000),
        source: String(source || 'Web Contacto').slice(0, 80),
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to save inquiry:', error);
      res.status(500).json({ error: error.message || 'Error al registrar la solicitud.' });
    }
  });

  app.post('/api/trial-bookings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'user@lapontedance.es';
      const userName = req.user!.name || null;

      await getOrCreateUser(uid, email, userName);

      const {
        studentName,
        studentPhone,
        ageGroup,
        activity,
        preferredDate,
        preferredTime,
        calendarEventId,
        calendarHtmlLink,
        notes,
      } = req.body;

      if (!studentName || !studentPhone || !ageGroup || !activity || !preferredDate || !preferredTime) {
        return res.status(400).json({ error: 'Faltan datos obligatorios para la reserva de clase de prueba.' });
      }

      const created = await createTrialBooking({
        userUid: uid,
        studentName: String(studentName).slice(0, 120),
        studentPhone: String(studentPhone).slice(0, 40),
        ageGroup: String(ageGroup).slice(0, 120),
        activity: String(activity).slice(0, 120),
        preferredDate: String(preferredDate).slice(0, 20),
        preferredTime: String(preferredTime).slice(0, 20),
        calendarEventId: calendarEventId ? String(calendarEventId).slice(0, 200) : null,
        calendarHtmlLink: calendarHtmlLink ? String(calendarHtmlLink).slice(0, 500) : null,
        notes: notes ? String(notes).slice(0, 500) : undefined,
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to save trial booking:', error);
      res.status(500).json({ error: error.message || 'Error al registrar la clase de prueba.' });
    }
  });

  app.patch('/api/trial-bookings/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const bookingId = Number(req.params.id);
      if (!bookingId) {
        return res.status(400).json({ error: 'ID de reserva inválido.' });
      }
      const updated = await cancelTrialBookingInDb(bookingId, uid);
      if (!updated) {
        return res.status(404).json({ error: 'Reserva no encontrada.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to cancel trial booking:', error);
      res.status(500).json({ error: error.message || 'Error al cancelar la reserva.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`La Ponte Dance server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
