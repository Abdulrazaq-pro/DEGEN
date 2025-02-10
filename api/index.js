require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const fs = require("fs");

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
  const words = message.split(/[\s,.\-_!?]+/);
  console.log("📝 Words found:", words);

  for (const word of words) {
    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord.includes("pump")) {
      console.log("🎯 Found pump string:", word);
      return word;
    }
  }
  console.log("❌ No pump string found in message");
  return null;
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
