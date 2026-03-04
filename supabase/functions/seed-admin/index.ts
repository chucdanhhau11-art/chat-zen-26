import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if admin already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", "admin")
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ message: "Admin account already exists", exists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin user via auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "admin@telechat.app",
      password: "admin123",
      email_confirm: true,
      user_metadata: { username: "admin", display_name: "Super Admin" },
    });

    if (authError) {
      throw authError;
    }

    // Add super_admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: authData.user.id, role: "super_admin" });

    if (roleError) {
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Admin account created successfully",
        email: "admin@telechat.app",
        password: "admin123",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
