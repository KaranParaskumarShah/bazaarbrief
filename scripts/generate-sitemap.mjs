// Generates public/sitemap.xml + robots.txt from the data files.
// Runs automatically before `npm run build` (see package.json "prebuild").
import { writeFileSync } from "node:fs";
import { IPOS } from "../src/data/ipos.js";
import { CALCULATORS } from "../src/data/calculators.js";
import { MARKET_TOOLS } from "../src/data/marketTools.js";

const SITE = "https://bazaarbrief.in";
const today = new Date().toISOString().slice(0, 10);

const paths = [
  "/",
  "/ipo",
  "/ipo/upcoming-ipo",
  "/ipo/today-ipo",
  "/ipo/ipo-calendar",
  "/ipo/gmp",
  "/ipo/ipo-allotment-status",
  ...IPOS.map((i) => `/ipo/${i.slug}`),
  "/tools",
  ...CALCULATORS.map((c) => `/tools/${c.slug}`),
  ...MARKET_TOOLS.map((t) => `/tools/${t.slug}`),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync("public/sitemap.xml", xml);
writeFileSync("public/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap.xml: ${paths.length} URLs`);
