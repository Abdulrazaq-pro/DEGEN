const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const fs = require("fs");
// const fetch = require("node-fetch");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionFile = process.env.SESSION_FILE;
const groupId = process.env.GROUP_ID;

// Add debug logging for environment variables
console.log("Configuration:");
console.log("Session File:", sessionFile);
console.log("Group ID:", groupId);
console.log("API ID:", apiId);

const sessionString = fs.existsSync(sessionFile)
  ? fs.readFileSync(sessionFile, "utf8")
  : "";

function extractPumpString(message) {
  if (!message || typeof message !== "string") {
    console.log("⚠️ Invalid message format:", message);
    return null;
  }
  console.log("🔍 Analyzing message:", message);

  // Updated regex pattern to capture the full token address containing 'pump'
  const match = message.match(/\b[\w\d]{30,}pump\b/i);
  if (match) {
    console.log("🎯 Found pump string:", match[0]);
    return match[0];
  }

  // Fallback to simpler pump string if no address is found
  const simplePumpMatch = message.match(/\b\S*pump\S*\b/i);
  if (simplePumpMatch) {
    console.log("🎯 Found simple pump string:", simplePumpMatch[0]);
    return simplePumpMatch[0];
  }

  console.log("❌ No pump string found in message");
  return null;
}

async function sendMessageToBot(message) {
  const botToken = "7598438383:AAF8z10Xb6EXKjLU52rCitLaTlcK5sip_Iw";
  const chatId = "@degenfortrade";
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: `🚀 Pump Alert!\n\nDetected Token: ${message}\n\nTimestamp: ${new Date().toISOString()}`,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log("📤 Message sent to bot:", result);
  } catch (error) {
    console.error("❌ Error sending message to bot:", error);
  }
}

(async () => {
  console.log("Starting pump string detection bot...");

  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () =>
      await input.text("Please enter your phone number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  const session = client.session.save();
  fs.writeFileSync(sessionFile, session);
  console.log("🤖 Pump String Detection Bot is now running!");

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;

      // Enhanced debugging for message structure
      console.log("\nMessage Debug Info:");
      console.log("Message Object:", JSON.stringify(message, null, 2));
      console.log("Peer ID Type:", message?.peerId?.constructor?.name);
      console.log(
        "Channel ID (if exists):",
        message?.peerId?.channelId?.toString()
      );
      console.log("Expected Group ID:", groupId);

      if (!message || !message.peerId) {
        console.log("⚠️ Invalid message structure");
        return;
      }

      // Convert both IDs to strings and trim for comparison
      const receivedGroupId = message.peerId.channelId?.toString().trim();
      const targetGroupId = groupId.toString().trim();

      console.log("Comparison:");
      console.log("Received Group ID:", receivedGroupId);
      console.log("Target Group ID:", targetGroupId);
      console.log("Match?:", receivedGroupId === targetGroupId);

      if (receivedGroupId === targetGroupId) {
        const messageText = message.message;
        console.log("📩 New message received from target group:");
        console.log("Message text:", messageText);

        const pumpString = extractPumpString(messageText);
        if (pumpString) {
          const logEntry = `
=================
${new Date().toISOString()}
Original Message: ${messageText}
Extracted Pump String: ${pumpString}
Message ID: ${message.id}
=================\n`;
          fs.appendFileSync("pump_strings.log", logEntry);
          // Send detected message to the bot
          await sendMessageToBot(pumpString);
          console.log("✅ Pump string logged successfully");
        }
      } else {
        console.log(
          "Message received from non-target group. IDs don't match:",
          `Received=${receivedGroupId}, Target=${targetGroupId}`
        );
      }
    } catch (error) {
      console.error("❌ Error processing message:", error.stack);
    }
  }, new NewMessage({}));

  // Keep the process running
  await new Promise(() => {});
})();

app.get("/", (req, res) => {
  res.send("Welcome to our server!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
