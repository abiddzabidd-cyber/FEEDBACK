const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
});

// ===== CONFIG =====
const OWNER_ID = process.env.OWNER_ID; 
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];
const HELPER_IDS = process.env.HELPER_IDS ? process.env.HELPER_IDS.split(",") : [];
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID;

// ===== FILES =====
const FEEDBACK_FILE = './feedback.json';
const STAFF_FILE = './staff.json';
if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, '[]');
if (!fs.existsSync(STAFF_FILE)) fs.writeFileSync(STAFF_FILE, JSON.stringify({ admins: [], helpers: [] }));

// ===== WARNA STATUS =====
const STATUS_COLOR = {
    pending: 0xFFD700,
    approved: 0x00FF00,
    rejected: 0xFF0000
};

// ===== UTILS =====
function loadFeedback() { return JSON.parse(fs.readFileSync(FEEDBACK_FILE)); }
function saveFeedback(data) { fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2)); }
function loadStaff() { return JSON.parse(fs.readFileSync(STAFF_FILE)); }
function saveStaff(data) { fs.writeFileSync(STAFF_FILE, JSON.stringify(data, null, 2)); }
function isStaff(userId) {
    const staff = loadStaff();
    return ADMIN_IDS.includes(userId) || HELPER_IDS.includes(userId) || staff.admins.includes(userId) || staff.helpers.includes(userId) || userId === OWNER_ID;
}

// ===== BOT READY =====
client.once(Events.ClientReady, () => {
    console.log(`Bot online sebagai ${client.user.tag}`);
});

// ===== COMMANDS =====
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, user, options } = interaction;

        if (commandName === 'feedback') {
            const saran = options.getString('saran');
            const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
            if (!feedbackChannel) return interaction.reply({ content: 'Channel feedback tidak ditemukan!', ephemeral: true });

            const feedbackData = loadFeedback();
            const newFeedback = {
                id: feedbackData.length + 1,
                member: user.username,
                memberId: user.id,
                feedback: saran,
                status: 'pending',
                reason: ''
            };
            feedbackData.push(newFeedback);
            saveFeedback(feedbackData);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_${newFeedback.id}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${newFeedback.id}`)
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Danger)
                );

            const embed = new EmbedBuilder()
                .setTitle(`📩 Feedback #${newFeedback.id}`)
                .setDescription(`${user.username}: ${saran}`)
                .setColor(STATUS_COLOR.pending)
                .addFields(
                    { name: 'Status', value: 'PENDING', inline: true },
                    { name: 'Alasan', value: 'Belum diisi', inline: true }
                )
                .setTimestamp();

            await feedbackChannel.send({ embeds: [embed], components: [row] });
            interaction.reply({ content: 'Feedback berhasil dikirim!', ephemeral: true });
        }

        if (commandName === 'listfeedback') {
            if (!isStaff(user.id)) return interaction.reply({ content: 'Kamu bukan staff!', ephemeral: true });

            const feedbackData = loadFeedback();
            if (feedbackData.length === 0) return interaction.reply({ content: 'Belum ada feedback!', ephemeral: true });

            let listText = '';
            feedbackData.forEach(fb => {
                listText += `#${fb.id} | ${fb.member} | Status: ${fb.status.toUpperCase()} | ${fb.reason || '-'}\n`;
            });
            interaction.reply({ content: listText, ephemeral: true });
        }
    }

    // BUTTON CLICK
    if (interaction.isButton()) {
        const [action, id] = interaction.customId.split('_');
        const feedbackData = loadFeedback();
        const fb = feedbackData.find(f => f.id == id);
        if (!fb) return interaction.reply({ content: 'Feedback tidak ditemukan!', ephemeral: true });

        if (!isStaff(interaction.user.id)) return interaction.reply({ content: 'Kamu bukan staff!', ephemeral: true });

        if (action === 'approve' || action === 'reject') {
            await interaction.showModal({
                custom_id: `${action}_modal_${id}`,
                title: action === 'approve' ? 'Approve Feedback' : 'Reject Feedback',
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: 'reason',
                                style: 2,
                                label: 'Alasan',
                                placeholder: 'Isi alasan disetujui / ditolak',
                                required: true
                            }
                        ]
                    }
                ]
            });
        }
    }

    // MODAL SUBMIT
    if (interaction.isModalSubmit()) {
        const [action, , id] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('reason');

        const feedbackData = loadFeedback();
        const fb = feedbackData.find(f => f.id == id);
        if (!fb) return interaction.reply({ content: 'Feedback tidak ditemukan!', ephemeral: true });

        fb.status = action === 'approve' ? 'approved' : 'rejected';
        fb.reason = reason;
        saveFeedback(feedbackData);

        const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
        const messages = await feedbackChannel.messages.fetch({ limit: 50 });
        const msg = messages.find(m => m.embeds[0]?.title?.includes(`#${id}`));
        if (msg) {
            const embed = EmbedBuilder.from(msg.embeds[0])
                .setColor(STATUS_COLOR[fb.status])
                .spliceFields(0, 2, 
                    { name: 'Status', value: fb.status.toUpperCase(), inline: true },
                    { name: 'Alasan', value: fb.reason || '-', inline: true }
                );
            msg.edit({ embeds: [embed], components: [] });
        }

        const member = await client.users.fetch(fb.memberId);
        member.send(`Feedbackmu (#${fb.id}) telah ${fb.status.toUpperCase()}.\nAlasan: ${fb.reason}`);

        interaction.reply({ content: `Feedback #${id} berhasil ${fb.status.toUpperCase()}!`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
