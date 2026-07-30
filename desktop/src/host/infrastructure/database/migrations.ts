import type Database from "better-sqlite3";

interface Migration {
  version: number;
  up: (database: Database.Database) => void;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    up(database) {
      database.exec(`
        CREATE TABLE secret_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL COLLATE NOCASE UNIQUE,
          builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1))
        );

        CREATE TABLE secret_entities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          label TEXT NOT NULL,
          content TEXT NOT NULL,
          builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1)),
          FOREIGN KEY (category_id)
            REFERENCES secret_categories(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
        );

        CREATE INDEX idx_secret_entities_category_id
          ON secret_entities(category_id);
      `);
    },
  },
  {
    version: 2,
    up(database) {
      database.exec(`
        INSERT INTO secret_categories (label, builtin) VALUES
          ('Ключи API', 1),
          ('Личные данные', 1);
      `);
    },
  },
  {
    version: 3,
    up(database) {
      database.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE secret_entities_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        content TEXT NOT NULL,
        builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1)),
        FOREIGN KEY (category_id)
          REFERENCES secret_categories(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );

      INSERT INTO secret_entities_new (
        id,
        category_id,
        label,
        content,
        builtin
      )
      SELECT
        id,
        category_id,
        label,
        content,
        builtin
      FROM secret_entities;

      DROP TABLE secret_entities;
      ALTER TABLE secret_entities_new RENAME TO secret_entities;

      CREATE INDEX idx_secret_entities_category_id
        ON secret_entities(category_id);

      PRAGMA foreign_keys = ON;
    `);
    },
  },
];

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedVersions = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const applyMigration = database.transaction((migration: Migration) => {
    migration.up(database);
    database
      .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
      .run(migration.version);
  });

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) applyMigration(migration);
  }
}
