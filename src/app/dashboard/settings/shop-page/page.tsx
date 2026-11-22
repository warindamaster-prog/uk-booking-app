import { redirect } from "next/navigation";

export default function ShopPageSettings() {
  redirect("/dashboard/settings?tab=booking");
}
