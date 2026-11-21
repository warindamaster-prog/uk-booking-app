/** The shop's own front page (photos, about, opening times, map). Off until its migration is applied: while off, a shop's address goes straight to the service list. */
export const shopPageEnabled = () => process.env.SHOP_PAGE_ENABLED === "true";
