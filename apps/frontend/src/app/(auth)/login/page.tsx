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
import { useLogin } from "@/features/auth/hooks/useLogin";
import { usePublicConfigQuery } from "@/features/auth/hooks/useAuthConfig";
import { loginSchema, type LoginFormData } from "@/features/auth/schemas/auth.schema";
import type { ApiError } from "@/types/api.types";

export default function LoginPage() {
  const { setAuth } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const config = usePublicConfigQuery();
  const { mutate, isPending, error } = useLogin((result) => {
    setAuth(result);
    toast.success("¡Qué bueno verte de nuevo!");
    const requestedRedirect = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("redirect");
    const redirect = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//") && !requestedRedirect.includes("\\") ? requestedRedirect : "/";
    // A full navigation makes the browser send the new refresh cookie and
    // forces the protected tree to restore the session on its first render.
    window.location.replace(redirect);
  });
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    // Do not allow the browser's native submit to run before React owns the form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
  }, []);

  return (
    <section className="w-full">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary font-headline-md text-headline-md font-bold text-on-primary">N</span>
        <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-primary">Nisky</span>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface p-6 shadow-cadence-2 sm:p-8">
        <div className="mb-8">
          <p className="font-label-caps text-label-caps text-secondary">NISKY / ACCESO</p>
          <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Iniciar sesión</h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Retoma tus tareas, tus notas y el plan del día.</p>
        </div>

        <form className="space-y-5" method="post" onSubmit={handleSubmit((values) => mutate(values))}>
          <Field label="Correo o nombre de usuario" error={errors.identifier?.message}>
            <input autoComplete="username" className="field" placeholder="correo@ejemplo.com o @usuario" type="text" {...register("identifier")} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...register("password")} />
          </Field>
           <Button className="w-full font-body-md text-body-md !text-white" disabled={!isHydrated || isPending} type="submit">
            {isPending ? "Entrando..." : "Ingresar"}
            {!isPending && <ArrowRight aria-hidden="true" size={16} />}
          </Button>
          {error && <MutationError error={error as ApiError} />}
        </form>

        {config.data?.publicSignup && (
          <div className="mt-7 border-t border-outline-variant pt-5">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              ¿Primera vez en Nisky?{" "}
              <Link className="font-medium text-secondary underline underline-offset-4 hover:text-primary" href="/register">Crear cuenta</Link>
            </p>
          </div>
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

function MutationError({ error }: { error?: ApiError }) {
  return error ? <p className="rounded-md border border-error/30 bg-error-container px-3 py-2.5 font-body-sm text-body-sm text-on-error-container" role="alert">{error.message}</p> : null;
}
