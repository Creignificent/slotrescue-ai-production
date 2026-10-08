import { serverClient } from "./supabase";

export async function requireMember(req: Request, businessId: string) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Missing bearer token.", status: 401 as const };
  const supabase = serverClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: "Invalid session.", status: 401 as const };
  const { data: member } = await supabase
    .from("memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!member) return { error: "Not a member of this business.", status: 403 as const };
  return { supabase, user: userData.user, role: member.role as "owner" | "staff" };
}
