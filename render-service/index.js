import "dotenv/config";
import Fastify from "fastify";

const fastify = Fastify({ logger: true });

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error("ERROR: API_KEY environment variable is required");
    process.exit(1);
}

// Auth hook - validates API key on every request
fastify.addHook("preHandler", async (request, reply) => {
    // Skip auth for health check
    if (request.url === "/health") return;

    const apiKey = request.headers["x-api-key"];

    if (apiKey !== API_KEY) {
        reply.status(401).send({ error: "Unauthorized: Invalid API key" });
        return;
    }
});

// Health check endpoint (public)
fastify.get("/health", async () => ({ status: "ok" }));

// POST endpoint with body
fastify.post("/render", async (request, reply) => {
    const { id } = request.body || {};
    if (!id) {
        return reply.status(400).send({ error: 'Missing "id" in request body' });
    }
    return { message: `Rendering video for id ${id}` };
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: "0.0.0.0" });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
