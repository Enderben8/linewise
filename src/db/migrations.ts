/**
 * Drizzle migrations for expo-sqlite, kept as TypeScript so they bundle without a SQL loader.
 * Rules: never edit an existing migration. Add a new one and append it to `journal` and `migrations`.
 * `when` must increase with each entry.
 */

const m0000 = `CREATE TABLE \`settings\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`value\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`memorizations\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`title\` text NOT NULL,
	\`author\` text DEFAULT '' NOT NULL,
	\`language\` text DEFAULT 'en' NOT NULL,
	\`type\` text DEFAULT 'text' NOT NULL,
	\`body\` text NOT NULL,
	\`body_hash\` text NOT NULL,
	\`chunks\` text NOT NULL,
	\`tags\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`progress\` (
	\`memorization_id\` text PRIMARY KEY NOT NULL,
	\`target_due_date\` integer,
	\`interval_index\` integer DEFAULT 0 NOT NULL,
	\`next_review_at\` integer,
	\`headline_score\` real DEFAULT 0 NOT NULL,
	\`solidify_scores\` text NOT NULL,
	\`hidden_words\` text NOT NULL,
	\`voice_overrides\` text NOT NULL,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`memorization_id\`) REFERENCES \`memorizations\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`sessions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`memorization_id\` text NOT NULL,
	\`game\` text NOT NULL,
	\`chunk_start\` integer NOT NULL,
	\`chunk_end\` integer NOT NULL,
	\`accuracy\` real NOT NULL,
	\`coverage\` real NOT NULL,
	\`weighted_score\` real NOT NULL,
	\`counted_for_review\` integer DEFAULT false NOT NULL,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`memorization_id\`) REFERENCES \`memorizations\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`sessions_memorization_idx\` ON \`sessions\` (\`memorization_id\`, \`created_at\`);
--> statement-breakpoint
CREATE TABLE \`recordings\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`memorization_id\` text NOT NULL,
	\`name\` text NOT NULL,
	\`file_uri\` text NOT NULL,
	\`duration_sec\` real NOT NULL,
	\`body_hash\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`memorization_id\`) REFERENCES \`memorizations\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`recordings_memorization_idx\` ON \`recordings\` (\`memorization_id\`);`;

const m0001 = `CREATE TABLE \`folders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE \`memorizations\` ADD \`folder_id\` text REFERENCES folders(id) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX \`memorizations_folder_idx\` ON \`memorizations\` (\`folder_id\`);`;

export const migrations = {
  journal: {
    entries: [
      { idx: 0, when: 1790000000000, tag: '0000_init', breakpoints: true },
      { idx: 1, when: 1790100000000, tag: '0001_folders', breakpoints: true },
    ],
  },
  migrations: {
    m0000,
    m0001,
  },
};
