require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID;
const OWNER_ID = process.env.OWNER_ID; // langsung pakai ID pribadi
let ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
let HELPER_IDS = process.env.HELPER_IDS ? process.env.HELPER_IDS.split(',') : [];

const FEEDBACK_FILE = './feedback.json';
const STAFF_FILE = './staff.json';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
});

// Load feedback.json
let feedbacks = fs.existsSync(FEEDBACK_FILE) ? JSON.parse(fs.readFileSync(FEEDBACK_FILE)) : [];

// Load staff.json
let staffData = fs.existsSync(STAFF_FILE) ? JSON.parse(fs.readFileSync(STAFF_FILE)) : { admins: ADMIN_IDS, helpers: HELPER_IDS };

function saveFeedbacks() {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
}

function saveStaff() {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(staffData, null, 2));
}

// Cek apakah member staff
function isStaff(member) {
    return member.id === OWNER_ID || staffData.admins.includes(member.id) || staffData.helpers.includes(member.id);
}

function statusEmoji(status) {
    switch(status) {
        case 'pending': return '🟨';
        case 'approved': return '🟩';
        case 'rejected': return '🟥';
        default: return '❔';
    }
}

client.once('ready', async () => {
    console.log(`Bot online sebagai ${client.user.tag}`);

    // Daftarin slash commands
    const commands = [
        new SlashCommandBuilder().setName('feedback').setDescription('Kirim saran/feedback')
            .addStringOption(opt => opt.setName('saran').setDescription('Isi saran').setRequired(true)),
        new SlashCommandBuilder().setName('listfeedback').setDescription('Lihat semua feedback (staff only)'),
        new SlashCommandBuilder().setName('addstaff').setDescription('Tambah admin/helper (owner only)')
            .addStringOption(opt => opt.setName('role').setDescription('admin/helper').setRequired(true))
            .addUserOption(opt => opt.setName('user').setDescription('User yang mau ditambah').setRequired(true)),
        new SlashCommandBuilder().setName('removestaff').setDescription('Hapus admin/helper (owner only)')
            .addUserOption(opt => opt.setName('user').setDescription('User yang mau dihapus').setRequired(true))
    ];
    await client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // --------------------- FEEDBACK ---------------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'feedback') {
        const saran = interaction.options.getString('saran');
        const id = feedbacks.length + 1;
        const feedbackData = {
            id,
            member: interaction.user.username,
            feedback: saran,
            status: 'pending',
            reason: ''
        };
        feedbacks.push(feedbackData);
        saveFeedbacks();

        const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_${id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_${id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({ content: `📩 Feedback #${id} dari ${interaction.user.username}: ${saran} ${statusEmoji('pending')}`, components: [row] });
        await interaction.reply({ content: 'Feedback berhasil dikirim!', ephemeral: true });
    }

    // --------------------- LIST FEEDBACK ---------------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'listfeedback') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'Kamu bukan staff!', ephemeral: true });
        let list = feedbacks.map(f => `#${f.id} ${f.member}: ${f.feedback} ${statusEmoji(f.status)}`).join('\n');
        if (!list) list = 'Belum ada feedback';
        await interaction.reply({ content: list, ephemeral: true });
    }

    // --------------------- ADD STAFF ---------------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'addstaff') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Hanya owner yang bisa menambah staff!', ephemeral: true });
        const role = interaction.options.getString('role').toLowerCase();
        const user = interaction.options.getUser('user');

        if (role === 'admin') {
            if (!staffData.admins.includes(user.id)) staffData.admins.push(user.id);
        } else if (role === 'helper') {
            if (!staffData.helpers.includes(user.id)) staffData.helpers.push(user.id);
        } else return interaction.reply({ content: 'Role harus admin atau helper!', ephemeral: true });

        saveStaff();
        await interaction.reply({ content: `${user.username} berhasil ditambahkan sebagai ${role}`, ephemeral: true });
    }

    // --------------------- REMOVE STAFF ---------------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'removestaff') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Hanya owner yang bisa menghapus staff!', ephemeral: true });
        const user = interaction.options.getUser('user');

        staffData.admins = staffData.admins.filter(id => id !== user.id);
        staffData.helpers = staffData.helpers.filter(id => id !== user.id);
        saveStaff();

        await interaction.reply({ content: `${user.username} berhasil dihapus dari staff`, ephemeral: true });
    }

    // --------------------- BUTTON APPROVE/REJECT ---------------------
    if (interaction.isButton()) {
        if (!isStaff(interaction.member)) return interaction.reply({ content: 'Kamu bukan staff!', ephemeral: true });

        const [action, fid] = interaction.customId.split('_');
        const feedback = feedbacks.find(f => f.id == fid);
        if (!feedback) return interaction.reply({ content: 'Feedback tidak ditemukan!', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId(`modal_${action}_${fid}`)
            .setTitle(`${action.toUpperCase()} Feedback #${fid}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Alasan')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );
        await interaction.showModal(modal);
    }

    // --------------------- MODAL SUBMIT ---------------------
    if (interaction.isModalSubmit()) {
        const [prefix, action, fid] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('reason');
        const feedback = feedbacks.find(f => f.id == fid);
        if (!feedback) return interaction.reply({ content: 'Feedback tidak ditemukan!', ephemeral: true });

        feedback.status = action === 'approve' ? 'approved' : 'rejected';
        feedback.reason = reason;
        saveFeedbacks();

        const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 100 });
        const msg = messages.find(m => m.content.includes(`Feedback #${fid} dari`));
        if (msg) {
            await msg.edit({ content: `📩 Feedback #${fid} dari ${feedback.member}: ${feedback.feedback} ${statusEmoji(feedback.status)}\nKARENA: ${feedback.reason}`, components: [] });
        }

        // DM member
        try {
            const user = await client.users.fetch(interaction.user.id);
            await user.send(`Feedback kamu #${fid} telah ${feedback.status.toUpperCase()}.\nAlasan: ${feedback.reason}`);
        } catch {}

        await interaction.reply({ content: `Feedback #${fid} telah ${feedback.status.toUpperCase()}`, ephemeral: true });
    }
});

client.login(TOKEN);
