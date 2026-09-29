"use client";

import { OfficialPage, OfficialHeader } from "@/components/ui/OfficialPage";
import { ArrowLeft, ChevronDown, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { MyFeedbackList } from "@/components/feedback/MyFeedbackList";

const FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "¿Cómo organizo mis tareas?",
    answer:
      "Entra a Tareas. Usa la Lista para revisar tus fechas límite y la sección Sin fecha límite para encontrar lo que todavía necesita una fecha. Para reservar una hora concreta, crea un bloque en Agenda y asígnale las tareas.",
  },
  {
    question: "¿Qué es la Agenda?",
    answer:
      "La Agenda es para reservar horas de tu día como si fueran citas contigo mismo: clases, estudio, deporte... En computador puedes arrastrar directamente sobre la parrilla para apartar el tiempo que quieras. En el móvil, toca una hora libre y completa los datos, o pulsa el botón + abajo a la derecha. Si algo se repite cada semana, dile que se repita y listo. También puedes pedirle a Nisky que te avise antes de que empiece.",
  },
  {
    question: "¿Cómo me concentro mejor?",
    answer:
      "El Modo enfoque es un cronómetro sencillo para estudiar o trabajar sin distracciones. Elige cuánto quieres enfocarte, tómate tus descansos y dale. Tú controlas el ritmo.",
  },
  {
    question: "¿Dónde guardo una idea rápida?",
    answer:
      'Como nota rápida: en computador pulsa el botón "Nota" arriba a la derecha (o Alt+N), y en el móvil usa el botón flotante que aparece en Inicio. Escribe y se guarda solo; luego puedes archivarla o borrarla.',
  },
  {
    question: "¿Cómo me llegan los recordatorios?",
    answer:
      "Crea tus recordatorios en la sección Recordatorios. Y si activas las notificaciones en Ajustes › Notificaciones, Nisky te avisa cuando una tarea o un bloque de tu Agenda se acerca, o cuando tu plataforma tenga novedades.",
  },
  {
    question: "¿Cómo conecto mi universidad?",
    answer:
      "Ve a Ajustes › Integraciones y elige tu universidad de la lista (ITLA, INTEC, PUCMM, UNAPEC, UCNE u otra). Con tus credenciales o un token, Nisky conecta la plataforma de tu institución y trae tus tareas y entregas próximas.",
  },
  {
    question: "¿Mis notas y mi diario son privados?",
    answer:
      "El contenido del diario se cifra antes de guardarse y solo puedes abrirlo con una sesión activa. Tus notas son privadas, salvo las que compartes en proyectos.",
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <OfficialPage className="space-y-6">
      {feedbackOpen ? (
        <>
          <OfficialHeader eyebrow="FEEDBACK" title="Tu experiencia importa" description="Cuéntanos qué funciona y qué podemos mejorar." actions={<button className="official-button" onClick={() => setFeedbackOpen(false)} type="button"><ArrowLeft size={16} />Volver a ayuda</button>} />
          <div className="official-split">
            <FeedbackForm />
            <aside className="official-panel">
              <h2>Mis mensajes</h2>
              <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">Gracias por ayudarnos a cuidar los detalles. Aquí puedes seguir los mensajes que compartiste con el equipo.</p>
              <MyFeedbackList />
            </aside>
          </div>
        </>
      ) : (
        <>
          <OfficialHeader eyebrow="AYUDA" title="Estamos para ayudarte" description="Encuentra respuestas y sigue con tu día." />
          <div className="official-split">
            <div className="official-panel">
              <h2 className="font-headline-md text-headline-md text-on-surface">Preguntas frecuentes</h2>
              <div className="mt-3 divide-y divide-outline-variant">
                {FAQS.map((item, index) => {
                  const open = openIndex === index;
                  return (
                    <div key={item.question}>
                      <button
                        aria-expanded={open}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md py-3 text-left transition-colors hover:bg-surface-container-low"
                        onClick={() => setOpenIndex(open ? null : index)}
                        type="button"
                      >
                        <span className="font-body-md text-body-md text-on-surface">{item.question}</span>
                        <ChevronDown className={`shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} size={18} />
                      </button>
                      {open && <p className="pb-3 font-body-sm text-body-sm text-on-surface-variant">{item.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="official-panel">
              <h2>Te escuchamos</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="mx-auto my-5 h-36 w-full object-contain" height={180} src="/design-official/otter-at-desk.png" width={320} />
              <h3 className="font-headline-sm text-headline-sm">¿No encontraste lo que buscabas?</h3>
              <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Cuéntanos tu duda o comparte una idea para mejorar Nisky.</p>
              <button className="official-button mt-4 w-full" data-primary onClick={() => setFeedbackOpen(true)} type="button"><MessageSquarePlus size={16} />Enviar feedback</button>
            </aside>
          </div>
        </>
      )}
    </OfficialPage>
  );
}
