import type { Metadata } from "next";
import { Shell } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage() {
  const t = await getT();
  return (
    <Shell title="Check your email">
      <p>{t("We've sent you a confirmation link. Open it to finish setting up your business.")}</p>
    </Shell>
  );
}
