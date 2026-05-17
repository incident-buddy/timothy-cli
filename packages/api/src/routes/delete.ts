import { Hono } from "hono";

const app = new Hono<{ Variables: { userId: string } }>();

app.delete("/:id", async (c) => {
  // TODO: implement in #6
  return c.json({ message: "not implemented" }, 501);
});

export default app;
