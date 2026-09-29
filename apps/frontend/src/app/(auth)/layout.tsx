import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/ui/BrandMark";
import "@/components/ui/official.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="official-auth">
    <aside className="official-auth-intro">
      <Link className="inline-flex items-center gap-4 text-primary" href="/" prefetch={false}><BrandMark size={64}/><span className="font-headline-lg font-bold text-3xl">Nisky</span></Link>
      <div><p className="official-eyebrow">ORGANIZA CON CALMA</p><h2>Un espacio claro para hacer lo importante.</h2><p className="official-description">Tareas, notas y tiempo en un solo lugar, con el contexto justo para avanzar.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/design-official/otter-at-desk.png" alt="" width={520} height={260}/>
      </div>
      <Image alt="LAS" src="/las-logo-approved.png" width={96} height={30}/>
    </aside>
    <div className="official-auth-form">{children}</div>
  </main>;
}
