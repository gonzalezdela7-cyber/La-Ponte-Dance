import heroImg from '../assets/images/hero_dance_studio_1791358736216.jpg';
import studioImg from '../assets/images/studio_interior_torrijos_1791358748221.jpg';
import adultsImg from '../assets/images/classes_adults_couples_1791358758159.jpg';
import kidsImg from '../assets/images/classes_kids_youth_1791358770197.jpg';

export const ASSETS = {
  heroDanceStudio: heroImg,
  studioInterior: studioImg,
  classesAdultsCouples: adultsImg,
  classesKidsYouth: kidsImg,
};

export type ModalidadPago = 'mensual' | 'trimestral' | 'anual';

/**
 * LÓGICA DE CÁLCULO DE PRESUPUESTO - LA PONTE DANCE
 * Estado: PROTOTIPO CON PRECIOS DE EJEMPLO NO OFICIALES
 */
export const CONFIGURACION_TARIFAS = {
  esOficial: false, // Variable de control para cumplimiento de veracidad
  etiquetaAviso: 'PRECIOS DE EJEMPLO — NO OFICIALES',

  // Precios base ficticios (solo para demostración técnica del prototipo)
  preciosBaseEjemplo: {
    matricula: 20.0,
    precioHoraSemanal: 25.0, // Coste base para 1h/semana al mes
    claseAdicional: 15.0, // Coste adicional por cada hora extra semanal
  },

  // Porcentajes de descuento aplicables por pago por adelantado (Configurables)
  descuentosPagoAdelantado: {
    mensual: 0.0, // 0% descuento
    trimestral: 0.05, // 5% de descuento por pago trimestral por adelantado
    anual: 0.12, // 12% de descuento por pago anual por adelantado
  } as Record<ModalidadPago, number>,

  // Descuento por número de alumnos (familiares)
  descuentoSegundoAlumno: 0.1, // 10% en la cuota del 2º alumno
};

export interface DatosEntradaPresupuesto {
  numAlumnos?: number;
  horasSemanales?: number;
  modalidadPago?: ModalidadPago;
  incluirMatricula?: boolean;
}

export interface ResultadoPresupuestoLaPonte {
  oficial: boolean;
  avisoLegal: string;
  detalles: {
    numAlumnos: number;
    horasSemanales: number;
    modalidadPago: ModalidadPago;
    porcentajeDescuentoModalidad: string;
  };
  desgloseEconomico: {
    cuotaMensualBruta: number;
    cuotaMensualEquivalente: number;
    descuentoPorPagoAdelantado: number;
    totalMatricula: number;
    totalAbonarPeriodo: number;
    factorMeses: number;
  };
}

/**
 * Función principal para calcular el presupuesto
 */
export function calcularPresupuestoLaPonte({
  numAlumnos = 1,
  horasSemanales = 1,
  modalidadPago = 'mensual',
  incluirMatricula = true,
}: DatosEntradaPresupuesto): ResultadoPresupuestoLaPonte {
  const cfg = CONFIGURACION_TARIFAS;

  // A. Cálculo de la cuota base mensual por alumno
  let cuotaMensualBase = cfg.preciosBaseEjemplo.precioHoraSemanal;
  if (horasSemanales > 1) {
    cuotaMensualBase += (horasSemanales - 1) * cfg.preciosBaseEjemplo.claseAdicional;
  }

  // B. Cálculo del total mensual agregando alumnos (aplica dto. a partir del 2º alumno)
  let totalCuotaMensualBruta = 0;
  for (let i = 1; i <= numAlumnos; i++) {
    if (i === 1) {
      totalCuotaMensualBruta += cuotaMensualBase;
    } else {
      totalCuotaMensualBruta += cuotaMensualBase * (1 - cfg.descuentoSegundoAlumno);
    }
  }

  // C. Aplicación de bonificación por pago por adelantado
  const porcentajeDescuentoPago = cfg.descuentosPagoAdelantado[modalidadPago] || 0;
  const descuentoAplicadoCuota = totalCuotaMensualBruta * porcentajeDescuentoPago;
  const cuotaMensualFinal = totalCuotaMensualBruta - descuentoAplicadoCuota;

  // D. Cálculo de matrícula total
  const totalMatricula = incluirMatricula
    ? cfg.preciosBaseEjemplo.matricula * numAlumnos
    : 0;

  // E. Facturación según la modalidad seleccionada
  let factorMeses = 1;
  if (modalidadPago === 'trimestral') factorMeses = 3;
  if (modalidadPago === 'anual') factorMeses = 9; // Pago del curso lectivo (9 meses)

  const totalPagoAdelantadoCuotas = cuotaMensualFinal * factorMeses;
  const totalPrimerPago = totalPagoAdelantadoCuotas + totalMatricula;

  // F. Generación del objeto de resultado
  return {
    oficial: cfg.esOficial,
    avisoLegal: cfg.esOficial ? 'Tarifas Oficiales La Ponte Dance' : cfg.etiquetaAviso,
    detalles: {
      numAlumnos,
      horasSemanales,
      modalidadPago,
      porcentajeDescuentoModalidad: `${Math.round(porcentajeDescuentoPago * 100)}%`,
    },
    desgloseEconomico: {
      cuotaMensualBruta: Number(totalCuotaMensualBruta.toFixed(2)),
      cuotaMensualEquivalente: Number(cuotaMensualFinal.toFixed(2)),
      descuentoPorPagoAdelantado: Number((descuentoAplicadoCuota * factorMeses).toFixed(2)),
      totalMatricula: Number(totalMatricula.toFixed(2)),
      totalAbonarPeriodo: Number(totalPrimerPago.toFixed(2)),
      factorMeses,
    },
  };
}

export const CONFIGURACION_LA_PONTE_DANCE = {
  meta: {
    fase: 'Fase 4 — Ecosistema Digital Integrado',
    avisoPrecios: 'PRECIOS DE EJEMPLO — NO OFICIALES',
    avisoLegalPendiente: '[PENDIENTE DE CONFIRMAR / REVISIÓN LEGAL]',
  },

  // 1. DATOS CONFIRMADOS OFICIALES
  CONFIRMADO: {
    nombre: 'La Ponte Dance',
    localidad: 'Torrijos, Toledo',
    telefono: '653860324',
    telefonoInternacional: '+34653860324',
    whatsappUrlBase: 'https://wa.me/34653860324',
    email: 'silviapontejuan@gmail.com',
    instagramHandle: '@laponte_dance',
    instagramUrl: 'https://instagram.com/laponte_dance',
    publico: ['Niños', 'Jóvenes', 'Adultos', 'Parejas'],
    rangoGeneral: '3 a 99 años',
    edadMinima: 3,
    edadMaxima: 99,
  },

  // 2. DATOS PENDIENTES DE CONFIRMAR (Nunca se presentan como cerrados)
  PENDIENTE_DE_CONFIRMAR: {
    direccionExacta: 'Dirección exacta en Torrijos, Toledo [PENDIENTE DE CONFIRMAR]',
    catalogoDisciplinas: 'Catálogo definitivo de disciplinas [PENDIENTE DE CONFIRMAR]',
    horarios: 'Cuadrante oficial de horarios por grupo [PENDIENTE DE CONFIRMAR]',
    tarifasReales: 'Tarifas oficiales del estudio [PENDIENTE DE CONFIRMAR]',
    matriculas: 'Importe y condiciones de matrícula [PENDIENTE DE CONFIRMAR]',
    descuentos: 'Descuentos familiares o multiclase [PENDIENTE DE CONFIRMAR]',
    promociones: 'Promociones de apertura o temporada [PENDIENTE DE CONFIRMAR]',
    profesorado: 'Equipo docente por especialidad [PENDIENTE DE CONFIRMAR]',
    normasInscripcion: 'Normativa oficial de inscripción [PENDIENTE DE CONFIRMAR]',
    disponibilidad: 'Cupos y plazas disponibles por grupo [PENDIENTE DE CONFIRMAR]',
  },

  // 3. DATOS DE EJEMPLO NO OFICIALES (Exclusivos para la simulación de la Calculadora)
  EJEMPLO_NO_OFICIAL: {
    etiquetaObligatoria: 'PRECIOS DE EJEMPLO — NO OFICIALES',
    aclaracion:
      'Importes ficticios de demostración técnica. Las tarifas reales de La Ponte Dance están pendientes de confirmación.',
    alumnos: [
      {
        id: 1,
        label: '1 Alumno/a',
        multiplicadorEjemplo: 1,
        nota: 'Inscripción individual (cuota base ejemplo)',
      },
      {
        id: 2,
        label: '2 Alumnos/as (Pareja o Hermanos)',
        multiplicadorEjemplo: 1.9,
        nota: 'Aplica 10% dto. ejemplo en el 2º alumno',
      },
      {
        id: 3,
        label: '3 Alumnos (Unidad Familiar)',
        multiplicadorEjemplo: 2.8,
        nota: 'Aplica 10% dto. ejemplo desde el 2º alumno',
      },
    ],
    edades: [
      {
        id: 'ninos',
        label: 'Niños (Infantil)',
        rango: 'Desde 3 años',
        descripcion: 'Iniciación al movimiento, ritmo, psicomotricidad, creatividad y diversión en grupo.',
        imagen: kidsImg,
      },
      {
        id: 'jovenes',
        label: 'Jóvenes',
        rango: 'Adolescentes y jóvenes',
        descripcion: 'Energía, técnica, expresión corporal, coreografía y trabajo en equipo.',
        imagen: kidsImg,
      },
      {
        id: 'adultos',
        label: 'Adultos',
        rango: 'Todas las edades hasta 99 años',
        descripcion: 'Formación, desconexión, bienestar físico y pasión por el baile sin importar el nivel inicial.',
        imagen: adultsImg,
      },
      {
        id: 'parejas',
        label: 'Parejas',
        rango: 'Adultos en pareja',
        descripcion: 'Coordinación, complicidad, baile social y preparación de coreografías en pareja.',
        imagen: adultsImg,
      },
    ],
    actividadesOrientativas: [
      {
        id: 'danza-estudio',
        label: 'Formación de Danza en Grupo (Modalidad por confirmar)',
        suplementoEjemplo: 0,
      },
      {
        id: 'ritmos-baile',
        label: 'Clases de Baile y Movimiento (Modalidad por confirmar)',
        suplementoEjemplo: 0,
      },
      {
        id: 'baile-pareja',
        label: 'Programa Especial Parejas / Coreografía (Modalidad por confirmar)',
        suplementoEjemplo: 0,
      },
      {
        id: 'orientacion-personalizada',
        label: 'Necesito orientación para elegir mi clase ideal',
        suplementoEjemplo: 0,
      },
    ],
    frecuencias: [
      {
        id: '1h',
        horasSemanales: 1,
        label: '1 hora por semana (1h/sem)',
        baseEjemploMensual: 25,
      },
      {
        id: '2h',
        horasSemanales: 2,
        label: '2 horas por semana (2h/sem)',
        baseEjemploMensual: 40,
      },
      {
        id: 'intensivo',
        horasSemanales: 3,
        label: '3 horas por semana (3h/sem)',
        baseEjemploMensual: 55,
      },
      {
        id: '4h',
        horasSemanales: 4,
        label: '4 horas por semana (4h/sem)',
        baseEjemploMensual: 70,
      },
    ],
    modalidadesPago: [
      {
        id: 'mensual' as ModalidadPago,
        label: 'Pago Mensual (0% dto.)',
        descuentoLabel: '0% descuento',
        meses: 1,
        nota: 'Abono mes a mes',
      },
      {
        id: 'trimestral' as ModalidadPago,
        label: 'Pago Trimestral por adelantado (-5% dto.)',
        descuentoLabel: '5% de descuento en cuota',
        meses: 3,
        nota: '3 meses con 5% de bonificación (Ejemplo)',
      },
      {
        id: 'anual' as ModalidadPago,
        label: 'Pago Anual Curso Lectivo 9 meses (-12% dto.)',
        descuentoLabel: '12% de descuento en cuota',
        meses: 9,
        nota: 'Curso completo (9 meses) con 12% dto. (Ejemplo)',
      },
    ],
    extras: [
      { id: 'ninguno', label: 'Pago Mensual · Con Matrícula (20 €/alumno)', costeEjemplo: 20 },
      { id: 'clase-suelta', label: 'Pago Trimestral (-5% dto.) · Con Matrícula', costeEjemplo: 20 },
      { id: 'coreografia-evento', label: 'Pago Anual 9 meses (-12% dto.) · Con Matrícula', costeEjemplo: 20 },
    ],
  },
};

export function buildWhatsAppUrl(customMessage: string): string {
  const encoded = encodeURIComponent(customMessage);
  return `${CONFIGURACION_LA_PONTE_DANCE.CONFIRMADO.whatsappUrlBase}?text=${encoded}`;
}

export interface WhatsAppTemplateItem {
  id: string;
  numero: string;
  titulo: string;
  objetivo: string;
  mensaje: string;
}

export const PLANTILLAS_WHATSAPP_OFICIALES: WhatsAppTemplateItem[] = [
  {
    id: 'bienvenida-general',
    numero: 'PLANTILLA 1',
    titulo: 'Bienvenida General (Respuesta Automática / Fuera de Horario)',
    objetivo:
      'Dar una respuesta inmediata cuando un usuario escribe por primera vez o fuera del horario de atención.',
    mensaje: `¡Hola! 👋 Te damos la bienvenida a La Ponte Dance, tu estudio de danza en Torrijos (Toledo) ✨.

Gracias por ponerte en contacto con nosotros. Para poder ayudarte mejor, cuéntanos:
1. ¿Cuál es tu nombre?
2. ¿Para qué edad o persona buscas información? (Atendemos desde los 3 hasta los 99 años)

📌 Nota: Los horarios y tarifas oficiales del próximo curso están actualmente [PENDIENTE DE CONFIRMAR]. Nos pondremos en contacto contigo lo antes posible para atender tu consulta personalmente.

📸 Síguenos en Instagram: https://instagram.com/laponte_dance`,
  },
  {
    id: 'clases-infantiles-juveniles',
    numero: 'PLANTILLA 2',
    titulo: 'Consulta por Clases Infantiles / Juveniles',
    objetivo:
      'Responder a padres o tutores interesados en inscribir a sus hijos.',
    mensaje: `¡Hola! 😊 Qué alegría contar con vosotras/os en La Ponte Dance.

En nuestro estudio contamos con alternativas para niños y jóvenes desde los 3 años en adelante. El catálogo definitivo de disciplinas y horarios por grupos de edad se encuentra actualmente [PENDIENTE DE CONFIRMAR].

Si quieres, déjanos el nombre y la edad exacta de tu hijo/a. Te anotaremos en nuestra lista de contacto prioritario para enviarte la propuesta de clases en cuanto se publique 🩰.`,
  },
  {
    id: 'clases-adultos',
    numero: 'PLANTILLA 3',
    titulo: 'Consulta por Clases para Adultos',
    objetivo:
      'Atender a personas interesadas en clases de baile para adultos, ejercicio o desconexión.',
    mensaje: `¡Hola! ✨ Gracias por escribir a La Ponte Dance.

Ofrecemos espacios y grupos pensados para adultos que desean aprender a bailar, mantenerse activos o disfrutar de la danza en Torrijos (hasta los 99 años, ¡nunca es tarde para empezar!).

Actualmente estamos cerrando los horarios y modalidades definitivas ([PENDIENTE DE CONFIRMAR]). Cuéntanos qué días o franjas horarias (mañana o tarde) te vendrían mejor para tenerlo muy en cuenta y avisarte en primicia.`,
  },
  {
    id: 'parejas-bodas-eventos',
    numero: 'PLANTILLA 4',
    titulo: 'Consulta para Parejas / Bailes de Boda y Eventos',
    objetivo:
      'Responder a parejas que buscan clases conjuntas o preparar su baile nupcial / evento.',
    mensaje: `¡Hola! 🥂✨ ¡Qué ilusión! Gracias por contactar con La Ponte Dance en Torrijos.

Contamos con atención para parejas que desean aprender a bailar juntas o preparar un baile especial para su boda o evento. Las tarifas y disponibilidad de horarios particulares están actualmente [PENDIENTE DE CONFIRMAR].

Para darte una orientación personalizada, cuéntanos:
• ¿Tenéis alguna fecha de evento o idea musical en mente?
• ¿Qué disponibilidad horaria tenéis entre semana?

Te responderemos enseguida para organizarlo juntos.`,
  },
  {
    id: 'tarifas-presupuestos',
    numero: 'PLANTILLA 5',
    titulo: 'Consulta de Tarifas, Precios y Matrículas',
    objetivo:
      'Aclarar dudas tras usar la calculadora orientativa de la web o al preguntar precios directamente.',
    mensaje: `¡Hola! 👋 Gracias por tu interés en La Ponte Dance (Torrijos, Toledo).

Te informamos con total transparencia de que las tarifas oficiales, mensualidades, matrículas y descuentos del estudio se encuentran actualmente [PENDIENTE DE CONFIRMAR]. (Recuerda que cualquier cálculo realizado en el simulador de nuestra web utiliza precios de ejemplo no oficiales).

Si nos indicas para cuántas personas buscas clase y de qué edades (de 3 a 99 años), te enviaremos las tarifas oficiales definitivas en cuanto queden cerradas.

📱 WhatsApp Oficial: 653860324
✉️ Email: silviapontejuan@gmail.com
📸 Instagram: https://instagram.com/laponte_dance`,
  },
  {
    id: 'confirmacion-clase-prueba',
    numero: 'PLANTILLA 6',
    titulo: 'Seguimiento de Solicitud de Clase de Prueba / Ubicación',
    objetivo:
      'Confirmar la recepción de una solicitud de clase de prueba o informar sobre la dirección en Torrijos.',
    mensaje: `¡Hola! 🩰 Hemos recibido tu solicitud para La Ponte Dance en Torrijos (Toledo).

Tanto la dirección exacta del estudio como los cuadrantes definitivos de horarios para las clases de prueba están actualmente [PENDIENTE DE CONFIRMAR].

Hemos registrado tus datos y preferencias correctamente. En cuanto confirmemos el calendario oficial de puertas abiertas y grupos, contactaremos contigo en este mismo número para asignarte tu plaza. ¡Muchas gracias por tu confianza! ✨`,
  },
];

