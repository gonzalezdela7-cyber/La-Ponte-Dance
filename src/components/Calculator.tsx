import React, { useState, useEffect } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Calculator as CalcIcon,
  MessageCircle,
  HelpCircle,
  AlertTriangle,
  BookmarkCheck,
  Mail,
} from 'lucide-react';
import {
  CONFIGURACION_LA_PONTE_DANCE,
  CONFIGURACION_TARIFAS,
  ModalidadPago,
  calcularPresupuestoLaPonte,
  buildWhatsAppUrl,
} from '../data/config.ts';

export interface CalculatorSummaryPayload {
  studentCount: number;
  studentLabel: string;
  ageGroup: string;
  activity: string;
  frequency: string;
  extras: string;
  estimatedAmount: number;
  contactName: string;
  contactPhone: string;
  notes: string;
  formattedSummary: string;
}

interface CalculatorProps {
  preselectedAgeId?: string | null;
  editingEstimate?: any | null;
  onCancelEditingEstimate?: () => void;
  onOpenChatbot: (topic?: string) => void;
  onCompleteToContact: (payload: CalculatorSummaryPayload) => void;
  onSaveEstimateToCloud?: (payload: CalculatorSummaryPayload) => Promise<void>;
  onUpdateEstimateInCloud?: (
    estimateId: number,
    payload: CalculatorSummaryPayload
  ) => Promise<void>;
  onSendViaGmail?: (payload: CalculatorSummaryPayload) => void;
  isAuthenticated: boolean;
}

export const Calculator: React.FC<CalculatorProps> = ({
  preselectedAgeId,
  editingEstimate,
  onCancelEditingEstimate,
  onOpenChatbot,
  onCompleteToContact,
  onSaveEstimateToCloud,
  onUpdateEstimateInCloud,
  onSendViaGmail,
  isAuthenticated,
}) => {
  const { EJEMPLO_NO_OFICIAL, CONFIRMADO } = CONFIGURACION_LA_PONTE_DANCE;

  const [step, setStep] = useState<number>(1);
  const [studentId, setStudentId] = useState<number>(1);
  const [ageId, setAgeId] = useState<string>('adultos');
  const [activityId, setActivityId] = useState<string>('danza-estudio');
  const [frequencyId, setFrequencyId] = useState<string>('1h');
  const [modalidadPago, setModalidadPago] = useState<ModalidadPago>('mensual');
  const [incluirMatricula, setIncluirMatricula] = useState<boolean>(true);

  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
  const [step8Error, setStep8Error] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedAgeId) {
      setAgeId(preselectedAgeId);
      setStep(2);
    }
  }, [preselectedAgeId]);

  useEffect(() => {
    if (!editingEstimate) return;

    const matchedStudent =
      EJEMPLO_NO_OFICIAL.alumnos.find(
        (a) => a.id === Number(editingEstimate.studentCount)
      ) || EJEMPLO_NO_OFICIAL.alumnos[0];
    const matchedAge =
      EJEMPLO_NO_OFICIAL.edades.find(
        (e) => e.label === editingEstimate.ageGroup || e.id === editingEstimate.ageGroup
      ) || EJEMPLO_NO_OFICIAL.edades[0];
    const matchedActivity =
      EJEMPLO_NO_OFICIAL.actividadesOrientativas.find(
        (act) =>
          act.label === editingEstimate.activity || act.id === editingEstimate.activity
      ) || EJEMPLO_NO_OFICIAL.actividadesOrientativas[0];
    const matchedFreq =
      EJEMPLO_NO_OFICIAL.frecuencias.find(
        (f) =>
          f.label === editingEstimate.frequency || f.id === editingEstimate.frequency
      ) || EJEMPLO_NO_OFICIAL.frecuencias[0];

    const extrasStr = String(editingEstimate.extras || '').toLowerCase();
    if (extrasStr.includes('anual')) {
      setModalidadPago('anual');
    } else if (extrasStr.includes('trimestral')) {
      setModalidadPago('trimestral');
    } else {
      setModalidadPago('mensual');
    }
    setIncluirMatricula(!extrasStr.includes('sin matrícula') && !extrasStr.includes('sin matricula'));

    setStudentId(matchedStudent.id);
    setAgeId(matchedAge.id);
    setActivityId(matchedActivity.id);
    setFrequencyId(matchedFreq.id);
    setContactName(editingEstimate.contactName || '');
    setContactPhone(editingEstimate.contactPhone || '');
    setNotes(editingEstimate.notes || '');
    setPrivacyAccepted(true);
    setSavedSuccess(false);
    setStep8Error(null);
    setStep(1);
  }, [editingEstimate]);

  const selectedStudent =
    EJEMPLO_NO_OFICIAL.alumnos.find((a) => a.id === studentId) || EJEMPLO_NO_OFICIAL.alumnos[0];
  const selectedAge =
    EJEMPLO_NO_OFICIAL.edades.find((e) => e.id === ageId) || EJEMPLO_NO_OFICIAL.edades[0];
  const selectedActivity =
    EJEMPLO_NO_OFICIAL.actividadesOrientativas.find((act) => act.id === activityId) ||
    EJEMPLO_NO_OFICIAL.actividadesOrientativas[0];
  const selectedFrequency =
    EJEMPLO_NO_OFICIAL.frecuencias.find((f) => f.id === frequencyId) ||
    EJEMPLO_NO_OFICIAL.frecuencias[0];
  const selectedModalidadObj =
    EJEMPLO_NO_OFICIAL.modalidadesPago.find((m) => m.id === modalidadPago) ||
    EJEMPLO_NO_OFICIAL.modalidadesPago[0];

  // Official calculation using calcularPresupuestoLaPonte
  const resultadoCalculo = calcularPresupuestoLaPonte({
    numAlumnos: selectedStudent.id,
    horasSemanales: selectedFrequency.horasSemanales,
    modalidadPago,
    incluirMatricula,
  });

  const { desgloseEconomico, detalles, avisoLegal } = resultadoCalculo;
  const estimatedAmount = Math.round(desgloseEconomico.cuotaMensualEquivalente);

  const formattedExtrasString = `${selectedModalidadObj.label} · ${
    incluirMatricula
      ? `Con Matrícula (${desgloseEconomico.totalMatricula.toFixed(2)} €)`
      : 'Sin Matrícula (0,00 €)'
  }`;

  const buildPayload = (): CalculatorSummaryPayload => {
    const formattedSummary = [
      `Hola ${CONFIRMADO.nombre}, he realizado una simulación en la Calculadora Web (${avisoLegal}):`,
      `• Nº Alumnos: ${selectedStudent.label} (${detalles.numAlumnos})`,
      `• Grupo de edad: ${selectedAge.label} (${selectedAge.rango})`,
      `• Actividad orientativa: ${selectedActivity.label}`,
      `• Horas semanales: ${detalles.horasSemanales}h/semana (${selectedFrequency.label})`,
      `• Modalidad de pago: ${selectedModalidadObj.label} (Dto. modalidad: ${detalles.porcentajeDescuentoModalidad})`,
      `• Cuota mensual equivalente: ${desgloseEconomico.cuotaMensualEquivalente.toFixed(2)} €/mes`,
      desgloseEconomico.descuentoPorPagoAdelantado > 0
        ? `• Ahorro por pago adelantado: -${desgloseEconomico.descuentoPorPagoAdelantado.toFixed(2)} €`
        : '',
      `• Matrícula orientativa: ${desgloseEconomico.totalMatricula.toFixed(2)} € (${
        incluirMatricula ? 'Incluida' : 'No incluida'
      })`,
      `• Total orientativo a abonar en el periodo (${desgloseEconomico.factorMeses} ${
        desgloseEconomico.factorMeses === 1 ? 'mes' : 'meses'
      }): ${desgloseEconomico.totalAbonarPeriodo.toFixed(2)} € (${avisoLegal})`,
      contactName ? `• Nombre: ${contactName.trim()}` : '',
      contactPhone ? `• Teléfono: ${contactPhone.trim()}` : '',
      notes.trim() ? `• Consulta: ${notes.trim()}` : '',
      `Me gustaría recibir información sobre disponibilidad y tarifas oficiales cuando estén confirmadas.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      studentCount: selectedStudent.id,
      studentLabel: selectedStudent.label,
      ageGroup: selectedAge.label,
      activity: selectedActivity.label,
      frequency: selectedFrequency.label,
      extras: formattedExtrasString,
      estimatedAmount,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      notes: notes.trim(),
      formattedSummary,
    };
  };

  const validateStep8 = (): boolean => {
    if (!contactName.trim()) {
      setStep8Error('Por favor, indica tu nombre para poder atenderte.');
      return false;
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 6) {
      setStep8Error('Por favor, indica un teléfono o WhatsApp de contacto válido.');
      return false;
    }
    if (!privacyAccepted) {
      setStep8Error('Debes aceptar la casilla de privacidad antes de continuar.');
      return false;
    }
    setStep8Error(null);
    return true;
  };

  const handleSendToWhatsApp = () => {
    if (!validateStep8()) return;
    const payload = buildPayload();
    if (isAuthenticated && onSaveEstimateToCloud) {
      onSaveEstimateToCloud(payload).catch((err) => console.error(err));
    }
    const url = buildWhatsAppUrl(payload.formattedSummary);
    window.location.assign(url);
  };

  const handleTransferToContact = () => {
    if (!validateStep8()) return;
    const payload = buildPayload();
    onCompleteToContact(payload);
  };

  const handleSaveCloudOnly = async () => {
    if (!validateStep8()) return;
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      const payload = buildPayload();
      if (editingEstimate?.id && onUpdateEstimateInCloud) {
        await onUpdateEstimateInCloud(editingEstimate.id, payload);
      } else if (onSaveEstimateToCloud) {
        await onSaveEstimateToCloud(payload);
      }
      setSavedSuccess(true);
    } catch (err: any) {
      setStep8Error(err.message || 'No se pudo guardar la estimación.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsNewCopy = async () => {
    if (!validateStep8()) return;
    if (!onSaveEstimateToCloud) return;
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveEstimateToCloud(buildPayload());
      setSavedSuccess(true);
    } catch (err: any) {
      setStep8Error(err.message || 'No se pudo guardar como nuevo presupuesto.');
    } finally {
      setIsSaving(false);
    }
  };

  const stepTitles = [
    '1. Número de alumnos',
    '2. Edad / Perfil',
    '3. Actividad',
    '4. Horas semanales',
    '5. Modalidad y Matrícula',
    '6. Resumen',
    '7. Desglose Económico',
    '8. Contacto',
  ];

  return (
    <div className="bg-white border border-[#E8C5C8] rounded-2xl p-6 md:p-8 shadow-xs">
      {/* Persistent Official Disclaimer Banner */}
      {editingEstimate && (
        <div className="mb-4 p-3.5 rounded-xl bg-[#5C1329]/10 border border-[#5C1329]/30 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[#5C1329]">
            Modo Edición Activo · Modificando presupuesto #{editingEstimate.id} ({editingEstimate.ageGroup} · {editingEstimate.frequency})
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(8)}
              className="px-3 py-1 rounded-lg bg-[#5C1329] text-white text-xs font-semibold"
            >
              Ir al Paso 8 (Guardar/Enviar)
            </button>
            {onCancelEditingEstimate && (
              <button
                type="button"
                onClick={onCancelEditingEstimate}
                className="px-3 py-1 rounded-lg border border-[#5C1329]/30 bg-white text-xs font-semibold text-[#222222]"
              >
                Salir de edición
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 mb-6 border-b border-[#E8C5C8]/60">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#5C1329]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{avisoLegal}</span>
        </div>
        <span className="text-xs text-[#222222]/70">
          Paso {step} de 8 · {stepTitles[step - 1]}
        </span>
      </div>

      {/* Step Progress Bar */}
      <div
        className="grid grid-cols-8 gap-1.5 mb-8"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={8}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            aria-label={`Ir al paso ${s}`}
            className={`h-2 rounded-full transition-colors ${
              s <= step ? 'bg-[#5C1329]' : 'bg-[#E8C5C8]/50 hover:bg-[#E8C5C8]'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Número de alumnos */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 1: ¿Para cuántas personas calculamos?
          </h3>
          <p className="text-sm text-[#222222]/75">
            Selecciona el número de alumnos. A partir del 2º alumno se aplica un{' '}
            <strong>{CONFIGURACION_TARIFAS.descuentoSegundoAlumno * 100}% de descuento familiar</strong> en su cuota mensual (ejemplo no oficial).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {EJEMPLO_NO_OFICIAL.alumnos.map((item) => {
              const active = studentId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStudentId(item.id)}
                  className={`min-h-[68px] p-4 rounded-xl text-left border transition-colors flex flex-col justify-between ${
                    active
                      ? 'bg-[#5C1329] text-white border-[#5C1329]'
                      : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-base">{item.label}</span>
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </div>
                  <span className={`text-xs mt-1 ${active ? 'text-white/80' : 'text-[#222222]/65'}`}>
                    {item.nota}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Edad */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 2: ¿A qué grupo de edad o perfil pertenece?
          </h3>
          <p className="text-sm text-[#222222]/75">
            En {CONFIRMADO.nombre} contamos con formación para niños, jóvenes, adultos y parejas ({CONFIRMADO.rangoGeneral}).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {EJEMPLO_NO_OFICIAL.edades.map((item) => {
              const active = ageId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAgeId(item.id)}
                  className={`min-h-[72px] p-4 rounded-xl text-left border transition-colors ${
                    active
                      ? 'bg-[#5C1329] text-white border-[#5C1329]'
                      : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base">{item.label}</span>
                    <span className={`text-xs ${active ? 'text-[#E8C5C8]' : 'text-[#5C1329]'}`}>
                      {item.rango}
                    </span>
                  </div>
                  <p className={`text-xs mt-1.5 ${active ? 'text-white/85' : 'text-[#222222]/70'}`}>
                    {item.descripcion}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Actividad */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 3: ¿Qué tipo de actividad te interesa?
          </h3>
          <p className="text-sm text-[#222222]/75">
            El catálogo definitivo de disciplinas está pendiente de confirmación oficial. Elige la modalidad orientativa que mejor encaje contigo.
          </p>
          <div className="grid grid-cols-1 gap-3 pt-2">
            {EJEMPLO_NO_OFICIAL.actividadesOrientativas.map((item) => {
              const active = activityId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivityId(item.id)}
                  className={`min-h-[56px] p-4 rounded-xl text-left border transition-colors flex items-center justify-between gap-3 ${
                    active
                      ? 'bg-[#5C1329] text-white border-[#5C1329]'
                      : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                  }`}
                >
                  <span className="font-medium text-sm sm:text-base">{item.label}</span>
                  {active && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Horas semanales */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 4: ¿Cuántas horas semanales te gustaría asistir?
          </h3>
          <p className="text-sm text-[#222222]/75">
            Precios base de ejemplo: <strong>{CONFIGURACION_TARIFAS.preciosBaseEjemplo.precioHoraSemanal.toFixed(2)} €/mes</strong> para 1h/semana +{' '}
            <strong>{CONFIGURACION_TARIFAS.preciosBaseEjemplo.claseAdicional.toFixed(2)} €/mes</strong> por cada hora extra semanal ({avisoLegal}).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {EJEMPLO_NO_OFICIAL.frecuencias.map((item) => {
              const active = frequencyId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFrequencyId(item.id)}
                  className={`min-h-[76px] p-4 rounded-xl text-left border transition-colors flex flex-col justify-between ${
                    active
                      ? 'bg-[#5C1329] text-white border-[#5C1329]'
                      : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm sm:text-base">{item.label}</span>
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </div>
                  <span
                    className={`text-xs mt-2 tabular-nums ${
                      active ? 'text-[#E8C5C8]' : 'text-[#5C1329]'
                    }`}
                  >
                    Cuota base 1 alumno: {item.baseEjemploMensual.toFixed(2)} €/mes (No oficial)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Modalidad de Pago y Matrícula */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-[#222222]">
              Paso 5: Modalidad de pago y matrícula orientativa
            </h3>
            <p className="text-sm text-[#222222]/75">
              Elige la periodicidad de pago para aplicar bonificaciones por pago adelantado y si deseas incluir la matrícula en el cálculo ({avisoLegal}).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {EJEMPLO_NO_OFICIAL.modalidadesPago.map((mod) => {
              const active = modalidadPago === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setModalidadPago(mod.id)}
                  className={`min-h-[84px] p-4 rounded-xl text-left border transition-colors flex flex-col justify-between ${
                    active
                      ? 'bg-[#5C1329] text-white border-[#5C1329]'
                      : 'bg-[#FBF8F6] text-[#222222] border-[#E8C5C8] hover:border-[#5C1329]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{mod.label}</span>
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </div>
                  <span
                    className={`text-xs mt-2 ${
                      active ? 'text-[#E8C5C8]' : 'text-[#5C1329] font-medium'
                    }`}
                  >
                    {mod.nota}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle Matrícula */}
          <div className="p-4 rounded-xl bg-[#FBF8F6] border border-[#E8C5C8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-[#222222]">
                ¿Incluir matrícula en el primer pago? (Ejemplo:{' '}
                {CONFIGURACION_TARIFAS.preciosBaseEjemplo.matricula.toFixed(2)} € por alumno)
              </div>
              <p className="text-xs text-[#222222]/70">
                Para {selectedStudent.id} alumno(s):{' '}
                {(CONFIGURACION_TARIFAS.preciosBaseEjemplo.matricula * selectedStudent.id).toFixed(2)} € de matrícula orientativa.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIncluirMatricula(true)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  incluirMatricula
                    ? 'bg-[#5C1329] text-white border-[#5C1329]'
                    : 'bg-white text-[#222222] border-[#E8C5C8]'
                }`}
              >
                Sí, incluir matrícula
              </button>
              <button
                type="button"
                onClick={() => setIncluirMatricula(false)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  !incluirMatricula
                    ? 'bg-[#5C1329] text-white border-[#5C1329]'
                    : 'bg-white text-[#222222] border-[#E8C5C8]'
                }`}
              >
                Sin matrícula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Resumen */}
      {step === 6 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 6: Resumen de tu configuración
          </h3>
          <p className="text-sm text-[#222222]/75">
            Comprueba que los parámetros seleccionados son correctos antes de ver el desglose económico completo. Puedes pulsar en cualquier fila para modificarla.
          </p>
          <div className="divide-y divide-[#E8C5C8]/60 border border-[#E8C5C8] rounded-xl bg-[#FBF8F6] px-4">
            <div className="py-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-[#222222]/70">1. Alumnos</span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-semibold text-[#5C1329] hover:underline"
              >
                {selectedStudent.label}
              </button>
            </div>
            <div className="py-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-[#222222]/70">2. Edad / Perfil</span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="font-semibold text-[#5C1329] hover:underline"
              >
                {selectedAge.label} ({selectedAge.rango})
              </button>
            </div>
            <div className="py-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-[#222222]/70">3. Actividad</span>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="font-semibold text-[#5C1329] hover:underline text-right"
              >
                {selectedActivity.label}
              </button>
            </div>
            <div className="py-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-[#222222]/70">4. Horas semanales</span>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="font-semibold text-[#5C1329] hover:underline"
              >
                {selectedFrequency.label}
              </button>
            </div>
            <div className="py-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-[#222222]/70">5. Modalidad y Matrícula</span>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="font-semibold text-[#5C1329] hover:underline text-right"
              >
                {formattedExtrasString}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 7: Desglose Económico Completo */}
      {step === 7 && (
        <div className="space-y-5">
          <h3 className="text-2xl font-semibold text-[#222222]">
            Paso 7: Desglose económico del prototipo
          </h3>
          <div className="p-6 rounded-xl bg-[#FBF8F6] border-2 border-[#5C1329] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold tracking-wider text-[#5C1329] uppercase">
                {avisoLegal}
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#E8C5C8]/60 text-[#5C1329]">
                Modalidad: {detalles.modalidadPago.toUpperCase()} ({detalles.porcentajeDescuentoModalidad} dto.)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-white border border-[#E8C5C8]">
                <div className="text-xs text-[#222222]/70">Cuota mensual equivalente</div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-3xl sm:text-4xl font-bold text-[#222222] tabular-nums font-display">
                    {desgloseEconomico.cuotaMensualEquivalente.toFixed(2)} €
                  </span>
                  <span className="text-xs text-[#222222]/70">/ mes</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#5C1329]/40">
                <div className="text-xs text-[#5C1329] font-semibold">
                  Total a abonar en el periodo ({desgloseEconomico.factorMeses}{' '}
                  {desgloseEconomico.factorMeses === 1 ? 'mes' : 'meses'})
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-3xl sm:text-4xl font-bold text-[#5C1329] tabular-nums font-display">
                    {desgloseEconomico.totalAbonarPeriodo.toFixed(2)} €
                  </span>
                  <span className="text-xs text-[#222222]/70">primer pago</span>
                </div>
              </div>
            </div>

            {/* Detailed Line Items from calcularPresupuestoLaPonte */}
            <div className="bg-white rounded-xl border border-[#E8C5C8] p-4 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-[#222222]/80">
                <span>
                  Cuota mensual bruta ({detalles.numAlumnos} alumno(s) · {detalles.horasSemanales}h/sem):
                </span>
                <span className="font-semibold tabular-nums">
                  {desgloseEconomico.cuotaMensualBruta.toFixed(2)} €/mes
                </span>
              </div>
              <div className="flex justify-between text-[#222222]/80">
                <span>
                  Descuento por pago adelantado ({detalles.porcentajeDescuentoModalidad} en{' '}
                  {desgloseEconomico.factorMeses}{' '}
                  {desgloseEconomico.factorMeses === 1 ? 'mes' : 'meses'}):
                </span>
                <span className="font-semibold text-[#5C1329] tabular-nums">
                  -{desgloseEconomico.descuentoPorPagoAdelantado.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-[#222222]/80">
                <span>
                  Total matrícula ({incluirMatricula ? `${detalles.numAlumnos} × 20,00 €` : 'No incluida'}):
                </span>
                <span className="font-semibold tabular-nums">
                  {desgloseEconomico.totalMatricula.toFixed(2)} €
                </span>
              </div>
              <div className="pt-2 border-t border-[#E8C5C8] flex justify-between font-bold text-[#222222]">
                <span>Total primer pago ({detalles.modalidadPago}):</span>
                <span className="text-[#5C1329] tabular-nums">
                  {desgloseEconomico.totalAbonarPeriodo.toFixed(2)} €
                </span>
              </div>
            </div>

            <p className="text-xs text-[#222222]/80 leading-relaxed">
              {EJEMPLO_NO_OFICIAL.aclaracion} Las tarifas oficiales, matrículas y descuentos definitivos están pendientes de confirmación por parte de {CONFIRMADO.nombre} en {CONFIRMADO.localidad}.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-[#222222]/70">
              En el siguiente paso podrás enviar este desglose a {CONFIRMADO.nombre} para conocer las tarifas reales.
            </span>
            <button
              type="button"
              onClick={() => onOpenChatbot('tarifas')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C1329] hover:underline"
            >
              <HelpCircle className="w-4 h-4" />
              Resolver mis dudas sobre tarifas
            </button>
          </div>
        </div>
      )}

      {/* Step 8: Contacto */}
      {step === 8 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-2xl font-semibold text-[#222222]">
              Paso 8: Solicita confirmación oficial con tu resumen
            </h3>
            <p className="text-sm text-[#222222]/75 mt-1">
              Introduce tus datos para trasladar tu configuración ({selectedStudent.label} · {selectedAge.label} · {selectedFrequency.label} · {selectedModalidadObj.label}) directamente a {CONFIRMADO.nombre}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#222222] mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
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
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Ej. 600 000 000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#222222] mb-1.5">
              Consulta o preferencia de horario (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indica si prefieres horario de mañana o tarde, edad exacta o cualquier duda..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#E8C5C8] bg-[#FBF8F6] text-sm text-[#222222] focus:outline-none focus:border-[#5C1329]"
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
              Acepto que {CONFIRMADO.nombre} trate mis datos únicamente para responder a esta solicitud de información. Textos legales definitivos: {CONFIGURACION_LA_PONTE_DANCE.meta.avisoLegalPendiente}.
            </span>
          </label>

          {step8Error && (
            <div className="p-3 rounded-lg bg-[#5C1329]/10 text-[#5C1329] text-xs font-medium">
              {step8Error}
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-lg bg-[#E8C5C8]/50 text-[#222222] text-xs font-medium">
              Estimación guardada correctamente en tu historial personal de La Ponte Dance.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSendToWhatsApp}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              Hablar por WhatsApp ({CONFIRMADO.telefono})
            </button>

            <button
              type="button"
              onClick={handleTransferToContact}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#5C1329] text-[#5C1329] text-sm font-semibold hover:bg-[#E8C5C8]/30 transition-colors whitespace-nowrap"
            >
              <CalcIcon className="w-4 h-4" />
              Pasar al formulario de Contacto
            </button>

            {isAuthenticated && onSendViaGmail && (
              <button
                type="button"
                onClick={() => {
                  if (!validateStep8()) return;
                  onSendViaGmail(buildPayload());
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#FBF8F6] border border-[#E8C5C8] text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors whitespace-nowrap"
              >
                <Mail className="w-4 h-4 text-[#5C1329]" />
                Enviar por Gmail con confirmación
              </button>
            )}

            {isAuthenticated && (onSaveEstimateToCloud || onUpdateEstimateInCloud) && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveCloudOnly}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#FBF8F6] border border-[#E8C5C8] text-[#222222] text-xs font-semibold hover:border-[#5C1329] transition-colors whitespace-nowrap"
              >
                <BookmarkCheck className="w-4 h-4 text-[#5C1329]" />
                {isSaving
                  ? 'Guardando...'
                  : editingEstimate
                  ? 'Actualizar presupuesto editado'
                  : 'Guardar en Mi Espacio'}
              </button>
            )}

            {isAuthenticated && editingEstimate && onSaveEstimateToCloud && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAsNewCopy}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white border border-[#E8C5C8] text-[#5C1329] text-xs font-semibold hover:border-[#5C1329] transition-colors whitespace-nowrap"
              >
                Guardar como copia nueva
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Footer for Steps 1–8 */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-[#E8C5C8]/60">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            step === 1
              ? 'text-[#222222]/30 cursor-not-allowed'
              : 'text-[#222222] hover:bg-[#FBF8F6] border border-[#E8C5C8]'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Paso anterior
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChatbot('presupuesto')}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#5C1329] hover:underline whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Resolver mis dudas
          </button>

          {step < 8 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(8, s + 1))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#5C1329] text-white text-sm font-semibold hover:bg-[#460e1f] transition-colors whitespace-nowrap"
            >
              {step === 6
                ? 'Ver desglose económico'
                : step === 7
                ? 'Continuar a contacto'
                : 'Siguiente paso'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
