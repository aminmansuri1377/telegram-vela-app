import { PGlite } from '@electric-sql/pglite';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { EventEmitter } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
// Test-only real PostgreSQL WASM queries, no sockets or external credentials.
// PGlite serializes sessions; multi-connection race testing still requires PostgreSQL.
export async function databaseHarness() {
    const pg = await PGlite.create();
    for (const migration of (await readdir('prisma/migrations', { withFileTypes: true })).filter(x => x.isDirectory()).map(x => x.name).sort())
        await pg.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    const oids = (await pg.query<{
        oid: number;
    }>('SELECT oid FROM pg_type')).rows.map(x => x.oid);
    let tail = Promise.resolve();
    async function acquire() { let release!: () => void; const previous = tail; tail = new Promise<void>(r => release = r); await previous; return release; }
    const raw = async (config: any, values?: any[]) => { const text = typeof config === 'string' ? config : config.text; const parsers = config.types ? Object.fromEntries(oids.map(oid => [oid, config.types.getTypeParser(oid, 'text')])) : undefined; const r = await pg.query(text, values || config.values || [], { rowMode: config.rowMode || 'object', parsers }); return { ...r, rowCount: r.affectedRows ?? r.rows.length }; };
    const pool = new Pool();
    pool.query = (async (config: any, values?: any[]) => { const release = await acquire(); try {
        return await raw(config, values);
    }
    finally {
        release();
    } }) as any;
    pool.connect = (async () => { const release = await acquire(); const c = new EventEmitter() as any; c.query = raw; c.release = release; return c; }) as any;
    const client = new PrismaClient({ adapter: new PrismaPg(pool) });
    return { client, pg, close: async () => { await client.$disconnect(); await pool.end(); await pg.close(); } };
}
