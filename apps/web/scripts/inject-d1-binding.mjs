// Materialize a runtime wrangler config from a jsonc template by stripping
// comments and injecting the ephemeral D1 binding (name + id) resolved at
// deploy time. Prints the resulting JSON to stdout.
//
// Usage: node scripts/inject-d1-binding.mjs <config.jsonc> <db_name> <db_id>
import { readFileSync } from "node:fs";

const [configPath, dbName, dbId] = process.argv.slice(2);
if (!configPath || !dbName || !dbId) {
  console.error("usage: inject-d1-binding.mjs <config.jsonc> <db_name> <db_id>");
  process.exit(1);
}

// Strip // line comments and /* */ block comments, then trailing commas, so
// the jsonc template parses as JSON.
const raw = readFileSync(configPath, "utf8");
const withoutComments = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1")
  .replace(/,(\s*[}\]])/g, "$1");

const config = JSON.parse(withoutComments);
config.d1_databases = [
  {
    binding: "DB",
    database_name: dbName,
    database_id: dbId,
    migrations_dir: "drizzle",
  },
];

process.stdout.write(JSON.stringify(config, null, 2));
