import { handle } from "hono/aws-lambda";
import app from "./index.js";

export const handler = handle(app);
