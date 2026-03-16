require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");

// ====== CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ====== ENV VARIABLES ======
const OWNER_ID = process.env.OWNER_ID; // satu owner aja
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];
const HELPER_IDS = process.env.HELPER_IDS ? process.env.HELPER_IDS.split(",") : [];
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID; // channel tempat feedback masuk

// ====== FEEDBACK STORAGE ======
let feedbackCount = 0;
let feedbacks = {}; // { id: { userId, content, status } }

// ====== UTILS ======
function isStaff(userId) {
  return userId === OWNER_ID || ADMIN_IDS.includes(userId) || HELPER_IDS.includes(userId);
}

// ====== READY ======
client.once("ready", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

// ====== MESSAGE/INTERACTION HANDLER ======
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, user, options } = interaction;

    // ====== FEEDBACK ======
    if (commandName === "feedback") {
      const content = options.getString("saran");
      feedbackCount++;
      const id = feedbackCount;

      feedbacks[id] = { userId: user.id, content, status: "pending" };

      const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);
      if (!channel)
        return interaction.reply({ content: "⚠️ Channel feedback tidak ditemukan", ephemeral: true });

      // Row tombol approve/reject hanya staff bisa klik
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${id}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${id}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `📩 Feedback #${id} dari <@${user.id}>: ${content}`,
        components: [row],
      });

      await interaction.reply({ content: "✅ Feedback berhasil dikirim", ephemeral: true });
    }

    // ====== LIST FEEDBACK (staff only) ======
    if (commandName === "listfeedback") {
      if (!isStaff(user.id))
        return interaction.reply({ content: "⚠️ Kamu bukan staff", ephemeral: true });

      let list = Object.entries(feedbacks)
        .map(([id, f]) => `#${id} | <@${f.userId}> | ${f.content} | ${f.status}`)
        .join("\n") || "Belum ada feedback";

      interaction.reply({ content: list, ephemeral: true });
    }
  }

  // ====== BUTTON HANDLER ======
  if (interaction.isButton()) {
    const [action, fid] = interaction.customId.split("_");
    const feedback = feedbacks[fid];
    if (!feedback) return;

    // hanya staff bisa klik
    if (!isStaff(interaction.user.id))
      return interaction.reply({ content: "⚠️ Kamu bukan staff", ephemeral: true });

    const userObj = await client.users.fetch(feedback.userId).catch(() => null);

    if (action === "approve") {
      feedback.status = "approved";
      await interaction.update({ content: `✅ Feedback #${fid} disetujui`, components: [] });
      if (userObj)
        userObj.send(`✅ Feedback kamu disetujui: "${feedback.content}"`).catch(() => {});
    } else if (action === "reject") {
      feedback.status = "rejected";
      await interaction.update({ content: `❌ Feedback #${fid} ditolak`, components: [] });
      if (userObj)
        userObj
          .send(`❌ Feedback kamu ditolak: "${feedback.content}"\nAlasan: Silakan perbaiki`)
          .catch(() => {});
    }
  }
});

// ====== SLASH COMMANDS REGISTER ======
const commands = [
  new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Kirim saran/feedback")
    .addStringOption((o) => o.setName("saran").setDescription("Isi feedback").setRequired(true)),
  new SlashCommandBuilder()
    .setName("listfeedback")
    .setDescription("Lihat semua feedback (staff only)"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
    console.log("Slash command berhasil dibuat");
  } catch (err) {
    console.error(err);
  }
})();

// ====== LOGIN ======
client.login(process.env.TOKEN);
