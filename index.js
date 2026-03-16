require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ====== Staff Roles ======
const STAFF_ROLES = [
  "1482900894965043242", // Owner
  "1482900917782188143", // Admin
  "1482900917782188144"  // Helper
];

// ====== Feedback ======
let feedbackData = fs.existsSync("feedback.json") ? JSON.parse(fs.readFileSync("feedback.json")) : [];

function saveFeedback(){
  fs.writeFileSync("feedback.json", JSON.stringify(feedbackData, null, 2));
}

// ====== Bot Ready ======
client.once("ready", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

// ====== Interaction Handler ======
client.on("interactionCreate", async interaction=>{
  const member = interaction.member;

  // ====== Slash Commands ======
  if(interaction.isChatInputCommand()){
    if(interaction.commandName === "feedback"){
      const text = interaction.options.getString("saran");
      const feedback = {
        id: Date.now().toString(),
        user: interaction.user.id,
        text,
        status: "pending"
      };
      feedbackData.push(feedback);
      saveFeedback();

      const hasButtonAccess = member.roles.cache.some(r => STAFF_ROLES.includes(r.id));
      let components = [];
      if(hasButtonAccess){
        components = [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${feedback.id}`)
            .setLabel("Approve")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${feedback.id}`)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger)
        )];
      }

      const channel = interaction.guild.channels.cache.get(process.env.FEEDBACK_CHANNEL);
      if(channel){
        channel.send({content:`📩 Feedback dari <@${interaction.user.id}>:\n${text}`, components});
      }

      interaction.reply({content:"✅ Feedback dikirim!", ephemeral:true});
    }
  }

  // ====== Tombol Approve / Reject ======
  if(interaction.isButton()){
    const [action, fid] = interaction.customId.split("_");
    const feedback = feedbackData.find(f=>f.id===fid);
    if(!feedback) return interaction.reply({content:"❌ Feedback tidak ditemukan", ephemeral:true});

    const hasRole = member.roles.cache.some(r => STAFF_ROLES.includes(r.id));
    if(!hasRole) return interaction.reply({content:"❌ Hanya staff yang bisa klik tombol ini", ephemeral:true});

    const user = await client.users.fetch(feedback.user).catch(()=>null);

    if(action === "approve"){
      feedback.status = "approved";
      saveFeedback();
      if(user) user.send(`✅ Feedback kamu disetujui oleh staff`).catch(()=>{});
      await interaction.update({content:`📌 Feedback disetujui: ${feedback.text}`, components:[]});
    }

    if(action === "reject"){
      feedback.status = "rejected";
      saveFeedback();
      if(user) user.send(`❌ Feedback kamu ditolak oleh staff`).catch(()=>{});
      await interaction.update({content:`📌 Feedback ditolak: ${feedback.text}`, components:[]});
    }
  }
});

// ====== Register Slash Commands ======
const commands = [
  new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Kirim feedback ke staff")
    .addStringOption(o=>o.setName("saran").setDescription("Saran atau masukan").setRequired(true))
].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(process.env.TOKEN);

(async()=>{
  try{
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      {body:commands}
    );
    console.log("Slash command berhasil dibuat");
  }catch(err){console.error(err);}
})();

client.login(process.env.TOKEN);
