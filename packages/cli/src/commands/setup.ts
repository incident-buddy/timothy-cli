import { createInterface } from "readline";
import { Command } from "commander";
import { writeConfig } from "../lib/config.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const setupCommand = new Command("setup")
  .description("Save API key and endpoint to ~/.config/timothy/config.json")
  .action(async () => {
    const apiKey = await prompt("API key: ");
    const apiEndpoint = await prompt("API endpoint [https://api.timothy.example.com]: ");
    await writeConfig({
      apiKey,
      apiEndpoint: apiEndpoint || "https://api.timothy.example.com",
    });
    process.stdout.write("✓ Saved credentials\n");
  });
