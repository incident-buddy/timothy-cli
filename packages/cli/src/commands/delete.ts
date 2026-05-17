import { Command } from "commander";
import { apiDelete } from "../lib/api.js";
import { readConfig } from "../lib/config.js";

export const deleteCommand = new Command("delete")
  .description("Delete an uploaded file by ID")
  .argument("<id>", "File ID to delete")
  .action(async (id: string) => {
    const config = await readConfig();
    if (!config.apiKey || !config.apiEndpoint) {
      process.stderr.write("Error: run `tim setup` first\n");
      process.exit(1);
    }

    await apiDelete(id, config as Required<typeof config>);
    process.stdout.write(`✓ Deleted ${id}\n`);
  });
