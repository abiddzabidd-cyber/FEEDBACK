// index.js
const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

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

// Cek staff
function isStaff(userId){
  return userId === process.env.OWNER_ID || adminData.admins.includes(userId);
}

client.once("ready", async () => {
  console.log(`Bot online sebagai ${client.user.tag}`);

  // Buat slash command
  const feedbackCommand = new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Kirim saran atau feedback")
    .addStringOption(option =>
      option.setName("saran")
        .setDescription("Isi feedback kamu")
        .setRequired(true)
    );

  const listCommand = new SlashCommandBuilder()
    .setName("listfeedback")
    .setDescription("Staff bisa liat feedback pending");

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

  await client.application.commands.set([feedbackCommand, listCommand, addAdminCommand, removeAdminCommand]);
  console.log("Slash command berhasil dibuat");
});

client.on("interactionCreate", async interaction => {
  const userId = interaction.user.id;
  const feedbackChannel = await client.channels.fetch(process.env.FEEDBACK_CHANNEL_ID);

  // FEEDBACK COMMAND
  if(interaction.commandName === "feedback"){
    const saran = interaction.options.getString("saran");

    const feedbackEmbed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("📩 Feedback Baru")
      .setDescription(`**Dari:** ${interaction.user.tag}\n**Saran:** ${saran}\n**Status:** Pending`);

    await feedbackChannel.send({ embeds: [feedbackEmbed] });
    await interaction.reply({ content: "✅ Feedback terkirim!", ephemeral: true });
  }

  // LIST FEEDBACK
  if(interaction.commandName === "listfeedback"){
    if(!isStaff(userId)) return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });

    const messages = await feedbackChannel.messages.fetch({ limit: 50 });
    const pendingMessages = messages.filter(msg => msg.embeds[0]?.data.color === 16776960); // kuning

    if(pendingMessages.size === 0) return interaction.reply({ content: "⚠️ Tidak ada feedback pending", ephemeral: true });

    for(const [id, msg] of pendingMessages){
      const embed = msg.embeds[0];
      const approveBtn = new ButtonBuilder().setCustomId(`approve_${msg.id}`).setLabel("Approve").setStyle(ButtonStyle.Success);
      const rejectBtn = new ButtonBuilder().setCustomId(`reject_${msg.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

      await interaction.user.send({ embeds: [embed], components: [row] }).catch(()=>{});
    }

    await interaction.reply({ content: "📬 Semua feedback pending telah dikirim ke DM kamu!", ephemeral: true });
  }

  // ADD ADMIN
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

  // REMOVE ADMIN
  if(interaction.commandName === "removeadmin"){
    if(userId !== process.env.OWNER_ID) return interaction.reply({ content: "❌ Hanya owner yg bisa remove admin", ephemeral: true });

    const adminId = interaction.options.getUser("user").id;
    adminData.admins = adminData.admins.filter(id => id !== adminId);
    fs.writeFileSync("admin.json", JSON.stringify(adminData, null, 2));
    return interaction.reply({ content: `🗑 User ${adminId} bukan admin/helper lagi` });
  }
});

// BUTTON APPROVE/REJECT
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  const userId = interaction.user.id;
  if(!isStaff(userId)) return interaction.reply({ content: "❌ Kamu bukan staff", ephemeral: true });

  const msg = interaction.message;
  const embed = EmbedBuilder.from(msg.embeds[0]);
  const memberTag = embed.data.description.split("\n")[0].replace("**Dari:** ", "");

  if(interaction.customId.startsWith("approve")){
    embed.setColor("Green");
    embed.setFooter({ text: "Disetujui ✅" });
    await msg.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: "✅ Feedback disetujui", ephemeral: true });

    const member = await client.users.fetch(memberTag.split("#")[0]).catch(()=>null);
    if(member) member.send("✅ Feedback kamu telah disetujui oleh staff!");
  }

  if(interaction.customId.startsWith("reject")){
    embed.setColor("Red");
    embed.setFooter({ text: "Ditolak ❌" });
    await msg.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: "❌ Feedback ditolak", ephemeral: true });

    const member = await client.users.fetch(memberTag.split("#")[0]).catch(()=>null);
    if(member) member.send("❌ Feedback kamu telah ditolak oleh staff!");
  }
});

client.login(process.env.TOKEN);
