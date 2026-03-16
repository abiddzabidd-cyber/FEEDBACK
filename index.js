require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Staff check
function isStaff(userId) {
  const OWNER = process.env.OWNER_ID;
  const ADMIN = process.env.ADMIN_IDS.split(",");
  const HELPER = process.env.HELPER_IDS.split(",");
  return userId === OWNER || ADMIN.includes(userId) || HELPER.includes(userId);
}

// Feedback storage sementara di memory
let feedbackList = []; // {id, userId, content, status}

client.once("ready", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if(!interaction.isChatInputCommand()) return;

  const feedbackChannel = client.channels.cache.get(process.env.FEEDBACK_CHANNEL_ID);
  if(!feedbackChannel) return interaction.reply({ content: "❌ Channel feedback tidak ditemukan", ephemeral: true });

  if(interaction.commandName === "feedback") {
    const content = interaction.options.getString("saran");
    const fb = { id: feedbackList.length+1, userId: interaction.user.id, content, status: "pending" };
    feedbackList.push(fb);

    // Tombol approve/reject cuma staff liat nanti
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId(`approve_${fb.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${fb.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
      );

    await feedbackChannel.send({ content: `📩 Feedback #${fb.id} dari ${interaction.user.tag}: ${content}`, components: row.components });
    await interaction.reply({ content: "✅ Feedback terkirim!", ephemeral: true });
  }

  if(interaction.commandName === "listfeedback") {
    if(!isStaff(interaction.user.id)) return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });
    const list = feedbackList.map(fb => `#${fb.id} | ${fb.status} | ${fb.content}`).join("\n") || "Belum ada feedback";
    await interaction.reply({ content: `📋 Feedback list:\n${list}`, ephemeral: true });
  }
});

client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  const [action, id] = interaction.customId.split("_");
  const fb = feedbackList.find(f => f.id == id);
  if(!fb) return;

  if(!isStaff(interaction.user.id)) return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });

  if(action === "approve") {
    fb.status = "approved";
    await interaction.update({ content: `✅ Feedback #${fb.id} disetujui\n${fb.content}`, components: [] });
    try { await client.users.cache.get(fb.userId).send(`✅ Feedback kamu disetujui oleh staff`); } catch {}
  } else if(action === "reject") {
    fb.status = "rejected";
    await interaction.update({ content: `❌ Feedback #${fb.id} ditolak\n${fb.content}`, components: [] });
    try { await client.users.cache.get(fb.userId).send(`❌ Feedback kamu ditolak oleh staff`); } catch {}
  }
});

// Slash commands
const commands = [
  new SlashCommandBuilder().setName("feedback").setDescription("Kirim feedback").addStringOption(o=>o.setName("saran").setDescription("Saran kamu").setRequired(true)),
  new SlashCommandBuilder().setName("listfeedback").setDescription("Lihat semua feedback (staff)")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("Slash command berhasil dibuat");
  } catch(err) { console.error(err); }
})();

client.login(process.env.TOKEN);
