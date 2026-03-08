import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [10, 35, 35];
  return segments.map(len => {
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join(":");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user: caller } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { bot_name, username, description, avatar_url } = body;
      if (!bot_name || !username) {
        return new Response(JSON.stringify({ error: "bot_name and username are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check username uniqueness
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a profile for the bot (using service role to bypass RLS)
      const profileId = crypto.randomUUID();
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: profileId,
        username,
        display_name: bot_name,
        avatar_url: avatar_url || null,
        bio: description || null,
        is_bot: true,
        online: true,
      });
      if (profileErr) throw profileErr;

      // Create bot record
      const botToken = generateToken();
      const { data: bot, error: botErr } = await supabase.from("bots").insert({
        profile_id: profileId,
        owner_id: caller.id,
        bot_token: botToken,
        description: description || null,
        webhook_url: null,
        status: "active",
      }).select().single();
      if (botErr) throw botErr;

      return new Response(JSON.stringify({ success: true, bot: { ...bot, bot_token: botToken } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { bot_id, bot_name, description, avatar_url, webhook_url, status } = body;

      // Verify ownership
      const { data: bot } = await supabase.from("bots").select("*, profiles:profile_id(*)").eq("id", bot_id).eq("owner_id", caller.id).single();
      if (!bot) {
        return new Response(JSON.stringify({ error: "Bot not found or not owned by you" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const profileUpdate: Record<string, unknown> = {};
      if (bot_name !== undefined) profileUpdate.display_name = bot_name;
      if (description !== undefined) profileUpdate.bio = description;
      if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url;
      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from("profiles").update(profileUpdate).eq("id", bot.profile_id);
      }

      // Update bot
      const botUpdate: Record<string, unknown> = {};
      if (description !== undefined) botUpdate.description = description;
      if (webhook_url !== undefined) botUpdate.webhook_url = webhook_url;
      if (status !== undefined) botUpdate.status = status;
      if (Object.keys(botUpdate).length > 0) {
        await supabase.from("bots").update(botUpdate).eq("id", bot_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset-token") {
      const { bot_id } = body;
      const newToken = generateToken();
      const { error } = await supabase.from("bots").update({ bot_token: newToken }).eq("id", bot_id).eq("owner_id", caller.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, bot_token: newToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { bot_id } = body;
      const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", bot_id).eq("owner_id", caller.id).single();
      if (!bot) {
        return new Response(JSON.stringify({ error: "Bot not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Delete bot (cascade), then profile
      await supabase.from("bots").delete().eq("id", bot_id);
      await supabase.from("profiles").delete().eq("id", bot.profile_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: bots } = await supabase
        .from("bots")
        .select("*, profiles:profile_id(username, display_name, avatar_url, bio)")
        .eq("owner_id", caller.id)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ bots: bots || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set commands
    if (action === "set-commands") {
      const { bot_id, commands } = body;
      // Verify ownership
      const { data: bot } = await supabase.from("bots").select("id").eq("id", bot_id).eq("owner_id", caller.id).single();
      if (!bot) {
        return new Response(JSON.stringify({ error: "Bot not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Replace all commands
      await supabase.from("bot_commands").delete().eq("bot_id", bot_id);
      if (commands && commands.length > 0) {
        const rows = commands.map((c: { command: string; description: string }) => ({
          bot_id,
          command: c.command.startsWith("/") ? c.command : `/${c.command}`,
          description: c.description || "",
        }));
        await supabase.from("bot_commands").insert(rows);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
