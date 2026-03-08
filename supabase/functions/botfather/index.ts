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

const HELP_TEXT = `🤖 **BotFather** - Hệ thống quản lý Bot / Bot Management System

Tôi có thể giúp bạn tạo và quản lý bot.
I can help you create and manage bots.

**Tạo & Quản lý Bot / Create & Manage Bots**
/newbot - Tạo bot mới / Create a new bot
/mybots - Danh sách bot của bạn / List your bots
/deletebot - Xoá bot / Delete a bot

**Cài đặt Bot / Bot Settings**
/setname - Đổi tên hiển thị bot / Change bot display name
/setdescription - Đổi mô tả bot / Change bot description
/setabouttext - Đặt giới thiệu bot / Set bot about text
/setcommands - Đặt danh sách lệnh bot / Set bot command list
/setwebhook - Cấu hình webhook URL / Configure webhook URL
/setprivacy - Cài đặt chế độ riêng tư / Set privacy mode

**Quản lý Token / Token Management**
/revoke - Đặt lại token API / Reset API token

/help - Hiện trợ giúp này / Show this help
/start - Bắt đầu / Start`;

const WELCOME_TEXT = `🤖 Chào mừng bạn đến với **BotFather**!
Welcome to **BotFather**!

Tôi có thể giúp bạn tạo và quản lý bot trên nền tảng này.
I can help you create and manage bots on this platform.

Dùng /newbot để tạo bot mới.
Use /newbot to create a new bot.

Dùng /help để xem tất cả lệnh có sẵn.
Use /help to see all available commands.`;

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

    // Action: ensure BotFather exists
    if (action === "ensure-botfather") {
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", BOTFATHER_USERNAME).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ botfather_id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: "botfather@system.internal",
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { username: BOTFATHER_USERNAME, display_name: "BotFather" },
      });
      if (authError) throw authError;

      await supabase.from("profiles").update({
        is_bot: true,
        online: true,
        bio: "Tôi là BotFather. Tôi có thể giúp bạn tạo và quản lý bot.\nI am BotFather. I can help you create and manage bots.",
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

      const { data: botfatherProfile } = await supabase.from("profiles").select("id").eq("username", BOTFATHER_USERNAME).maybeSingle();
      if (!botfatherProfile) {
        return new Response(JSON.stringify({ error: "BotFather not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const botfatherId = botfatherProfile.id;

      const { data: session } = await supabase.from("botfather_sessions")
        .select("*").eq("user_id", caller.id).maybeSingle();

      let state = session?.state || "idle";
      let stateData = (session?.data as Record<string, any>) || {};
      const text = message.trim();

      let responseText = "";
      let replyMarkup: any = null;
      let newState = "idle";
      let newStateData: Record<string, any> = {};

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
            responseText = "Được rồi, tạo bot mới. Bạn muốn đặt tên gì cho bot? Hãy gửi tên cho bot của bạn.\nAlright, let's create a new bot. What name would you like? Please send the name for your bot.";
            newState = "creating_bot_name";
            break;

          case "/mybots": {
            const { data: bots } = await supabase.from("bots")
              .select("*, profiles:profile_id(username, display_name)")
              .eq("owner_id", caller.id)
              .order("created_at", { ascending: false });

            if (!bots || bots.length === 0) {
              responseText = "Bạn chưa có bot nào. Dùng /newbot để tạo bot mới.\nYou don't have any bots yet. Use /newbot to create one.";
            } else {
              const botList = bots.map((b: any, i: number) =>
                `${i + 1}. **${b.profiles?.display_name}** (@${b.profiles?.username}) - ${b.status === 'active' ? '🟢 Hoạt động / Active' : '🔴 Đã tắt / Disabled'}`
              ).join("\n");
              responseText = `📋 **Bot của bạn / Your bots:**\n\n${botList}\n\nChọn bot bằng cách gửi số thứ tự, hoặc dùng lệnh khác.\nSelect a bot by sending its number, or use another command.`;
              newState = "selecting_bot";
              newStateData = { bots: bots.map((b: any) => ({ id: b.id, name: b.profiles?.display_name, username: b.profiles?.username })) };
              
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
            responseText = "Chọn bot để đổi tên. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to rename. Send the bot's username (e.g. @mybot)";
            newState = "setname_choose_bot";
            break;

          case "/setdescription":
            responseText = "Chọn bot để đổi mô tả. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to change description. Send the bot's username (e.g. @mybot)";
            newState = "setdescription_choose_bot";
            break;

          case "/setabouttext":
            responseText = "Chọn bot để đặt giới thiệu. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to set about text. Send the bot's username (e.g. @mybot)";
            newState = "setabouttext_choose_bot";
            break;

          case "/setcommands":
            responseText = "Chọn bot để đặt lệnh. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to set commands. Send the bot's username (e.g. @mybot)";
            newState = "setcommands_choose_bot";
            break;

          case "/setwebhook":
            responseText = "Chọn bot để cấu hình webhook. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to configure webhook. Send the bot's username (e.g. @mybot)";
            newState = "setwebhook_choose_bot";
            break;

          case "/setprivacy":
            responseText = "Chọn bot để cài đặt chế độ riêng tư. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to set privacy mode. Send the bot's username (e.g. @mybot)";
            newState = "setprivacy_choose_bot";
            break;

          case "/revoke":
            responseText = "Chọn bot để đặt lại token. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to reset token. Send the bot's username (e.g. @mybot)";
            newState = "revoke_choose_bot";
            break;

          case "/deletebot":
            responseText = "Chọn bot để xoá. Gửi username của bot (ví dụ: @mybot)\nChoose a bot to delete. Send the bot's username (e.g. @mybot)\n\n⚠️ Hành động này không thể hoàn tác! / This action cannot be undone!";
            newState = "deletebot_choose_bot";
            break;

          case "/cancel":
            responseText = "Đã huỷ lệnh. Dùng /help để xem các lệnh có sẵn.\nCommand cancelled. Use /help to see available commands.";
            newState = "idle";
            break;

          default:
            responseText = `Lệnh không xác định: ${cmd}\nUnknown command: ${cmd}\n\nDùng /help để xem các lệnh có sẵn.\nUse /help to see available commands.`;
        }
      } else {
        // Process based on current state
        switch (state) {
          case "creating_bot_name":
            newState = "creating_bot_username";
            newStateData = { bot_name: text };
            responseText = `Tốt lắm. Bây giờ hãy chọn username cho bot. Username phải kết thúc bằng "bot" (ví dụ: weatherbot, shop_bot).\nGreat. Now choose a username for your bot. The username must end with "bot" (e.g. weatherbot, shop_bot).\n\nTên bot / Bot name: **${text}**`;
            break;

          case "creating_bot_username": {
            const username = text.replace("@", "").toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (!username.endsWith("bot")) {
              responseText = "Username phải kết thúc bằng \"bot\". Vui lòng thử lại.\nUsername must end with \"bot\". Please try again.";
              newState = "creating_bot_username";
              newStateData = stateData;
              break;
            }

            const { data: existingUser } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
            if (existingUser) {
              responseText = `Username @${username} đã được sử dụng. Vui lòng thử username khác.\nUsername @${username} is already taken. Please try another one.`;
              newState = "creating_bot_username";
              newStateData = stateData;
              break;
            }

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
              const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                email: `${username}@bot.internal`,
                password: crypto.randomUUID() + crypto.randomUUID(),
                email_confirm: true,
                user_metadata: { username, display_name: botName },
              });

              if (authErr) {
                responseText = `Lỗi tạo bot / Error creating bot: ${authErr.message}`;
                newState = "idle";
                break;
              }

              await supabase.from("profiles").update({
                is_bot: true,
                online: true,
                display_name: botName,
              }).eq("id", authData.user.id);

              const botToken = generateToken();
              const { error: botErr } = await supabase.from("bots").insert({
                profile_id: authData.user.id,
                owner_id: caller.id,
                bot_token: botToken,
                status: "active",
              }).select().single();

              if (botErr) {
                responseText = `Lỗi tạo bản ghi bot / Error creating bot record: ${botErr.message}`;
                newState = "idle";
                break;
              }

              responseText = `✅ Xong! Chúc mừng bạn đã tạo bot mới.\n✅ Done! Congratulations on creating your new bot.\n\n🤖 **Tên / Name:** ${botName}\n👤 **Username:** @${username}\n\n🔑 **Token API của bạn / Your API Token:**\n\`${botToken}\`\n\nDùng token này để truy cập Bot API. Hãy giữ bí mật!\nUse this token to access the Bot API. Keep it secret!`;
              newState = "idle";
              break;
            }

            const botToken = generateToken();
            const { error: botErr } = await supabase.from("bots").insert({
              profile_id: profileId,
              owner_id: caller.id,
              bot_token: botToken,
              status: "active",
            });

            if (botErr) {
              responseText = `Lỗi / Error: ${botErr.message}`;
              newState = "idle";
              break;
            }

            responseText = `✅ Xong! Chúc mừng bạn đã tạo bot mới.\n✅ Done! Congratulations on creating your new bot.\n\n🤖 **Tên / Name:** ${botName}\n👤 **Username:** @${username}\n\n🔑 **Token API:**\n\`${botToken}\`\n\nHãy giữ bí mật token! / Keep the token secret!`;
            newState = "idle";
            break;
          }

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
              responseText = "Vui lòng gửi số thứ tự hợp lệ từ danh sách, hoặc dùng /cancel.\nPlease send a valid number from the list, or use /cancel.";
              newState = "selecting_bot";
              newStateData = stateData;
              break;
            }

            const { data: botDetail } = await supabase.from("bots")
              .select("*, profiles:profile_id(username, display_name, bio)")
              .eq("id", selectedBotId).eq("owner_id", caller.id).single();

            if (!botDetail) {
              responseText = "Không tìm thấy bot hoặc bạn không sở hữu bot này.\nBot not found or you don't own this bot.";
              break;
            }

            const statusEmoji = botDetail.status === 'active' ? '🟢' : '🔴';
            const statusText = botDetail.status === 'active' ? 'Hoạt động / Active' : 'Đã tắt / Disabled';
            responseText = `🤖 **${botDetail.profiles?.display_name}** (@${botDetail.profiles?.username})\n\n${statusEmoji} Trạng thái / Status: ${statusText}\n📝 Mô tả / Description: ${botDetail.description || 'Chưa đặt / Not set'}\n🌐 Webhook: ${botDetail.webhook_url || 'Chưa đặt / Not set'}\n\nBạn muốn làm gì? / What would you like to do?`;
            
            replyMarkup = {
              inline_keyboard: [
                [{ text: "✏️ Đổi tên / Rename", callback_data: `action:setname:${selectedBotId}` }, { text: "📝 Mô tả / Description", callback_data: `action:setdesc:${selectedBotId}` }],
                [{ text: "🌐 Webhook", callback_data: `action:setwebhook:${selectedBotId}` }, { text: "⌨️ Lệnh / Commands", callback_data: `action:setcmds:${selectedBotId}` }],
                [{ text: "🔑 Đặt lại Token / Reset Token", callback_data: `action:revoke:${selectedBotId}` }, { text: botDetail.status === 'active' ? "🔴 Tắt / Disable" : "🟢 Bật / Enable", callback_data: `action:toggle:${selectedBotId}` }],
                [{ text: "🗑️ Xoá Bot / Delete Bot", callback_data: `action:delete:${selectedBotId}` }],
              ]
            };
            newState = "bot_actions";
            newStateData = { bot_id: selectedBotId };
            break;
          }

          case "bot_actions": {
            if (text.startsWith("action:")) {
              const parts = text.split(":");
              const actionType = parts[1];
              const botId = parts[2];

              switch (actionType) {
                case "setname":
                  responseText = "Gửi cho tôi tên mới cho bot của bạn.\nSend me the new name for your bot.";
                  newState = "setname_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setdesc":
                  responseText = "Gửi cho tôi mô tả mới cho bot (hoặc 'none' để xoá).\nSend me the new description (or 'none' to remove).";
                  newState = "setdescription_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setwebhook":
                  responseText = "Gửi cho tôi webhook URL (hoặc 'none' để xoá).\nSend me the webhook URL (or 'none' to remove).";
                  newState = "setwebhook_input";
                  newStateData = { bot_id: botId };
                  break;
                case "setcmds":
                  responseText = "Gửi cho tôi danh sách lệnh. Mỗi dòng có dạng:\nSend me the command list. Each line should be:\n\nlệnh - mô tả / command - description\n\nVí dụ / Example:\nstart - Khởi động bot / Start the bot\nhelp - Hiện trợ giúp / Show help\n\nGửi 'none' để xoá tất cả lệnh.\nSend 'none' to clear all commands.";
                  newState = "setcommands_input";
                  newStateData = { bot_id: botId };
                  break;
                case "revoke": {
                  const newToken = generateToken();
                  await supabase.from("bots").update({ bot_token: newToken }).eq("id", botId).eq("owner_id", caller.id);
                  responseText = `🔑 Token đã được đặt lại! Token mới:\n🔑 Token has been reset! New token:\n\n\`${newToken}\`\n\nToken cũ không còn hiệu lực.\nThe old token is no longer valid.`;
                  break;
                }
                case "toggle": {
                  const { data: b } = await supabase.from("bots").select("status").eq("id", botId).single();
                  const ns = b?.status === 'active' ? 'disabled' : 'active';
                  await supabase.from("bots").update({ status: ns }).eq("id", botId).eq("owner_id", caller.id);
                  responseText = ns === 'active' ? "🟢 Bot đã được bật. / Bot has been enabled." : "🔴 Bot đã bị tắt. / Bot has been disabled.";
                  break;
                }
                case "delete":
                  responseText = "⚠️ Bạn có chắc muốn xoá bot này? Hành động này không thể hoàn tác.\n⚠️ Are you sure you want to delete this bot? This action cannot be undone.\n\nGửi 'yes' để xác nhận hoặc /cancel để huỷ.\nSend 'yes' to confirm or /cancel to cancel.";
                  newState = "deletebot_confirm";
                  newStateData = { bot_id: botId };
                  break;
                default:
                  responseText = "Hành động không xác định. Dùng /help để xem các lệnh có sẵn.\nUnknown action. Use /help to see available commands.";
              }
            } else {
              responseText = "Vui lòng chọn hành động từ các nút bên trên, hoặc dùng /cancel.\nPlease select an action from the buttons above, or use /cancel.";
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
              responseText = `Không tìm thấy bot @${uname}. Vui lòng kiểm tra username và thử lại, hoặc dùng /cancel.\nBot @${uname} not found. Please check the username and try again, or use /cancel.`;
              newState = state;
              break;
            }
            const { data: foundBot } = await supabase.from("bots").select("id").eq("profile_id", bp.id).eq("owner_id", caller.id).maybeSingle();
            if (!foundBot) {
              responseText = `Bạn không sở hữu bot có username @${uname}. Dùng /mybots để xem danh sách bot.\nYou don't own a bot with username @${uname}. Use /mybots to see your bots.`;
              newState = state;
              break;
            }

            const baseState = state.replace("_choose_bot", "");
            switch (baseState) {
              case "setname":
                responseText = `Đã chọn bot @${uname}. Gửi cho tôi tên mới.\nSelected bot @${uname}. Send me the new name.`;
                newState = "setname_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setdescription":
              case "setabouttext":
                responseText = `Đã chọn bot @${uname}. Gửi cho tôi mô tả mới (hoặc 'none' để xoá).\nSelected bot @${uname}. Send me the new description (or 'none' to remove).`;
                newState = "setdescription_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setcommands":
                responseText = `Đã chọn bot @${uname}. Gửi danh sách lệnh:\nSelected bot @${uname}. Send command list:\n\nlệnh - mô tả / command - description\n\nVí dụ / Example:\nstart - Khởi động bot / Start the bot\nhelp - Hiện trợ giúp / Show help\n\nGửi 'none' để xoá tất cả lệnh.\nSend 'none' to clear all commands.`;
                newState = "setcommands_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setwebhook":
                responseText = `Đã chọn bot @${uname}. Gửi cho tôi webhook URL (hoặc 'none' để xoá).\nSelected bot @${uname}. Send me the webhook URL (or 'none' to remove).`;
                newState = "setwebhook_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "setprivacy":
                responseText = `Đã chọn bot @${uname}. Chế độ riêng tư:\nSelected bot @${uname}. Privacy mode:\n\n- **enabled**: bot chỉ nhận lệnh / bot only receives commands\n- **disabled**: bot nhận tất cả tin nhắn / bot receives all messages\n\nGửi 'enabled' hoặc 'disabled'.\nSend 'enabled' or 'disabled'.`;
                newState = "setprivacy_input";
                newStateData = { bot_id: foundBot.id };
                break;
              case "revoke": {
                const newToken = generateToken();
                await supabase.from("bots").update({ bot_token: newToken }).eq("id", foundBot.id);
                responseText = `🔑 Token của @${uname} đã được đặt lại.\n🔑 Token for @${uname} has been reset.\n\nToken mới / New token:\n\`${newToken}\``;
                break;
              }
              case "deletebot":
                responseText = `⚠️ Bạn có chắc muốn xoá @${uname}? Hành động này không thể hoàn tác.\n⚠️ Are you sure you want to delete @${uname}? This action cannot be undone.\n\nGửi 'yes' để xác nhận hoặc /cancel để huỷ.\nSend 'yes' to confirm or /cancel to cancel.`;
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
              responseText = `✅ Đã cập nhật tên bot / Bot name updated: **${text}**`;
            } else {
              responseText = "Không tìm thấy bot. / Bot not found.";
            }
            break;
          }

          case "setdescription_input": {
            const desc = text.toLowerCase() === 'none' ? null : text;
            const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", stateData.bot_id).eq("owner_id", caller.id).single();
            if (bot) {
              await supabase.from("profiles").update({ bio: desc }).eq("id", bot.profile_id);
              await supabase.from("bots").update({ description: desc }).eq("id", stateData.bot_id);
              responseText = desc ? `✅ Đã cập nhật mô tả / Description updated: ${desc}` : "✅ Đã xoá mô tả. / Description removed.";
            } else {
              responseText = "Không tìm thấy bot. / Bot not found.";
            }
            break;
          }

          case "setwebhook_input": {
            const url = text.toLowerCase() === 'none' ? null : text;
            if (url && !url.startsWith('http')) {
              responseText = "Vui lòng gửi URL hợp lệ bắt đầu bằng http:// hoặc https://, hoặc 'none' để xoá.\nPlease send a valid URL starting with http:// or https://, or 'none' to remove.";
              newState = "setwebhook_input";
              newStateData = stateData;
              break;
            }
            await supabase.from("bots").update({ webhook_url: url }).eq("id", stateData.bot_id).eq("owner_id", caller.id);
            responseText = url ? `✅ Đã đặt webhook / Webhook set: ${url}` : "✅ Đã xoá webhook. / Webhook removed.";
            break;
          }

          case "setcommands_input": {
            if (text.toLowerCase() === 'none') {
              await supabase.from("bot_commands").delete().eq("bot_id", stateData.bot_id);
              responseText = "✅ Đã xoá tất cả lệnh. / All commands cleared.";
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
            responseText = `✅ Đã cập nhật lệnh / Commands updated:\n\n${cmds.map(c => `${c.command} - ${c.description}`).join("\n")}`;
            break;
          }

          case "setprivacy_input": {
            const mode = text.toLowerCase();
            if (mode !== 'enabled' && mode !== 'disabled') {
              responseText = "Vui lòng gửi 'enabled' hoặc 'disabled'.\nPlease send 'enabled' or 'disabled'.";
              newState = "setprivacy_input";
              newStateData = stateData;
              break;
            }
            const perms = mode === 'disabled' 
              ? { read_messages: true, send_messages: true, delete_messages: false, manage_users: false }
              : { read_messages: false, send_messages: true, delete_messages: false, manage_users: false };
            await supabase.from("bots").update({ permissions: perms }).eq("id", stateData.bot_id).eq("owner_id", caller.id);
            responseText = `✅ Chế độ riêng tư / Privacy mode: ${mode}. ${mode === 'enabled' ? 'Bot chỉ nhận lệnh. / Bot only receives commands.' : 'Bot nhận tất cả tin nhắn. / Bot receives all messages.'}`;
            break;
          }

          case "deletebot_confirm": {
            if (text.toLowerCase() !== 'yes') {
              responseText = "Đã huỷ xoá. Dùng /help để xem các lệnh có sẵn.\nDeletion cancelled. Use /help for available commands.";
              break;
            }
            const { data: bot } = await supabase.from("bots").select("profile_id").eq("id", stateData.bot_id).eq("owner_id", caller.id).single();
            if (bot) {
              await supabase.from("bot_commands").delete().eq("bot_id", stateData.bot_id);
              await supabase.from("bot_events").delete().eq("bot_id", stateData.bot_id);
              await supabase.from("bots").delete().eq("id", stateData.bot_id);
              responseText = `✅ Bot đã được xoá. / Bot has been deleted.`;
            } else {
              responseText = "Không tìm thấy bot. / Bot not found.";
            }
            break;
          }

          default:
            responseText = "Tôi không hiểu. Dùng /help để xem các lệnh có sẵn.\nI don't understand. Use /help to see available commands.";
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
