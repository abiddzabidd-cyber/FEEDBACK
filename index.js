require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Staff roles
const OWNER = process.env.OWNER_ID;
const ADMIN = process.env.ADMIN_IDS.split(",");
const HELPER = process.env.HELPER_IDS.split(",");

// Feedback storage
let feedbacks = [];

// Channel
const FEEDBACK_CHANNEL = process.env.FEEDBACK_CHANNEL_ID;

client.once("ready", ()=>console.log(`Bot online sebagai ${client.user.tag}`));

client.on("interactionCreate", async interaction=>{
  if(interaction.isChatInputCommand()){
    if(interaction.commandName==="feedback"){
      const text = interaction.options.getString("saran");
      const msg = await interaction.guild.channels.cache.get(FEEDBACK_CHANNEL).send({
        content: `📝 Feedback dari ${interaction.user}:\n${text}`,
        components:[new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("approve").setLabel("Approve").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("reject").setLabel("Reject").setStyle(ButtonStyle.Danger)
        )]
      });
      feedbacks.push({id: msg.id, user: interaction.user.id, text: text, status: "pending"});
      interaction.reply({content:"✅ Feedback terkirim!", ephemeral:true});
    }
    if(interaction.commandName==="listfeedback"){
      if(!isStaff(interaction.user.id)) return interaction.reply({content:"❌ Kamu bukan staff", ephemeral:true});
      if(feedbacks.length===0) return interaction.reply("Belum ada feedback");
      let list = feedbacks.map(f=>`ID:${f.id} | User:${f.user} | Status:${f.status} | Text:${f.text}`).join("\n");
      interaction.reply({content:list, ephemeral:true});
    }
  }

  if(interaction.isButton()){
    if(!isStaff(interaction.user.id)) return interaction.reply({content:"❌ Kamu bukan staff", ephemeral:true});
    const msgFeedback = feedbacks.find(f=>f.id===interaction.message.id);
    if(!msgFeedback) return interaction.reply({content:"❌ Feedback tidak ditemukan", ephemeral:true});

    if(interaction.customId==="approve"){
      msgFeedback.status="approved";
      interaction.update({content:interaction.message.content+"\n✅ Approved oleh "+interaction.user.tag, components:[]});
      try{
        await client.users.fetch(msgFeedback.user).then(u=>u.send("✅ Feedback kamu disetujui!"));
      }catch{}
    }

    if(interaction.customId==="reject"){
      msgFeedback.status="rejected";
      // minta staff isi alasan
      const filter = m=>m.author.id===interaction.user.id;
      await interaction.reply({content:"Tulis alasan penolakan:", ephemeral:true});
      const collector = interaction.channel.createMessageCollector({filter,max:1,time:60000});
      collector.on("collect", async m=>{
        const reason = m.content;
        interaction.editReply({content:`Feedback rejected dengan alasan: ${reason}`, ephemeral:true});
        interaction.update({content:interaction.message.content+`\n❌ Rejected oleh ${interaction.user.tag}\nAlasan: ${reason}`, components:[]});
        try{
          await client.users.fetch(msgFeedback.user).then(u=>u.send(`❌ Feedback kamu ditolak\nAlasan: ${reason}`));
        }catch{}
      });
    }
  }
});

function isStaff(id){
  return id===OWNER || ADMIN.includes(id) || HELPER.includes(id);
}

// Register commands
const commands=[
  new SlashCommandBuilder().setName("feedback").setDescription("Kirim feedback").addStringOption(o=>o.setName("saran").setDescription("Tulis feedback").setRequired(true)),
  new SlashCommandBuilder().setName("listfeedback").setDescription("List semua feedback")
].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(process.env.TOKEN);
(async()=>{
  try{
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {body:commands});
    console.log("Slash command berhasil dibuat");
  }catch(err){console.error(err);}
})();

client.login(process.env.TOKEN);
