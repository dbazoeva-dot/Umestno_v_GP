// Server-only: never import this in Client Components
import { runUmestnoEngine } from "@engine/index.js";
import type { UserInput } from "@engine/types.js";

export type { UserInput };
export { runUmestnoEngine };
