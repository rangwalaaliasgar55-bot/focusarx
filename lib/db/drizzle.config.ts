import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL must be set");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionUrl,
  },
});
