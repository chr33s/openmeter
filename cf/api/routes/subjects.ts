// Subjects API routes (placeholder implementation)

import { Hono } from "hono";
import type { Env } from "#/types";

const app = new Hono<{ Bindings: Env }>();

// Placeholder implementations for subjects
app.get("/", async (c) => {
	return c.json({
		message: "Subjects API - Implementation in progress",
		endpoints: {
			list: "GET /",
			get: "GET /:id",
			create: "POST /",
			update: "PUT /:id",
			delete: "DELETE /:id",
		},
	});
});

app.get("/:id", async (c) => {
	return c.json({ message: "Get subject - Not implemented yet" });
});

app.post("/", async (c) => {
	return c.json({ message: "Create subject - Not implemented yet" });
});

app.put("/:id", async (c) => {
	return c.json({ message: "Update subject - Not implemented yet" });
});

app.delete("/:id", async (c) => {
	return c.json({ message: "Delete subject - Not implemented yet" });
});

export default app;
