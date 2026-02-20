import { Router } from 'express';
import { tableController } from '../controllers/tableController';

const router = Router();

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
 *     summary: Retrieve a list of tables
 *     tags: [Tables]
 *     responses:
 *       200:
 *         description: A list of tables
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Table'
 */
router.get('/tables', tableController.getAllTables);

export default router;
