import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MBC Reservation API',
      version: '1.0.0',
      description: 'API documentation for the MBC Reservation System',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Local server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/docs/definitions.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);