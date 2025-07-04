import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerConfig = {
    openapi: "3.0.0",
    info: {
        title: "Aeko API",
        version: "1.0.0",
        description: "API documentation for Aeko",
    },
    paths: {},
};

// Define Swagger options
const options = {
    definition: swaggerConfig,
    apis: ["./routes/*.js"], // Adjust path if needed
};

// Generate Swagger specification
const swaggerSpec = swaggerJSDoc(options);

// Export a function that sets up Swagger
const setupSwagger = (app) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

export default setupSwagger; // ✅ Correct ES Module export
