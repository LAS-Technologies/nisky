import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck2, CheckCircle2, Timer } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(20rem,0.85fr)_minmax(32rem,1.15fr)]">
      <aside className="hidden min-h-screen flex-col justify-between bg-primary px-10 py-10 text-on-primary lg:flex xl:px-16">
        <Link className="inline-flex items-center gap-3 self-start" href="/" prefetch={false}>
          <BrandMark size={48} />
          <span className="font-headline-lg text-headline-lg font-bold tracking-tight">Nisky</span>
        </Link>

        <div className="max-w-md">
          <p className="font-label-caps text-label-caps text-primary-fixed">ORGANIZA CON CALMA</p>
          <h2 className="mt-4 font-display-hero text-display-hero">Un espacio claro para hacer lo importante.</h2>
          <p className="mt-5 max-w-sm font-body-lg text-body-lg text-primary-fixed">
            Tareas, notas y tiempo en un solo lugar, con el contexto justo para avanzar sin ruido.
          </p>

          <div className="mt-10 grid gap-3">
            <AuthBenefit Icon={CheckCircle2} label="Enfócate en la siguiente acción" />
            <AuthBenefit Icon={CalendarCheck2} label="Planifica tu día con intención" />
            <AuthBenefit Icon={Timer} label="Protege tus bloques de atención" />
          </div>
        </div>

        <p className="font-label-md text-label-md text-primary-fixed/75">Tu espacio personal para avanzar.</p>
      </aside>

      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}

function AuthBenefit({ Icon, label }: { Icon: typeof CheckCircle2; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-primary-fixed/20 bg-on-primary/5 px-3 py-3">
      <Icon aria-hidden="true" className="shrink-0 text-primary-fixed" size={18} />
      <span className="font-body-sm text-body-sm text-primary-fixed/90">{label}</span>
    </div>
  );
}
