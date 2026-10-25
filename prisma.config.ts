import { defineConfig } from "prisma/config";
import { activeDatabaseURL } from "./scripts/active-database.mjs";

const defaultExport = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: activeDatabaseURL() },
});

export default defaultExport;
