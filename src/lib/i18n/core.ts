import { TH } from "./th";

/**
 * Translation by English text: the English sentence IS the key, so any string that has no entry in the Thai
 * dictionary simply stays English. Placeholders are written {like_this} and filled from `params`.
 * Dates and numbers are deliberately NOT translated: Thai date formats use Buddhist-era years (2569), which would
 * confuse a shop that also deals with UK customers and UK paperwork.
 */
export type Locale = "en" | "th";
export const LOCALES: Locale[] = ["en", "th"];
export const LOCALE_COOKIE = "locale";
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "th";

export type Params = Record<string, string | number>;
export type T = (key: string, params?: Params) => string;

export function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

type Template = { key: string; re: RegExp; names: string[] };
let templates: Template[] | null = null;

/**
 * Dictionary entries that contain {placeholders} can also translate a finished English sentence that comes back
 * from the server (for example "Your plan now covers 3 people."): the sentence is matched against the template and
 * the values are carried over. Only templates with enough fixed words are used, so short ones like "{name} off"
 * can't swallow unrelated text.
 */
function templateList(): Template[] {
  if (templates) return templates;
  templates = Object.keys(TH).filter((k) => k.includes("{") && k.replace(/\{\w+\}/g, "").trim().length >= 12).map((key) => {
    const names: string[] = [];
    const body = key.split(/(\{\w+\})/g).map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (m) { names.push(m[1]); return "(.+?)"; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return { key, re: new RegExp(`^${body}$`, "s"), names };
  });
  return templates;
}

export function translate(locale: Locale, key: string, params?: Params): string {
  if (locale !== "th") return fill(key, params);
  const exact = TH[key];
  if (exact !== undefined) return fill(exact, params);
  if (!params) {
    for (const tpl of templateList()) {
      const m = tpl.re.exec(key);
      if (m) {
        const found: Params = {};
        tpl.names.forEach((n, i) => { if (!(n in found)) found[n] = m[i + 1]; });
        return fill(TH[tpl.key], found);
      }
    }
  }
  return fill(key, params);
}

export const makeT = (locale: Locale): T => (key, params) => translate(locale, key, params);

/** The Intl locale for dates: Thai names with the Gregorian calendar (the default Thai calendar counts years from 543 BC, which would confuse a UK shop). */
export const intlLocale = (locale: Locale): string => (locale === "th" ? "th-TH-u-ca-gregory" : "en-GB");
