import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ---- Public action: auto-approve a freshly signed-up user if enabled ----
    if (action === "auto-approve-self") {
      const { email } = body;
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: setting } = await supabase
        .from("app_settings").select("value").eq("key", "auto_approve_signup").maybeSingle();
      const enabled = setting?.value === true || setting?.value === "true";
      if (enabled) {
        const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const target = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (target && !target.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(target.id, { email_confirm: true });
        }
      }
      return new Response(JSON.stringify({ approved: enabled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-settings") {
      const { data: setting } = await supabase
        .from("app_settings").select("value").eq("key", "auto_approve_signup").maybeSingle();
      return new Response(JSON.stringify({ autoApprove: setting?.value === true || setting?.value === "true" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-auto-approve") {
      const enabled = body.enabled === true;
      await supabase.from("app_settings").upsert(
        { key: "auto_approve_signup", value: enabled, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      return new Response(JSON.stringify({ success: true, autoApprove: enabled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // List pending (unconfirmed) users
    if (action === "list-pending") {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      
      const pending = users
        .filter(u => !u.email_confirmed_at && !u.banned_at)
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          username: u.user_metadata?.username || u.email?.split('@')[0],
          display_name: u.user_metadata?.display_name || u.email?.split('@')[0],
        }));
      
      return new Response(JSON.stringify({ users: pending }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const { userId } = body;
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { userId } = body;
      // Delete the user entirely so they disappear from the queue
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      // Also clean up profile and roles
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ban") {
      const { userId } = body;
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: "876600h",
      });
      if (error) throw error;
      await supabase.from("profiles").delete().eq("id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, username, displayName, role } = body;
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      });
      if (error) throw error;
      if (role === "admin" && newUser.user) {
        await supabase.from("user_roles").upsert({ user_id: newUser.user.id, role: "admin" }, { onConflict: "user_id" });
      }
      return new Response(JSON.stringify({ success: true, userId: newUser.user?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-role") {
      const { userId, role } = body;
      await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mass-update-to-user") {
      const { currentUserId } = body;
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "user" })
        .neq("user_id", currentUserId)
        .eq("role", "admin");
      
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
