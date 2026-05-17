import { Hono } from "hono";

const app = new Hono<{ Variables: { userId: string } }>();

app.get("/", (c) => {
  // TODO: implement in #5
  return c.json({ message: "not implemented" }, 501);
});

export default app;
