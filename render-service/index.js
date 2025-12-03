const fastify = require("fastify")({ logger: true });

// GET endpoint with query parameter
fastify.get("/greet", async (request, reply) => {
    const { name } = request.query;
    if (!name) {
        return reply.status(400).send({ error: 'Missing "name" query parameter' });
    }
    return { message: `Hallo ${name}` };
});

// POST endpoint with body
fastify.post("/greet", async (request, reply) => {
    const { name } = request.body || {};
    if (!name) {
        return reply.status(400).send({ error: 'Missing "name" in request body' });
    }
    return { message: `Hallo ${name}` };
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
