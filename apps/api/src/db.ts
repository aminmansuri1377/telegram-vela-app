import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
export let db = new PrismaClient();
export function useTestDatabase(client: PrismaClient) { if (process.env.NODE_ENV !== 'test')
    throw new Error('Test database injection is test-only'); db = client; }
export type Tx = Prisma.TransactionClient;
export async function lockUsers(tx: Tx, ids: string[]) { for (const id of [...new Set(ids)].sort())
    await tx.$queryRaw `SELECT id FROM "User" WHERE id=${id}::uuid FOR UPDATE`; }
