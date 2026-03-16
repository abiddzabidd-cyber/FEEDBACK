require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_IDS = process.env.OWNER_IDS.split(",");
const ADMIN_IDS = process.env.ADMIN_IDS.split(",");
const HELPER_IDS = process.env.HELPER_IDS.split(",");
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID;

let feedbackCount = 0;
let feedbacks = {}; // simpan sementara, bisa upgrade ke DB nanti

// --- READY ---
client.once("ready", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

// --- INTERACTION ---
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // --- FEEDBACK ---
  if (interaction.commandName === "feedback") {
    const saran = interaction.options.getString("saran");

    const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
    if (!feedbackChannel) return interaction.reply({ content: "Channel feedback tidak ditemukan", ephemeral: true });

    feedbackCount++;
    feedbacks[feedbackCount] = {
      userId: interaction.user.id,
      saran,
      status: "pending"
    };

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${feedbackCount}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${feedbackCount}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );

    await feedbackChannel.send({ 
      content: `📩 Feedback #${feedbackCount} dari ${interaction.user.tag}: ${saran}`,
      components: [row]
    });

    return interaction.reply({ content: "✅ Feedback terkirim!", ephemeral: true });
  }

  // --- LISTFEEDBACK (staff only) ---
  if (interaction.commandName === "listfeedback") {
    const memberId = interaction.user.id;
    if (![...OWNER_IDS, ...ADMIN_IDS, ...HELPER_IDS].includes(memberId)) {
      return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });
    }

    let list = Object.entries(feedbacks).map(([id, fb]) => {
      return `#${id} dari <@${fb.userId}>: ${fb.saran} (${fb.status})`;
    }).join("\n") || "Tidak ada feedback";

    return interaction.reply({ content: `📋 Daftar feedback:\n${list}`, ephemeral: true });
  }
});

// --- BUTTON ---
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const memberId = interaction.user.id;
  if (![...OWNER_IDS, ...ADMIN_IDS, ...HELPER_IDS].includes(memberId)) {
    return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });
  }

  const [action, id] = interaction.customId.split("_");
  const fb = feedbacks[id];
  if (!fb) return interaction.reply({ content: "Feedback tidak ditemukan", ephemeral: true });
  if (fb.status !== "pending") return interaction.reply({ content: "Feedback sudah di proses", ephemeral: true });

  const user = await client.users.fetch(fb.userId);

  if (action === "approve") {
    fb.status = "approved";
    await interaction.update({ content: `✅ Feedback #${id} disetujui oleh ${interaction.user.tag}: ${fb.saran}`, components: [] });
    await user.send(`✅ Feedbackmu disetujui! Terima kasih.`);
  } else if (action === "reject") {
    fb.status = "rejected";
    await interaction.update({ content: `❌ Feedback #${id} ditolak oleh ${interaction.user.tag}: ${fb.saran}`, components: [] });
    await user.send(`❌ Feedbackmu ditolak: Tidak sesuai aturan.`);
  }
});

// --- SLASH COMMAND REGISTER ---
const commands = [
  new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Kirim feedback")
    .addStringOption(opt => opt.setName("saran").setDescription("Masukkan saran/feedback").setRequired(true)),
  
  new SlashCommandBuilder()
    .setName("listfeedback")
    .setDescription("Lihat semua feedback (staff only)")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Slash command berhasil dibuat");
  } catch (err) {
    console.error(err);
  }
})();

client.login(process.env.TOKEN);
