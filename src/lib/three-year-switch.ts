/**
 * The 3-year prepaid plan can be chosen and paid for only while THREE_YEAR_ENABLED is "true". Keep it off until the
 * database migration (0019) has been applied and the brand and domain are final: with it off, nothing in the app reads or
 * writes the new columns and the plan does not appear anywhere.
 */
export const threeYearEnabled = () => process.env.THREE_YEAR_ENABLED === "true";
