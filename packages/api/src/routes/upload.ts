import { Hono } from "hono";

const app = new Hono<{ Variables: { userId: string } }>();

app.post("/", async (c) => {
  // TODO: implement in #4
  return c.json({ message: "not implemented" }, 501);
});

export default app;
