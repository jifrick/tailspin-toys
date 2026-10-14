import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabaseConnection, executeMigrationQueries, type Database } from '../src/lib/db';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Creates a fresh in-memory SQLite database with the schema migrated.
 *
 * @returns A migrated database client suitable for isolated unit tests.
 */
export async function createTestDatabase(): Promise<Database> {
    const { db, sqlite } = createDatabaseConnection(':memory:');
    await migrate(
        db,
        async (queries: string[]): Promise<void> => executeMigrationQueries(sqlite, queries),
        { migrationsFolder: join(here, 'migrations') },
    );
    return db;
}
