import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOTFATHER_USERNAME = "botfather";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [10, 35, 35];
  return segments.map(len => {
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join(":");
}

const HELP_TEXT = `🤖 **BotFather** - Hệ thống quản lý Bot

Tôi có thể giúp bạn tạo và quản lý bot. Dưới đây là các lệnh có sẵn:

**Tạo & Quản lý Bot**
/newbot - Tạo bot mới
/mybots - Danh sách bot của bạn
/deletebot - Xoá bot

**Cài đặt Bot**
/setname - Đổi tên hiển thị bot
/setdescription - Đổi mô tả bot
/setabouttext - Đặt giới thiệu bot
/setcommands - Đặt danh sách lệnh bot
/setwebhook - Cấu hình webhook URL
/setprivacy - Cài đặt chế độ riêng tư

**Quản lý Token**
/revoke - Đặt lại token API của bot

/help - Hiện trợ giúp này
/start - Bắt đầu tương tác với BotFather`;

const WELCOME_TEXT = `🤖 Chào mừng bạn đến với **BotFather**!

Tôi có thể giúp bạn tạo và quản lý bot trên nền tảng này.

Dùng /newbot để tạo bot mới.
Dùng /help để xem tất cả lệnh có sẵn.`;

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

    // Action: ensure BotFather exists (creates auth user + profile if not)
    if (action === "ensure-botfather") {
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", BOTFATHER_USERNAME).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ botfather_id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create BotFather auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: "botfather@system.internal",
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { username: BOTFATHER_USERNAME, display_name: "BotFather" },
      });
      if (authError) throw authError;

      // Update profile to be a bot
      await supabase.from("profiles").update({
        is_bot: true,
        online: true,
        bio: "Tôi là BotFather. Tôi có thể giúp bạn tạo và quản lý bot.",
        display_name: "BotFather",
      }).eq("id", authData.user.id);

      return new Response(JSON.stringify({ botfather_id: authData.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: process a message from user to BotFather
    if (action === "process-message") {
      const { message, conversation_id } = body;
      if (!message || !conversation_id) {
        return new Response(JSON.stringify({ error: "message and conversation_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get BotFather profile
      const { data: botfatherProfile } = await supabase.from("profiles").select("id").eq("username", BOTFATHER_USERNAME).maybeSingle();
      if (!botfatherProfile) {
        return new Response(JSON.stringify({ error: "BotFather not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const botfatherId = botfatherProfile.id;

      // Get or create session state
      const { data: session } = await supabase.from("botfather_sessions")
        .select("*").eq("user_id", caller.id).maybeSingle();

      let state = session?.state || "idle";
      let stateData = (session?.data as Record<string, any>) || {};
      const text = message.trim();

      let responseText = "";
      let replyMarkup: any = null;
      let newState = "idle";
      let newStateData: Record<string, any> = {};

      // Check if it's a command (reset state on new command)
      const isCommand = text.startsWith("/");

      if (isCommand) {
        const cmd = text.split(" ")[0].toLowerCase();

        switch (cmd) {
          case "/start":
            responseText = WELCOME_TEXT;
            break;

          case "/help":
            responseText = HELP_TEXT;
            break;

          case "/newbot":
            responseText = "Được rồi, tạo bot mới. Bạn muốn đặt tên gì cho bot? Hãy gửi tên cho bot của bạn.";
            newState = "creating_bot_name";
            break;

          case "/mybots": {
            const { data: bots } = await supabase.from("bots")
              .select("*, profiles:profile_id(username, display_name)")
              .eq("owner_id", caller.id)
              .order("created_at", { ascending: false });

            if (!bots || bots.length === 0) {
              responseText = "Bạn chưa có bot nào. Dùng /newbot để tạo bot mới.";
            } else {
              const botList = bots.map((b: any, i: number) =>
                `${i + 1}. **${b.profiles?.display_name}** (@${b.profiles?.username}) - ${b.status === 'active' ? '🟢 Hoạt động' : '🔴 Đã tắt'}`
              ).join("\n");
              responseText = `📋 **Bot của bạn:**\n\n${botList}\n\nChọn bot bằng cách gửi số thứ tự, hoặc dùng lệnh khác.`;
              newState = "selecting_bot";
              newStateData = { bots: bots.map((b: any) => ({ id: b.id, name: b.profiles?.display_name, username: b.profiles?.username })) };
              
              // Build inline keyboard with bot names
              replyMarkup = {
                inline_keyboard: bots.map((b: any) => [{
                  text: `🤖 ${b.profiles?.display_name} (@${b.profiles?.username})`,
                  callback_data: `select_bot:${b.id}`
                }])
              };
            }
            break;
          }

          case "/setname":
            responseText = "Chọn bot để đổi tên. Gửi username của bot (ví dụ: @mybot)";
            newState = "setname_choose_bot";
            break;

          case "/setdescription":
            responseText = "Chọn bot để đổi mô tả. Gửi username của bot (ví dụ: @mybot)";
            newState = "setdescription_choose_bot";
            break;

          case "/setabouttext":
            responseText = "Chọn bot để đặt giới thiệu. Gửi username của bot (ví dụ: @mybot)";
            newState = "setabouttext_choose_bot";
            break;

          case "/setcommands":
            responseText = "Chọn bot để đặt lệnh. Gửi username của bot (ví dụ: @mybot)";
            newState = "setcommands_choose_bot";
            break;

          case "/setwebhook":
            responseText = "Chọn bot để cấu hình webhook. Gửi username của bot (ví dụ: @mybot)";
            newState = "setwebhook_choose_bot";
            break;

          case "/setprivacy":
            responseText = "Chọn bot để cài đặt chế độ riêng tư. Gửi username của bot (ví dụ: @mybot)";
            newState = "setprivacy_choose_bot";
            break;

          case "/revoke":
            responseText = "Chọn bot để đặt lại token. Gửi username của bot (ví dụ: @mybot)";
            newState = "revoke_choose_bot";
            break;

          case "/deletebot":
            responseText = "Chọn bot để xoá. Gửi username của bot (ví dụ: @mybot)\n\n⚠️ Hành động này không thể hoàn tác!";
            newState = "deletebot_choose_bot";
            break;

          case "/cancel":
            responseText = "Đã huỷ lệnh. Dùng /help để xem các lệnh có sẵn.";
            newState = "idle";
            break;

          default:
            responseText = `Lệnh không xác định: ${cmd}\n\nDùng /help để xem các lệnh có sẵn.`;
        }
      } else {
        // Process based on current state
        switch (state) {
          case "creating_bot_name":
            newState = "creating_bot_username";
            newStateData = { bot_name: text };
            responseText = `Tốt lắm. Bây giờ hãy chọn username cho bot. Username phải kết thúc bằng "bot" (ví dụ: weatherbot, shop_bot).\n\nTên bot: **${text}**`;
            break;

          case "creating_bot_username": {
            const username = text.replace("@", "").toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (!username.endsWith("bot")) {
              responseText = "Username phải kết thúc bằng \"bot\". Vui lòng thử lại.";
              newState = "creating_bot_username";
              newStateData = stateData;
              break;
            }

            // Check username uniqueness
            const { data: existingUser } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
            if (existingUser) {
              responseText = `Username @${username} đã được sử dụng. Vui lòng thử username khác.`;
              newState = "creating_bot_username";
              newStateData = stateData;
              break;
            }

            // Create the bot using bot-manage logic
            const botName = stateData.bot_name || username;
            const profileId = crypto.randomUUID();
            const { error: profileErr } = await supabase.from("profiles").insert({
              id: profileId,
              username,
              display_name: botName,
              is_bot: true,
              online: true,
            });

            if (profileErr) {
              // If FK constraint (no auth user), create auth user first
              const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                email: `${username}@bot.internal`,
                password: crypto.randomUUID() + crypto.randomUUID(),
                email_confirm: true,
                user_metadata: { username, display_name: botName },
              });

              if (authErr) {
                responseText = `Error creating bot: ${authErr.message}. Please try again.`;
                newState = "idle";
                break;
              }

              // Update the auto-created profile
              await supabase.from("profiles").update({
                is_bot: true,
                online: true,
                display_name: botName,
              }).eq("id", authData.user.id);

              const botToken = generateToken();
              const { data: bot, error: botErr } = await supabase.from("bots").insert({
                profile_id: authData.user.id,
                owner_id: caller.id,
                bot_token: botToken,
                status: "active",
              }).select().single();

              if (botErr) {
                responseText = `Error creating bot record: ${botErr.message}. Please try again.`;
                newState = "idle";
                break;
              }

              responseText = `✅ Done! Congratulations on your new bot.\n\n🤖 **Name:** ${botName}\n👤 **Username:** @${username}\n\n🔑 **Your API Token:**\n\`${botToken}\`\n\nUse this token to access the Bot API.\nKeep your token secure and don't share it!\n\nFor a description of the Bot API, see /help.`;
              newState = "idle";
              break;
            }

            // Profile created without auth user (shouldn't happen with FK, but handle anyway)
            const botToken = generateToken();
            const { error: botErr } = await supabase.from("bots").insert({
              profile_id: profileId,
              owner_id: caller.id,
              bot_token: botToken,
              status: "active",
            });

            if (botErr) {
              responseText = `Error: ${botErr.message}`;
              newState = "idle";
              break;
            }

            responseText = `✅ Done! Congratulations on your new bot.\n\n🤖 **Name:** ${botName}\n👤 **Username:** @${username}\n\n🔑 **Your API Token:**\n\`${botToken}\`\n\nKeep your token secure!`;
            newState = "idle";
            break;
          }

          // Select bot from /mybots list via callback or number
          case "selecting_bot": {
            let selectedBotId: string | null = null;
            
            if (text.startsWith("select_bot:")) {
              selectedBotId = text.replace("select_bot:", "");
            } else {
              const num = parseInt(text);
              if (!isNaN(num) && stateData.bots && num >= 1 && num <= stateData.bots.length) {
                selectedBotId = stateData.bots[num - 1].id;
              }
            }

            if (!selectedBotId) {
              responseText = "Please send a valid bot number from the list, or use /cancel.";
              newState = "selecting_bot";
              newStateData = stateData;
              break;
            }

            const { data: botDetail } = await supabase.from("bots")
              .select("*, profiles:profile_id(username, display_name, bio)")
              .eq("id", selectedBotId).eq("owner_id", caller.id).single();

            if (!botDetail) {
              responseText = "Bot not found or you don't own it.";
              break;
            }

            const statusEmoji = botDetail.status === 'active' ? '🟢' : '🔴';
            responseText = `🤖 **${botDetail.profiles?.display_name}** (@${botDetail.profiles?.username})\n\n${statusEmoji} Status: ${botDetail.status}\n📝 Description: ${botDetail.description || 'Not set'}\n🌐 Webhook: ${botDetail.webhook_url || 'Not set'}\n\nWhat would you like to do?`;
            
            replyMarkup = {
              inline_keyboard: [
                [{ text: "✏️ Edit Name", callback_data: `action:setname:${selectedBotId}` }, { text: "📝 Edit Description", callback_data: `action:setdesc:${selectedBotId}` }],
                [{ text: "🌐 Set Webhook", callback_data: `action:setwebhook:${selectedBotId}` }, { text: "⌨️ Set Commands", callback_data: `action:setcmds:${selectedBotId}` }],
                [{ text: "🔑 Revoke Token", callback_data: `action:revoke:${selectedBotId}` }, { text: botDetail.status === 'active' ? "🔴 Disable" : "🟢 Enable", callback_data: `action:toggle:${selectedBotId}` }],
                [{ text: "🗑️ Delete Bot", callback_data: `action:delete:${selectedBotId}` }],
              ]
            };
            newState = "bot_actions";
            newStateData = { bot_id: selectedBotId };
            break;
          }

          // Handle inline button actions from bot detail
          case "bot_actions": {
            if (text.startsWith("action:")) {
              const parts = text.split(":");
              const actionType = parts[1];
              const botId = parts[2];

              switch (actionType) {
                case "setname":
                  responseText = "Send me the new name for your bot.";
                  newState = "setname_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setdesc":
                  responseText = "Send me the new description for your bot (or 'none' to remove).";
                  newState = "setdescription_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setwebhook":
                  responseText = "Send me the webhook URL (or 'none' to remove).";
                  newState = "setwebhook_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setcmds":
                  responseText = "Send me the commands list. Each line should have:\ncommand - description\n\nExample:\nstart - Start the bot\nhelp - Show help\nnews - Get latest news\n\nSend 'none' to clear all commands.";
                  newState = "setcommands_input";
                  newStateData = { bot_id: botId };
                  break;
                case "revoke": {
                  const newToken = generateToken();
                  await supabase.from("bots").update({ bot_token: newToken }).eq("id", botId).eq("owner_id", caller.id);
                  responseText = `🔑 Token revoked! Your new token:\n\n\`${newToken}\`\n\nThe old token is no longer valid.`;
                  break;
                }
                case "toggle": {
                  const { data: b } = await supabase.from("bots").select("status").eq("id", botId).single();
                  const ns = b?.status === 'active' ? 'disabled' : 'active';
                  await supabase.from("bots").update({ status: ns }).eq("id", botId).eq("owner_id", caller.id);
                  responseText = ns === 'active' ? "🟢 Bot has been enabled." : "🔴 Bot has been disabled.";
                  break;
                }
                case "delete":
                  responseText = "⚠️ Are you sure you want to delete this bot? This action cannot be undone.\n\nSend 'yes' to confirm or /cancel to abort.";
                  newState = "deletebot_confirm";
                  newStateData = { bot_id: botId };
                  break;
                default:
                  responseText = "Unknown action. Use /help for available commands.";
              }
            } else {
              responseText = "Please select an action from the buttons above, or use /cancel.";
              newState = "bot_actions";
              newStateData = stateData;
            }
            break;
          }

          // Resolve bot by username for set* commands
          case "setname_choose_bot":
          case "setdescription_choose_bot":
          case "setabouttext_choose_bot":
          case "setcommands_choose_bot":
          case "setwebhook_choose_bot":
          case "setprivacy_choose_bot":
          case "revoke_choose_bot":
          case "deletebot_choose_bot": {
            const uname = text.replace("@", "").toLowerCase();
            const { data: bp } = await supabase.from("profiles").select("id").eq("username", uname).maybeSingle();
            if (!bp) {
              responseText = `Bot @${uname} not found. Please check the username and try again, or use /cancel.`;
              newState = state;
              break;
            }
            const { data: foundBot } = await supabase.from("bots").select("id").eq("profile_id", bp.id).eq("owner_id", caller.id).maybeSingle();
            if (!foundBot) {
              responseText = `You don't own a bot with username @${uname}. Use /mybots to see your bots.`;
              newState = state;
              break;
            }

            const baseState = state.replace("_choose_bot", "");
            switch (baseState) {
              case "setname":
                responseText = `Bot @${uname} selected. Send me the new name.`;
                newState = "setname_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setdescription":
              case "setabouttext":
                responseText = `Bot @${uname} selected. Send me the new description (or 'none' to remove).`;
                newState = "setdescription_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setcommands":
                responseText = `Bot @${uname} selected. Send me the commands list:\ncommand - description\n\nExample:\nstart - Start the bot\nhelp - Show help\n\nSend 'none' to clear all commands.`;
                newState = "setcommands_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setwebhook":
                responseText = `Bot @${uname} selected. Send me the webhook URL (or 'none' to remove).`;
                newState = "setwebhook_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setprivacy":
                responseText = `Bot @${uname} selected. Privacy mode:\n- **enabled**: bot only receives commands\n- **disabled**: bot receives all messages\n\nSend 'enabled' or 'disabled'.`;
                newState = "setprivacy_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "revoke": {
                const newToken = generateToken();
                await supabase.from("bots").update({ bot_token: newToken }).eq("id", foundBot.id);
                responseText = `🔑 Token for @${uname} has been revoked.\n\nNew token:\n\`${newToken}\``;
                break;
              }
              case "deletebot":
                responseText = `⚠️ Are you sure you want to delete @${uname}? This cannot be undone.\n\nSend 'yes' to confirm or /cancel to abort.`;
                newState = "deletebot_confirm";
                newStateData = { bot_id: foundBot.id, username: uname };
                break;
            }
            break;
          }

          // Input handlers
          case "setname_input": {
            const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", stateData.bot_id).eq("owner_id", caller.id).single();
            if (bot) {
              await supabase.from("profiles").update({ display_name: text }).eq("id", bot.profile_id);
              responseText = `✅ Bot name updated to: **${text}**`;
            } else {
              responseText = "Bot not found.";
            }
            break;
          }

          case "setdescription_input": {
            const desc = text.toLowerCase() === 'none' ? null : text;
            const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", stateData.bot_id).eq("owner_id", caller.id).single();
            if (bot) {
              await supabase.from("profiles").update({ bio: desc }).eq("id", bot.profile_id);
              await supabase.from("bots").update({ description: desc }).eq("id", stateData.bot_id);
              responseText = desc ? `✅ Description updated: ${desc}` : "✅ Description removed.";
            } else {
              responseText = "Bot not found.";
            }
            break;
          }

          case "setwebhook_input": {
            const url = text.toLowerCase() === 'none' ? null : text;
            if (url && !url.startsWith('http')) {
              responseText = "Please send a valid URL starting with http:// or https://, or 'none' to remove.";
              newState = "setwebhook_input";
              newStateData = stateData;
              break;
            }
            await supabase.from("bots").update({ webhook_url: url }).eq("id", stateData.bot_id).eq("owner_id", caller.id);
            responseText = url ? `✅ Webhook set to: ${url}` : "✅ Webhook removed.";
            break;
          }

          case "setcommands_input": {
            if (text.toLowerCase() === 'none') {
              await supabase.from("bot_commands").delete().eq("bot_id", stateData.bot_id);
              responseText = "✅ All commands have been cleared.";
              break;
            }
            const lines = text.split("\n").filter(l => l.trim());
            const cmds = lines.map(l => {
              const [cmd, ...descParts] = l.split(" - ");
              const command = cmd.trim().startsWith("/") ? cmd.trim() : `/${cmd.trim()}`;
              return { bot_id: stateData.bot_id, command, description: descParts.join(" - ").trim() || "" };
            });

            await supabase.from("bot_commands").delete().eq("bot_id", stateData.bot_id);
            if (cmds.length > 0) {
              await supabase.from("bot_commands").insert(cmds);
            }
            responseText = `✅ Commands updated:\n\n${cmds.map(c => `${c.command} - ${c.description}`).join("\n")}`;
            break;
          }

          case "setprivacy_input": {
            const mode = text.toLowerCase();
            if (mode !== 'enabled' && mode !== 'disabled') {
              responseText = "Please send 'enabled' or 'disabled'.";
              newState = "setprivacy_input";
              newStateData = stateData;
              break;
            }
            const perms = mode === 'disabled' 
              ? { read_messages: true, send_messages: true, delete_messages: false, manage_users: false }
              : { read_messages: false, send_messages: true, delete_messages: false, manage_users: false };
            await supabase.from("bots").update({ permissions: perms }).eq("id", stateData.bot_id).eq("owner_id", caller.id);
            responseText = `✅ Privacy mode ${mode}. ${mode === 'enabled' ? 'Bot will only receive commands.' : 'Bot will receive all messages.'}`;
            break;
          }

          case "deletebot_confirm": {
            if (text.toLowerCase() !== 'yes') {
              responseText = "Deletion cancelled. Use /help for available commands.";
              break;
            }
            const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", stateData.bot_id).eq("owner_id", caller.id).single();
            if (bot) {
              await supabase.from("bot_commands").delete().eq("bot_id", stateData.bot_id);
              await supabase.from("bot_events").delete().eq("bot_id", stateData.bot_id);
              await supabase.from("bots").delete().eq("id", stateData.bot_id);
              // Don't delete the profile/auth user as it may have messages
              responseText = `✅ Bot has been deleted.`;
            } else {
              responseText = "Bot not found.";
            }
            break;
          }

          default:
            responseText = "I don't understand. Use /help to see available commands.";
        }
      }

      // Save state
      await supabase.from("botfather_sessions").upsert({
        user_id: caller.id,
        state: newState,
        data: newStateData,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Send response as BotFather message
      const msgInsert: Record<string, any> = {
        conversation_id,
        sender_id: botfatherId,
        content: responseText,
        message_type: replyMarkup ? "bot_message" : "text",
      };
      if (replyMarkup) {
        msgInsert.file_name = JSON.stringify(replyMarkup);
      }

      await supabase.from("messages").insert(msgInsert);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation_id);

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
