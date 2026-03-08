import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { bot_token, action } = body;

    if (!bot_token) {
      return new Response(JSON.stringify({ error: "bot_token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate bot by token
    const { data: bot, error: botErr } = await supabase
      .from("bots")
      .select("*, profiles:profile_id(id, username, display_name)")
      .eq("bot_token", bot_token)
      .eq("status", "active")
      .single();

    if (botErr || !bot) {
      return new Response(JSON.stringify({ error: "Invalid or disabled bot token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botProfileId = bot.profile_id;

    if (action === "sendMessage") {
      const { chat_id, text, reply_to, reply_markup } = body;
      if (!chat_id || !text) {
        return new Response(JSON.stringify({ error: "chat_id and text are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check bot is member of conversation
      const { data: membership } = await supabase
        .from("conversation_members")
        .select("id")
        .eq("conversation_id", chat_id)
        .eq("user_id", botProfileId)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Bot is not a member of this conversation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build message content - embed reply_markup as JSON in content if present
      let content = text;
      let messageType = "text";

      // Store reply_markup in a special format if present
      const msgInsert: Record<string, unknown> = {
        conversation_id: chat_id,
        sender_id: botProfileId,
        content,
        message_type: messageType,
        reply_to: reply_to || null,
      };

      // If there's reply_markup, store it as JSON metadata in file_name field (reusing existing column)
      if (reply_markup) {
        msgInsert.file_name = JSON.stringify(reply_markup);
        msgInsert.message_type = "bot_message";
      }

      const { data: msg, error: msgErr } = await supabase.from("messages").insert(msgInsert).select().single();
      if (msgErr) throw msgErr;

      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", chat_id);

      return new Response(JSON.stringify({ success: true, message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sendFile") {
      const { chat_id, file_url, file_name, file_type, caption } = body;
      if (!chat_id || !file_url) {
        return new Response(JSON.stringify({ error: "chat_id and file_url are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await supabase
        .from("conversation_members")
        .select("id")
        .eq("conversation_id", chat_id)
        .eq("user_id", botProfileId)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Bot is not a member of this conversation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msgType = file_type || "file";
      const { data: msg, error: msgErr } = await supabase.from("messages").insert({
        conversation_id: chat_id,
        sender_id: botProfileId,
        content: caption || null,
        message_type: msgType,
        file_url,
        file_name: file_name || "file",
      }).select().single();
      if (msgErr) throw msgErr;

      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", chat_id);

      return new Response(JSON.stringify({ success: true, message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "editMessage") {
      const { message_id, text } = body;
      if (!message_id || !text) {
        return new Response(JSON.stringify({ error: "message_id and text required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("messages").update({ content: text, edited: true }).eq("id", message_id).eq("sender_id", botProfileId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deleteMessage") {
      const { message_id } = body;
      const { error } = await supabase.from("messages").update({ deleted: true, content: null }).eq("id", message_id).eq("sender_id", botProfileId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getUpdates") {
      // Long polling: get unprocessed events for this bot
      const { data: events } = await supabase
        .from("bot_events")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("processed", false)
        .order("created_at", { ascending: true })
        .limit(100);

      // Mark as processed
      if (events && events.length > 0) {
        await supabase.from("bot_events").update({ processed: true }).in("id", events.map(e => e.id));
      }

      return new Response(JSON.stringify({ updates: events || [] }), {
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
