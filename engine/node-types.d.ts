// Minimal Node.js type stubs — used when @types/node is unavailable offline.
declare module "node:child_process" {
  export function execSync(
    command: string,
    options?: { cwd?: string; encoding?: string }
  ): Buffer;
}
declare module "node:fs" {
  export function writeFileSync(path: string, data: string, encoding?: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function existsSync(path: string): boolean;
}
declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
}
declare var process: {
  exit(code?: number): never;
  argv: string[];
  env: Record<string, string | undefined>;
};
