"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/button";
import { useRegister } from "@/features/auth/hooks/useRegister";
import { usePublicConfigQuery } from "@/features/auth/hooks/useAuthConfig";
import { authSwitchHref, safeInternalRedirect } from "@/features/auth/lib/redirect";
import { registerSchema, type RegisterFormData } from "@/features/auth/schemas/auth.schema";

export default function RegisterPage() {
  const { setAuth } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const [authRedirect, setAuthRedirect] = useState<string | null>(null);
  const config = usePublicConfigQuery();
  const { mutate, isPending, error } = useRegister((result) => {
    setAuth(result);
    toast.success("¡Tu cuenta está lista! Empecemos.");
    const requestedRedirect = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("redirect");
    const redirect = safeInternalRedirect(requestedRedirect) ?? "/";
    window.location.replace(redirect);
  });
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });
  useEffect(() => {
    const requestedRedirect = new URLSearchParams(window.location.search).get("redirect");
    // Keep the original destination when switching between login and register.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthRedirect(safeInternalRedirect(requestedRedirect));
    // Do not allow the browser's native submit to run before React owns the form.
    setIsHydrated(true);
  }, []);
  return (
    <section className="w-full">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary font-headline-md text-headline-md font-bold text-on-primary">N</span>
        <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-primary">Nisky</span>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface p-6 shadow-cadence-2 sm:p-8">
        {config.isLoading ? (
          <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">Cargando...</p>
        ) : config.data?.publicSignup === false ? (
          <>
            <p className="font-label-caps text-label-caps text-secondary">NISKY / REGISTRO</p>
            <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Cuentas nuevas pausadas</h1>
            <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Por ahora no aceptamos cuentas nuevas.</p>
            <Link className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-outline-variant px-4 font-body-md text-body-md font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface" href={authSwitchHref("/login", authRedirect)}>
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <div className="mb-8">
              <p className="font-label-caps text-label-caps text-secondary">NISKY / NUEVA CUENTA</p>
              <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Crea tu espacio</h1>
              <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Empieza con una vista más clara de tu día.</p>
            </div>

            <form className="space-y-5" method="post" onSubmit={handleSubmit((values) => mutate(values))}>
              <Field label="Nombre" error={errors.name?.message}>
                <input autoComplete="name" className="field" type="text" {...register("name")} />
              </Field>
              <Field label="Nombre de usuario (opcional)" error={errors.username?.message}>
                <span className="relative block">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-data-mono text-data-mono text-on-surface-variant">@</span>
                  <input autoComplete="username" className="field pl-8" placeholder="tu_usuario" type="text" {...register("username")} />
                </span>
              </Field>
              <Field label="Correo electrónico" error={errors.email?.message}>
                <input autoComplete="email" className="field" type="email" {...register("email")} />
              </Field>
              <Field label="Contraseña" error={errors.password?.message}>
                <PasswordInput autoComplete="new-password" {...register("password")} />
              </Field>
              <Field label="Confirmar contraseña" error={errors.confirmPassword?.message}>
                <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
              </Field>
               <Button className="w-full font-body-md text-body-md !text-white" disabled={!isHydrated || isPending} type="submit">
                {isPending ? "Creando..." : "Crear cuenta"}
                {!isPending && <ArrowRight aria-hidden="true" size={16} />}
              </Button>
              {error && <p className="rounded-md border border-error/30 bg-error-container px-3 py-2.5 font-body-sm text-body-sm text-on-error-container" role="alert">{error.message}</p>}
            </form>

            <div className="mt-7 border-t border-outline-variant pt-5">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                ¿Ya tienes cuenta?{" "}
                <Link className="font-medium text-secondary underline underline-offset-4 hover:text-primary" href={authSwitchHref("/login", authRedirect)}>Iniciar sesión</Link>
              </p>
            </div>
          </>
        )}
      </div>

      <p className="mt-5 text-center font-label-md text-label-md text-on-surface-variant">Un lugar tranquilo para organizar lo importante.</p>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-label-md text-label-md font-medium text-on-surface">{label}</span>
      {children}
      {error && <span className="mt-1.5 block font-body-sm text-body-sm text-error">{error}</span>}
    </label>
  );
}
