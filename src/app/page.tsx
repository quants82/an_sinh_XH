import { redirect } from "next/navigation";
import { db, ensureDbReady } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDbReady();
  const owners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);

  if (owners.length === 0) {
    redirect("/onboarding");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
