// Seed the ISO-3166 Country reference table. Idempotent.
import { db } from "../src/lib/db";

const COUNTRIES: [string, string, string, string][] = [
  ["FI", "FIN", "Suomi", "Europe"],
  ["SE", "SWE", "Ruotsi", "Europe"],
  ["NO", "NOR", "Norja", "Europe"],
  ["DK", "DNK", "Tanska", "Europe"],
  ["EE", "EST", "Viro", "Europe"],
  ["DE", "DEU", "Saksa", "Europe"],
  ["FR", "FRA", "Ranska", "Europe"],
  ["GB", "GBR", "Yhdistynyt kuningaskunta", "Europe"],
  ["NL", "NLD", "Alankomaat", "Europe"],
  ["BE", "BEL", "Belgia", "Europe"],
  ["LU", "LUX", "Luxemburg", "Europe"],
  ["IE", "IRL", "Irlanti", "Europe"],
  ["ES", "ESP", "Espanja", "Europe"],
  ["IT", "ITA", "Italia", "Europe"],
  ["PL", "POL", "Puola", "Europe"],
  ["CH", "CHE", "Sveitsi", "Europe"],
  ["AT", "AUT", "Itävalta", "Europe"],
  ["RU", "RUS", "Venäjä", "Europe"],
  ["UA", "UKR", "Ukraina", "Europe"],
  ["US", "USA", "Yhdysvallat", "Americas"],
  ["CA", "CAN", "Kanada", "Americas"],
  ["BR", "BRA", "Brasilia", "Americas"],
  ["CN", "CHN", "Kiina", "Asia"],
  ["JP", "JPN", "Japani", "Asia"],
  ["IN", "IND", "Intia", "Asia"],
  ["KR", "KOR", "Etelä-Korea", "Asia"],
  ["SG", "SGP", "Singapore", "Asia"],
  ["AE", "ARE", "Arabiemiraatit", "Middle East"],
  ["QA", "QAT", "Qatar", "Middle East"],
  ["SA", "SAU", "Saudi-Arabia", "Middle East"],
  ["IL", "ISR", "Israel", "Middle East"],
  ["TR", "TUR", "Turkki", "Middle East"],
  ["ZA", "ZAF", "Etelä-Afrikka", "Africa"],
  ["EG", "EGY", "Egypti", "Africa"],
  ["AU", "AUS", "Australia", "Oceania"],
  ["EU", "EUU", "Euroopan unioni", "Europe"],
];

async function main() {
  for (const [iso2, iso3, name, region] of COUNTRIES) {
    await db.country.upsert({ where: { iso2 }, update: { iso3, name, region }, create: { iso2, iso3, name, region } });
  }
  const n = await db.country.count();
  console.log(`Country table seeded — ${n} rows.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
