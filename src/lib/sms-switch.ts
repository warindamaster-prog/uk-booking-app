/**
 * SMS confirmations can be bought but no text is sent yet. While SMS_PACKS_ENABLED is not "true" the option is
 * hidden and cannot be bought, so nobody pays for texts that cannot be sent. Shops that already have packs keep
 * them (and what they paid); they just can't change them until it is switched on.
 */
export const smsPacksEnabled = () => process.env.SMS_PACKS_ENABLED === "true";
