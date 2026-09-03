import { redirect } from "next/navigation";

/** The back office has one home for every role: the /dashboard Overview.
 *  /admin/* are the super-admin sections reachable from its sidebar. */
export default function AdminIndex() {
  redirect("/dashboard");
}
