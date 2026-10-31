import { defaults, migrate, LEGACY_KEY, STORAGE_KEY } from "./reading";
import type { State } from "./types";

export type StoragePort = Pick<Storage, "getItem" | "setItem">;

/** Keep corrupt bytes recoverable before allowing any new state to overwrite them. */
export function restore(storage: StoragePort): {
  state: State;
  canWrite: boolean;
  warning: boolean;
} {
  let warning = false;
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return { state: defaults(), canWrite: false, warning: true };
    }
    if (!raw) continue;
    try {
      return { state: migrate(JSON.parse(raw)), canWrite: true, warning };
    } catch {
      warning = true;
      try {
        storage.setItem(`${key}.recovery.${Date.now()}`, raw);
      } catch {
        return { state: defaults(), canWrite: false, warning: true };
      }
    }
  }
  return { state: defaults(), canWrite: true, warning };
}

export function persist(storage: StoragePort, state: State): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
