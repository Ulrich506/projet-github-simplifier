export interface ProgressionAffichee {
  label: string;
  complete: boolean;
}

let snapshot: ProgressionAffichee | null = null;
const listeners = new Set<() => void>();

export function setProgression(next: ProgressionAffichee | null): void {
  if (snapshot?.label === next?.label && snapshot?.complete === next?.complete) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeProgression(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProgression(): ProgressionAffichee | null {
  return snapshot;
}
