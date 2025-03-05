const getAllServers = require("./getAllServers.js");
const getServerStats = require("./getServerStats.js");
const promiseTimeout = require("./promiseTimeout.js");
const sendMessage = require("./sendMessage.js");
const config = require("./configuration.js");
const cliColor = require("cli-color");
const fs = require("node:fs");

module.exports = async function getStats(client) {
    try {
        console.log(cliColor.cyanBright("[PSS] ") + cliColor.yellow("Fetching servers details..."))
        const allServers = await promiseTimeout(getAllServers(), config.timeout * 1000);
        if (!allServers) throw new Error("Failed to get server details");

        console.log(cliColor.cyanBright("[PSS] ") + cliColor.yellow("Fetching servers resources..."));

        for (const server of allServers) {
            const serverStats = await promiseTimeout(getServerStats(server.uuid), config.timeout * 1000);

            if (serverStats.current_state === "missing") {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright(`${server.name} (${server.uuid}) is currently down.`));
            } else {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.green(`${server.name} (${server.uuid}) state is normal.`));
            }

            server.stats = serverStats
        }

        const data = {
            allServers,
            timestamp: Date.now()
        }

        sendMessage(client, data)
        return data
    } catch (error) {
        if (config.log_error) console.error(error)
        console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Server is currently down."));

        if (fs.existsSync("cache.json")) {
            try {
                const allServers = JSON.parse(fs.readFileSync("cache.json"));

                for (const server of allServers) {
                    server.stats = {
                        current_state: 'missing',
                        is_suspended: false,
                        resources: {
                            memory_bytes: 0,
                            cpu_absolute: 0,
                            disk_bytes: 0,
                            network_rx_bytes: 0,
                            network_tx_bytes: 0,
                            uptime: 0
                        }
                    }
                }
                
                sendMessage(client, allServers)
                return allServers
            } catch {
                console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Something went wrong with cache data..."));
                return null
            }
        } else {
            console.log(cliColor.cyanBright("[PSS] ") + cliColor.redBright("Last cache was not found!"));
            return null
        }
    }
}