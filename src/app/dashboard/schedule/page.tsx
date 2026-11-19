import { redirect } from "next/navigation";

/** The monthly schedule now lives on the Overview page. Old links and bookmarks land there. */
export default function SchedulePage() {
  redirect("/dashboard#month-schedule");
}
