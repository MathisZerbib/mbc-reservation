import { Router } from 'express';
import { Server } from 'socket.io';
import { tableController } from '../controllers/tableController';
import { isAuthenticated } from '../middleware/isAuthenticated';

export const tableRoutes = (io: Server) => {
    const router = Router();
    const controller = tableController(io);

    /**
     * @swagger
     * tags:
     *   name: Tables
     *   description: Table management
     */

    /**
     * @swagger
     * /tables:
     *   get:
     *     summary: Retrieve the full table layout (geometry + adjacency)
     *     tags: [Tables]
     *     responses:
     *       200:
     *         description: The table layout
     */
    router.get('/tables', controller.getAllTables);

    /**
     * @swagger
     * /tables/layout:
     *   put:
     *     summary: Replace the full table layout (geometry + manual adjacency)
     *     tags: [Tables]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: The saved table layout
     */
    router.put('/tables/layout', isAuthenticated, controller.saveLayout);
    router.delete('/tables/:id', isAuthenticated, controller.deleteTable);

    return router;
};
