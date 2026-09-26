export type ProjectVisibleTab = "overview" | "tasks" | "notes" | "resources" | "activity" | "team" | "chat";
const tabs: { id: ProjectVisibleTab; label: string }[] = [
  { id: "overview", label: "Resumen" }, { id: "tasks", label: "Tareas" }, { id: "notes", label: "Notas" }, { id: "resources", label: "Recursos" }, { id: "activity", label: "Actividad" }, { id: "team", label: "Equipo" }, { id: "chat", label: "Conversación" },
];
export function ProjectSectionNav({ activeTab, onNavigate }: { activeTab: ProjectVisibleTab; onNavigate: (tab: ProjectVisibleTab) => void }) {
  return <nav className="project-tabs" aria-label="Secciones del proyecto">{tabs.map(({id,label}) => <button className="project-button" key={id} aria-current={activeTab === id ? "page" : undefined} onClick={() => onNavigate(id)}>{label}</button>)}</nav>;
}
