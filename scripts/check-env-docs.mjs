import { readFileSync, readdirSync } from "node:fs";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === "generated"
      ? []
      : e.isDirectory()
        ? files(`${dir}/${e.name}`)
        : [`${dir}/${e.name}`],
  );
}
const example = readFileSync(".env.example", "utf8");
const missing = [
  ...new Set(
    ["apps/api/src", "apps/gateway/src", "prisma"]
      .flatMap(files)
      .filter((p) => p.endsWith(".ts"))
      .flatMap((p) =>
        [...readFileSync(p, "utf8").matchAll(/process\.env\.([A-Z_]+)/g)].map(
          (m) => m[1],
        ),
      ),
  ),
].filter((key) => !example.includes(`${key}=`));
if (missing.length)
  throw new Error(`Undocumented environment: ${missing.join(", ")}`);
