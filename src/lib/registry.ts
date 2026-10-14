import type { AppMode } from "../types";

export type RegistryEntry = {
  publicId: string;
  manageToken: string;
  mode: AppMode;
  createdAt: string;
};

const KEY = "admittwo.registry.v1";

export function readRegistry(): RegistryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RegistryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry.publicId && entry.manageToken && entry.mode);
  } catch {
    return [];
  }
}

export function rememberInvitation(entry: RegistryEntry): void {
  const next = readRegistry().filter((item) => item.publicId !== entry.publicId);
  next.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(next.slice(0, 50)));
}

export function findRegistryEntry(publicId: string): RegistryEntry | null {
  return readRegistry().find((entry) => entry.publicId === publicId) ?? null;
}
