const uptimeFormatter = require("./uptimeFormatter.js");
const { EmbedBuilder, time } = require("discord.js");
const config = require("./configuration.js");
const webhook = require("./webhook.js");
const cliColor = require("cli-color");
const bit = require("prettier-bytes");
const path = require("node:path");
const bytes = require("bytes");
const fs = require("node:fs");

module.exports = async function sendMessage(client, allServers) {
    console.log(allServers)

    // Cache handling
    let cache = (() => {
        try {
            return JSON.parse(fs.readFileSync(path.join(__dirname, "../cache.json")));
        } catch {
            return false;
        }
    })();

    // Save server state to cache
    fs.writeFileSync("cache.json", JSON.stringify(allServers, null, 2), "utf8");

    // Create an array to store embeds
    const embeds = [];

    // Loop through all servers to create embed for each server
    for (const server of allServers) {
        // Handle server state change (down or online)
        if (server.stats.current_state === "missing" && cache?.stats?.current_state !== "missing") {
            webhook(
                new EmbedBuilder()
                    .setTitle("Server down")
                    .setColor("ED4245")
                    .setDescription(`Server \`${server.details.name}\` is down.`)
            );
        } else if (server.stats.current_state !== "missing" && cache?.stats?.current_state === "missing") {
            webhook(
                new EmbedBuilder()
                    .setTitle("Server online")
                    .setColor("57F287")
                    .setDescription(`Server \`${server.details.name}\` is back online.`)
            );
        }

        // Create a new embed for the server
        const embed = new EmbedBuilder()
            .setAuthor({ name: config.embed.author.name || null, iconURL: config.embed.author.icon || null })
            .setTitle(config.embed.title || null)
            .setDescription(config.embed.description.replace("{{time}}", time(new Date(Date.now() + 10000), "R")) || null)
            .setColor(config.embed.color || null)
            .setImage(config.embed.image || null)
            .setTimestamp(config.embed.timestamp ? new Date() : null)
            .setThumbnail(config.embed.thumbnail || null)
            .setFooter({ text: config.embed.footer.text || null, iconURL: config.embed.footer.icon || null })
            .addFields({ name: "Status", value: ["starting", "running"].includes(server.stats.current_state) ? config.status.online : config.status.offline });

        // Add fields for server stats
        if (config.server.details && ["starting", "running"].includes(server.stats.current_state)) {
            if (config.server.memory)
                embed.addFields({ inline: config.embed.fields.inline, name: "Memory Usage", value: `\`${bytes.format(server.stats.resources.memory_bytes, { unitSeparator: " " })}\` / \`${server.details.limits.memory === 0 ? "∞" : bit(server.details.limits.memory * 1000000)}\`` });
            if (config.server.disk)
                embed.addFields({ inline: config.embed.fields.inline, name: "Disk Usage", value: `\`${bytes.format(server.stats.resources.disk_bytes, { unitSeparator: " " })}\` / \`${server.details.limits.disk === 0 ? "∞" : bit(server.details.limits.disk * 1000000)}\`` });
            if (config.server.cpu)
                embed.addFields({ inline: config.embed.fields.inline, name: "CPU Load", value: `\`${server.stats.resources.cpu_absolute.toFixed(2)}%\`` });
            if (config.server.network)
                embed.addFields({ inline: config.embed.fields.inline, name: "Network", value: `Upload: \`${bytes.format(server.stats.resources.network_rx_bytes, { unitSeparator: " " })}\`\nDownload: \`${bytes.format(server.stats.resources.network_tx_bytes, { unitSeparator: " " })}\`` });
            if (config.server.uptime)
                embed.addFields({ inline: config.embed.fields.inline, name: "Uptime", value: `\`${uptimeFormatter(server.stats.resources.uptime)}\`` });
        }

        // Add the current server's embed to the array
        embeds.push(embed);
    }

    // Fetch the channel to send the message
    const channel = await client.channels.fetch(process.env.DiscordChannel);
    const messages = await channel.messages.fetch({ limit: 10 });
    const message = messages.find((msg) => msg.author.id === client.user.id);

    // Send all embeds in one message
    try {
        await message?.edit({ embeds }) || channel.send({ embeds });
        console.log(
            cliColor.cyanBright("[PSS] ") + cliColor.green(`Server stats successfully posted to the ${cliColor.blueBright(channel.name)} channel!`)
        );
    } catch (error) {
        try {
            if (error.rawError?.code === 429) {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Error 429 | Your IP has been rate limited by either Discord or your website. If it's a rate limit with Discord, you must wait. If it's an issue with your website, consider whitelisting your server IP."));
            } else if (error.rawError?.code === 403) {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("FORBIDDEN | The channel ID you provided is incorrect. Please double-check you have the right ID. If you're not sure, read our documentation: \n>>https://github.com/HirziDevs/PteroServerStats/blob/main/guide/channel-id.md<<"));
            } else if (error.code === "ENOTFOUND") {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("ENOTFOUND | DNS Error. Ensure your network connection and DNS server are functioning correctly."));
            } else if (error.rawError?.code === 50001) {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Discord Error | Your discord bot doesn't have access to see/send message/edit message in the channel!"));
            } else if (error.rawError?.errors && Object?.values(error.rawError.errors)[0]?._errors[0]?.code === "MAX_EMBED_SIZE_EXCEEDED") {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Discord Error | Embed message limit exceeded! Please limit or decrease the nodes that need to be shown in the config!"));
            } else if (error.rawError?.errors && Object?.values(error.rawError.errors)[0]?._errors[0]?.code) {
                console.log(Object.values(error.rawError.errors)[0]._errors[0].message);
            } else {
                console.error(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Discord Error"), error);
            }
            process.exit();
        } catch (err) {
            console.error(error);
            process.exit();
        }
    }
};
