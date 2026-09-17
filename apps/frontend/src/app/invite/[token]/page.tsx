"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Link2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { acceptProjectInviteLink, getProjectInvitePreview } from "@/features/projects/api/projects";

export default function ProjectInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const previewQuery = useQuery({
    queryKey: ["project-invite", token],
    queryFn: () => getProjectInvitePreview(token),
    enabled: Boolean(token),
  });
  const acceptMutation = useMutation({
    mutationFn: () => acceptProjectInviteLink(token),
    onSuccess: (result) => {
      toast.success(result.alreadyMember ? "Ya tienes acceso a este proyecto" : "Te uniste al proyecto");
      router.replace(`/projects/${result.projectId}`);
    },
    onError: (error: { message?: string }) => toast.error(error.message ?? "No pudimos aceptar la invitación."),
  });

  if (authLoading || previewQuery.isLoading) {
    return <InviteShell><p className="text-center font-body-sm text-body-sm text-on-surface-variant">Cargando invitación...</p></InviteShell>;
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <InviteShell>
        <div className="text-center">
          <p className="font-label-caps text-label-caps text-error">ENLACE NO DISPONIBLE</p>
          <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Esta invitación ya no está disponible</h1>
          <p className="mt-3 font-body-md text-body-md text-on-surface-variant">Pide al dueño del proyecto que genere un nuevo enlace.</p>
          <Link className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-outline-variant px-4 font-body-sm text-body-sm font-semibold text-on-surface-variant hover:bg-surface-container-low" href="/">
            Ir a Nisky
          </Link>
        </div>
      </InviteShell>
    );
  }

  const { project } = previewQuery.data;
  return (
    <InviteShell>
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl text-on-primary" style={{ backgroundColor: project.color }}>
          <Users size={22} />
        </span>
        <p className="mt-6 font-label-caps text-label-caps text-secondary">INVITACIÓN A PROYECTO</p>
        <h1 className="mt-2 font-headline-lg text-headline-lg text-on-surface">Únete a {project.name}</h1>
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant">
          {project.description ?? "Colabora con el equipo, comparte tareas y mantén el trabajo en contexto."}
        </p>

        {isAuthenticated ? (
          <button
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-body-md text-body-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-60"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            type="button"
          >
            <Link2 size={17} /> {acceptMutation.isPending ? "Uniéndote..." : "Unirme al proyecto"}
          </button>
        ) : (
          <div className="mt-8 grid gap-2">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-body-md text-body-md font-semibold text-on-primary hover:bg-primary-container hover:text-on-primary-container" href={`/login?redirect=${encodeURIComponent(invitePath)}`}>
              Iniciar sesión <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-outline-variant px-4 font-body-md text-body-md font-semibold text-on-surface-variant hover:bg-surface-container-low" href={`/register?redirect=${encodeURIComponent(invitePath)}`}>
              Crear una cuenta
            </Link>
          </div>
        )}
      </div>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-8">
      <section className="w-full max-w-md rounded-lg border border-outline-variant bg-surface p-6 shadow-cadence-2 sm:p-8">
        <Link className="mb-8 flex items-center justify-center gap-2 font-headline-md text-headline-md font-bold tracking-tight text-primary" href="/" prefetch={false}>
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm text-on-primary">N</span>
          Nisky
        </Link>
        {children}
      </section>
    </main>
  );
}
