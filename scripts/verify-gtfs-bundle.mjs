/** Fails the build only if committed timetable data is missing (no TypeScript imports). */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const subsetPath = join(process.cwd(), "data", "gtfs-subset.json");
const calendarPath = join(process.cwd(), "data", "calendar.json");

if (!existsSync(subsetPath) || !existsSync(calendarPath)) {
  console.error(
    "Missing data/gtfs-subset.json or data/calendar.json in the repo.\n" +
      "Run: npm run bundle-gtfs  (locally, with .env.local)"
  );
  process.exit(1);
}

try {
  const { edges } = JSON.parse(readFileSync(subsetPath, "utf-8"));
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error("empty edges");
  }
  console.log(`GTFS bundle OK (${edges.length} edges)`);
} catch {
  console.error("data/gtfs-subset.json is invalid. Run: npm run bundle-gtfs");
  process.exit(1);
}
