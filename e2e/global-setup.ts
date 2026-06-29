import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Antes da suite: garante schema + seed determinístico no banco e2e LOCAL.
 * O seed-e2e.ts aborta sozinho se DATABASE_URL não for localhost.
 */
export default function globalSetup() {
  const backDir = path.resolve(__dirname, "../../lore-back");
  // Prisma 7 CLI exige Node 20+. Garante que os filhos usem o MESMO node
  // que está rodando o Playwright (e não um node antigo do PATH do sistema).
  const env = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  };
  execSync("npm run db:e2e", { cwd: backDir, stdio: "inherit", env });
  execSync("npm run seed:e2e", { cwd: backDir, stdio: "inherit", env });
}
