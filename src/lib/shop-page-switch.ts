/** The shop's own front page (photos, about, opening times, map). Off until its migration is applied: while off, a shop's address goes straight to the service list. */
export const shopPageEnabled = () => process.env.SHOP_PAGE_ENABLED === "true";

/** Opening times typed in by the shop (migration 0022). Off until the migration is applied. */
export const shopHoursEnabled = () => process.env.SHOP_HOURS_ENABLED === "true";
