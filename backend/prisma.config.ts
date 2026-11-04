import * as dotenv from 'dotenv';
import { defineConfig } from "prisma/config";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl || "", 
  },
});