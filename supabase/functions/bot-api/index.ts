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

    // ==================== clientInlineQuery (no auth required) ====================
    if (action === "clientInlineQuery") {
      const { bot_profile_id, query, user_id, chat_id } = body;
      if (!bot_profile_id) {
        return new Response(JSON.stringify({ error: "bot_profile_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: clientBot } = await supabase
        .from("bots")
        .select("id, webhook_url")
        .eq("profile_id", bot_profile_id)
        .eq("status", "active")
        .maybeSingle();

      if (!clientBot) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id) {
        await supabase.from("inline_queries").insert({
          bot_id: clientBot.id,
          user_id,
          query_text: query || "",
          chat_id: chat_id || null,
        });
      }

      if (clientBot.webhook_url) {
        try {
          const webhookResp = await fetch(clientBot.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "inline_query",
              bot_id: clientBot.id,
              query, user_id, chat_id,
            }),
          });
          if (webhookResp.ok) {
            const webhookData = await webhookResp.json();
            if (webhookData.results && Array.isArray(webhookData.results)) {
              await supabase.from("inline_results").delete().eq("bot_id", clientBot.id);
              const rows = webhookData.results.map((r: any) => ({
                bot_id: clientBot.id,
                result_id: r.id || crypto.randomUUID(),
                result_type: r.type || "article",
                title: r.title || "",
                description: r.description || null,
                content: r.message_text || r.content || null,
                thumbnail_url: r.thumbnail_url || r.thumb_url || null,
                reply_markup: r.reply_markup || null,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              }));
              await supabase.from("inline_results").insert(rows);
            }
          }
        } catch (e) {}
      }

      await supabase.from("bot_events").insert({
        bot_id: clientBot.id,
        event_type: "inline_query",
        payload: { query, user_id, chat_id },
      });

      const { data: results } = await supabase
        .from("inline_results").select("*")
        .eq("bot_id", clientBot.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ results: results || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // ==================== sendMessage ====================
    if (action === "sendMessage") {
      const { chat_id, text, reply_to, reply_markup } = body;
      if (!chat_id || !text) {
        return new Response(JSON.stringify({ error: "chat_id and text are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await supabase
        .from("conversation_members").select("id")
        .eq("conversation_id", chat_id).eq("user_id", botProfileId).maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "Bot is not a member of this conversation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msgInsert: Record<string, unknown> = {
        conversation_id: chat_id,
        sender_id: botProfileId,
        content: text,
        message_type: "text",
        reply_to: reply_to || null,
      };

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

    // ==================== sendFile ====================
    if (action === "sendFile") {
      const { chat_id, file_url, file_name, file_type, caption } = body;
      if (!chat_id || !file_url) {
        return new Response(JSON.stringify({ error: "chat_id and file_url are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await supabase
        .from("conversation_members").select("id")
        .eq("conversation_id", chat_id).eq("user_id", botProfileId).maybeSingle();

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

    // ==================== editMessage ====================
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

    // ==================== deleteMessage ====================
    if (action === "deleteMessage") {
      const { message_id } = body;
      const { error } = await supabase.from("messages").update({ deleted: true, content: null }).eq("id", message_id).eq("sender_id", botProfileId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== getUpdates ====================
    if (action === "getUpdates") {
      const { data: events } = await supabase
        .from("bot_events").select("*")
        .eq("bot_id", bot.id).eq("processed", false)
        .order("created_at", { ascending: true }).limit(100);

      if (events && events.length > 0) {
        await supabase.from("bot_events").update({ processed: true }).in("id", events.map(e => e.id));
      }

      return new Response(JSON.stringify({ updates: events || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== answerInlineQuery ====================
    if (action === "answerInlineQuery") {
      const { query_id, results, cache_time } = body;
      if (!results || !Array.isArray(results)) {
        return new Response(JSON.stringify({ error: "results array is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete old results for this bot (cleanup)
      await supabase.from("inline_results").delete()
        .eq("bot_id", bot.id)
        .lt("expires_at", new Date().toISOString());

      // Store results
      const ttl = cache_time || 3600; // default 1 hour
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      
      const rows = results.map((r: any) => ({
        bot_id: bot.id,
        result_id: r.id || crypto.randomUUID(),
        result_type: r.type || "article",
        title: r.title || "",
        description: r.description || null,
        content: r.message_text || r.content || null,
        thumbnail_url: r.thumbnail_url || r.thumb_url || null,
        reply_markup: r.reply_markup || null,
        expires_at: expiresAt,
      }));

      const { error: insertErr } = await supabase.from("inline_results").insert(rows);
      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true, results_count: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== processInlineQuery ====================
    // Called by the client when user types @botname query
    // Can be called with bot_token OR bot_profile_id (for client-side calls)
    if (action === "processInlineQuery") {
      const { query, user_id, chat_id } = body;

      // Log the inline query (only if valid user_id provided)
      if (user_id) {
        await supabase.from("inline_queries").insert({
          bot_id: bot.id,
          user_id,
          query_text: query || "",
          chat_id: chat_id || null,
        });
      }

      // If bot has a webhook, forward the inline query
      if (bot.webhook_url) {
        try {
          const webhookResp = await fetch(bot.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "inline_query",
              bot_id: bot.id,
              query,
              user_id,
              chat_id,
            }),
          });
          if (webhookResp.ok) {
            const webhookData = await webhookResp.json();
            // If webhook returned results directly, store them
            if (webhookData.results && Array.isArray(webhookData.results)) {
              await supabase.from("inline_results").delete().eq("bot_id", bot.id);
              const rows = webhookData.results.map((r: any) => ({
                bot_id: bot.id,
                result_id: r.id || crypto.randomUUID(),
                result_type: r.type || "article",
                title: r.title || "",
                description: r.description || null,
                content: r.message_text || r.content || null,
                thumbnail_url: r.thumbnail_url || r.thumb_url || null,
                reply_markup: r.reply_markup || null,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              }));
              await supabase.from("inline_results").insert(rows);
            }
          }
        } catch (e) {
          // Webhook call failed, continue with cached results
        }
      }

      // Also create a bot_event for polling-based bots
      await supabase.from("bot_events").insert({
        bot_id: bot.id,
        event_type: "inline_query",
        payload: { query, user_id, chat_id },
      });

      // Return cached results for this bot
      const { data: results } = await supabase
        .from("inline_results").select("*")
        .eq("bot_id", bot.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ results: results || [] }), {
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
