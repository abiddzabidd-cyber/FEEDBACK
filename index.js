// index.js
const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

// Inisialisasi client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Load admin/helper list
let adminData = { admins: [] };
if(fs.existsSync("admin.json")){
  adminData = JSON.parse(fs.readFileSync("admin.json"));
}

// Cek staff (owner + admin/helper)
function isStaff(userId) {
  return userId === process.env.OWNER_ID || adminData.admins.includes(userId);
}

client.once("ready", async () => {
  console.log(`Bot online sebagai ${client.user.tag}`);

  // Slash command
  const feedbackCommand = new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Kirim saran atau feedback")
    .addStringOption(option => 
      option.setName("saran")
        .setDescription("Isi feedback kamu")
        .setRequired(true)
    );

  const addAdminCommand = new SlashCommandBuilder()
    .setName("addadmin")
    .setDescription("Owner bisa add admin/helper")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("User yg mau dijadikan admin/helper")
        .setRequired(true)
    );

  const removeAdminCommand = new SlashCommandBuilder()
    .setName("removeadmin")
    .setDescription("Owner bisa remove admin/helper")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("User yg mau dihapus dari admin/helper")
        .setRequired(true)
    );

  await client.application.commands.set([feedbackCommand, addAdminCommand, removeAdminCommand]);
  console.log("Slash command berhasil dibuat");
});

// Handle slash command
client.on("interactionCreate", async interaction => {
  if(interaction.type !== InteractionType.ApplicationCommand) return;

  const userId = interaction.user.id;
  const feedbackChannel = await client.channels.fetch(process.env.FEEDBACK_CHANNEL_ID);

  // Feedback
  if(interaction.commandName === "feedback"){
    const saran = interaction.options.getString("saran");

    const feedbackEmbed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("📩 Feedback Baru")
      .setDescription(`**Dari:** ${interaction.user.tag}\n**Saran:** ${saran}\n**Status:** Pending`);

    const approveBtn = new ButtonBuilder()
      .setCustomId("approve")
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success);

    const rejectBtn = new ButtonBuilder()
      .setCustomId("reject")
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

    await feedbackChannel.send({
      embeds: [feedbackEmbed],
      components: isStaff(userId) ? [row] : []
    });

    await interaction.reply({ content: "✅ Feedback terkirim!", ephemeral: true });
  }

  // Add admin
  if(interaction.commandName === "addadmin"){
    if(userId !== process.env.OWNER_ID) return interaction.reply({ content: "❌ Hanya owner yg bisa add admin", ephemeral: true });

    const newAdminId = interaction.options.getUser("user").id;
    if(!adminData.admins.includes(newAdminId)){
      adminData.admins.push(newAdminId);
      fs.writeFileSync("admin.json", JSON.stringify(adminData, null, 2));
      return interaction.reply({ content: `✅ User ${newAdminId} sekarang admin/helper` });
    } else {
      return interaction.reply({ content: "⚠️ User ini sudah admin/helper" });
    }
  }

  // Remove admin
  if(interaction.commandName === "removeadmin"){
    if(userId !== process.env.OWNER_ID) return interaction.reply({ content: "❌ Hanya owner yg bisa remove admin", ephemeral: true });

    const adminId = interaction.options.getUser("user").id;
    adminData.admins = adminData.admins.filter(id => id !== adminId);
    fs.writeFileSync("admin.json", JSON.stringify(adminData, null, 2));
    return interaction.reply({ content: `🗑 User ${adminId} bukan admin/helper lagi` });
  }
});

// Tombol approve/reject
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  const userId = interaction.user.id;
  if(!isStaff(userId)) return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });

  const msg = interaction.message;
  const embed = EmbedBuilder.from(msg.embeds[0]);
  const memberTag = embed.data.description.split("\n")[0].replace("**Dari:** ", "");

  if(interaction.customId === "approve"){
    embed.setColor("Green");
    embed.setFooter({ text: "Disetujui ✅" });
    await msg.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: "✅ Feedback disetujui", ephemeral: true });
    const member = await client.users.fetch(memberTag.replace(/<@!?(\d+)>/, "$1")).catch(()=>null);
    if(member) member.send("✅ Feedback kamu telah disetujui oleh staff!");
  }

  if(interaction.customId === "reject"){
    embed.setColor("Red");
    embed.setFooter({ text: "Ditolak ❌" });
    await msg.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: "❌ Feedback ditolak", ephemeral: true });
    const member = await client.users.fetch(memberTag.replace(/<@!?(\d+)>/, "$1")).catch(()=>null);
    if(member) member.send("❌ Feedback kamu telah ditolak oleh staff!");
  }
});

// Login
client.login(process.env.TOKEN);
