import { api } from "@/lib/api";
import type { TimeBlock, TimeBlockSettings, TimeBlockWithProject, TimeBlockException } from "@/types/entities";

export async function getTimeBlocks() {
  const { data } = await api.get<{ data: TimeBlock[] }>("/timeblocks");
  return data.data;
}

export async function getActiveBlock() {
  const { data } = await api.get<{ data: TimeBlockWithProject | null }>("/timeblocks/active");
  return data.data;
}

export async function getTodayBlocks() {
  const { data } = await api.get<{ data: TimeBlockWithProject[] }>("/timeblocks/today");
  return data.data;
}

export async function getTimeBlockSettings() {
  const { data } = await api.get<{ data: TimeBlockSettings }>("/timeblocks/settings");
  return data.data;
}

export async function updateTimeBlockSettings(payload: { dayStartMin: number; dayEndMin: number }) {
  const { data } = await api.patch<{ data: TimeBlockSettings }>("/timeblocks/settings", payload);
  return data.data;
}

export type CreateTimeBlockPayload = {
  projectId?: string | null;
  date?: string | null;
  name?: string | null;
  daysOfWeek: number[];
  startMin: number;
  endMin: number;
  repeatEveryWeeks?: number;
  repeatEndsAt?: string | null;
  remindBeforeMin?: number;
};

export type UpdateTimeBlockPayload = Partial<CreateTimeBlockPayload> & { effectiveFrom?: string; isActive?: boolean };

export async function createTimeBlock(payload: CreateTimeBlockPayload) {
  const { data } = await api.post<{ data: TimeBlock }>("/timeblocks", payload);
  return data.data;
}

export async function createTimeBlockException(id: string, date: string, action: "skip" | "move", startMin?: number, endMin?: number, targetDate?: string) {
  const { data } = await api.post<{ data: unknown }>(`/timeblocks/${id}/exception`, { date, targetDate, action, startMin, endMin });
  return data.data;
}

export async function updateTimeBlock(id: string, payload: UpdateTimeBlockPayload) {
  const { data } = await api.patch<{ data: TimeBlock }>(`/timeblocks/${id}`, payload);
  return data.data;
}

export async function deleteTimeBlock(id: string) {
  const { data } = await api.delete<{ data: { success: boolean } }>(`/timeblocks/${id}`);
  return data.data;
}

export async function getTimeBlockExceptions(blockId: string) {
  const { data } = await api.get<{ data: TimeBlockException[] }>(`/timeblocks/${blockId}/exceptions`);
  return data.data;
}

export async function getAllTimeBlockExceptions(from: string, to: string) {
  const { data } = await api.get<{ data: TimeBlockException[] }>("/timeblocks/exceptions", { params: { from, to } });
  return data.data;
}

export async function deleteTimeBlockException(blockId: string, exceptionId: string) {
  const { data } = await api.delete<{ data: { success: boolean } }>(`/timeblocks/${blockId}/exceptions/${exceptionId}`);
  return data.data;
}
