import type { McpServer, RegisteredTool } from "@modelcontextprotocol/server";
import { registerAgendaTools } from "./agenda";
import { registerKnowledgeTools } from "./knowledge";
import { registerProjectTools } from "./projects";
import { registerQuickNoteTools } from "./quicknotes";
import { registerTaskTools } from "./tasks";
import { registerTimeBlockTools } from "./timeblocks";

export const TOOL_SCOPES = {
  "get-home-overview": "tasks:read",
  "list-task-schedule": "tasks:read",
  "list-events": "events:read",
  "schedule-task": "tasks:write",
  "list-projects": "projects:read",
  "create-project": "projects:write",
  "update-project": "projects:write",
  "list-quick-notes": "notes:read",
  "create-quick-note": "notes:write",
  "update-quick-note": "notes:write",
  "list-timeblocks": "timeblocks:read",
  "get-timeblock-active": "timeblocks:read",
  "get-timeblocks-today": "timeblocks:read",
  "create-timeblock": "timeblocks:write",
  "update-timeblock": "timeblocks:write",
  "list-tasks": "tasks:read",
  "get-task": "tasks:read",
  "create-task": "tasks:write",
  "update-task": "tasks:write",
  "search-knowledge": "notes:read",
  "get-knowledge-note": "notes:read",
  "create-knowledge-note": "notes:write",
  "update-knowledge-note": "notes:write",
} as const;

export function registerAllTools(server: McpServer, auth: string) {
  const registeredTools = new Map<string, RegisteredTool>();
  // The v2 registerTool API omits Apps SDK securitySchemes, so retain the
  // registered descriptors for the custom tools/list response.
  const originalRegisterTool = server.registerTool;
  server.registerTool = ((name: string, config: unknown, callback: unknown) => {
    const registered = originalRegisterTool.call(server, name, config as never, callback as never);
    registeredTools.set(name, registered);
    return registered;
  }) as typeof server.registerTool;

  try {
    registerAgendaTools(server, auth);
    registerProjectTools(server, auth);
    registerQuickNoteTools(server, auth);
    registerTimeBlockTools(server, auth);
    registerTaskTools(server, auth);
    registerKnowledgeTools(server, auth);
  } finally {
    server.registerTool = originalRegisterTool;
  }

  return registeredTools;
}

export function toolDescriptor(server: McpServer, name: string, tool: RegisteredTool) {
  const scope = TOOL_SCOPES[name as keyof typeof TOOL_SCOPES];
  if (!scope) throw new Error(`No OAuth scope configured for MCP tool ${name}`);

  const securitySchemes = [{ type: "oauth2", scopes: [scope] }];
  const inputSchema = (server.toolInputSchemaJson(name) ?? { type: "object", properties: {} }) as {
    type: "object";
    [key: string]: unknown;
  };
  const annotations = {
    ...tool.annotations,
    readOnlyHint: scope.endsWith(":read"),
    destructiveHint: false,
    openWorldHint: false,
  };
  return {
    name,
    ...(tool.title === undefined ? {} : { title: tool.title }),
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema,
    ...(tool.outputSchemaJson === undefined ? {} : { outputSchema: tool.outputSchemaJson }),
    annotations,
    ...(tool.icons === undefined ? {} : { icons: tool.icons }),
    ...(tool.execution === undefined ? {} : { execution: tool.execution }),
    securitySchemes,
    _meta: { ...(tool._meta ?? {}), securitySchemes },
  };
}
