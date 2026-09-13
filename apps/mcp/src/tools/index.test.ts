import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools, TOOL_SCOPES, toolDescriptor } from "./index";

describe("MCP tool registry", () => {
  test("registers the supported safe surface", () => {
    const registrations = new Map<string, { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }>();
    const server = {
      registerTool(name: string, config: { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }) {
        registrations.set(name, config);
      },
    } as unknown as McpServer;

    const registeredTools = registerAllTools(server, "Bearer nisky_pat_test");

    expect([...registrations.keys()]).toEqual([
      "get-home-overview",
      "list-task-schedule",
      "list-events",
      "schedule-task",
      "list-projects",
      "create-project",
      "update-project",
      "list-quick-notes",
      "create-quick-note",
      "update-quick-note",
      "list-timeblocks",
      "get-timeblock-active",
      "get-timeblocks-today",
      "create-timeblock",
      "update-timeblock",
      "list-tasks",
      "get-task",
      "create-task",
      "update-task",
      "search-knowledge",
      "get-knowledge-note",
      "create-knowledge-note",
      "update-knowledge-note",
    ]);
    expect(registrations.size).toBe(23);
    expect([...registeredTools.keys()].sort()).toEqual(Object.keys(TOOL_SCOPES).sort());
    expect(registrations.get("schedule-task")?.inputSchema.safeParse({
      taskId: "00000000-0000-4000-8000-000000000001",
      date: "2026-09-15",
      timeBlockId: "00000000-0000-4000-8000-000000000002",
    }).success).toBe(true);
    expect(registrations.get("schedule-task")?.inputSchema.safeParse({
      taskId: "00000000-0000-4000-8000-000000000001",
      date: "2026-02-30",
      timeBlockId: "00000000-0000-4000-8000-000000000002",
    }).success).toBe(false);
    expect(registrations.get("list-events")?.inputSchema.safeParse({
      from: "2026-09-15",
      to: "2026-09-21",
    }).success).toBe(true);
    expect(registrations.get("list-events")?.inputSchema.safeParse({
      from: "2026-09-21",
      to: "2026-09-15",
    }).success).toBe(false);
  });

  test("advertises OAuth security schemes for ChatGPT", () => {
    const server = { toolInputSchemaJson: () => ({ type: "object", properties: {} }) } as unknown as McpServer;
    const descriptor = toolDescriptor(server, "create-task", {
      title: "Crear tarea",
      description: "Crea una tarea",
      enabled: true,
      handler: (() => ({})) as never,
      executor: (async () => ({})) as never,
    } as unknown as Parameters<typeof toolDescriptor>[2]);

    expect(descriptor.securitySchemes).toEqual([{ type: "oauth2", scopes: ["tasks:write"] }]);
    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: false });
    expect(descriptor._meta).toEqual({ securitySchemes: [{ type: "oauth2", scopes: ["tasks:write"] }] });
  });
});
