// Postgres pool — единая точка коннекта приложения.
//
// Конфигурируется через env. Поддерживает либо одну переменную
// DATABASE_URL (если когда-то перейдём на managed), либо классические
// PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD.

import { Pool, type PoolConfig } from "pg";

export function createPool(): Pool {
  const config: PoolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host:     process.env.PGHOST     ?? "localhost",
        port:     Number(process.env.PGPORT ?? 5432),
        database: process.env.PGDATABASE ?? "umestno",
        user:     process.env.PGUSER     ?? "umestno_app",
        password: process.env.PGPASSWORD,
        max: 10,
        idleTimeoutMillis: 30_000,
      };
  return new Pool(config);
}
