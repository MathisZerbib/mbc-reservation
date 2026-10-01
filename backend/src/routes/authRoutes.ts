import { Router } from 'express';
import { authController } from '../controllers/authController';
import { isAuthenticated } from '../middleware/isAuthenticated';
import { loginLimiter, registerLimiter, resendLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request
 */
router.post('/register', registerLimiter, authController.register);

router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', resendLimiter, authController.resendVerification);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @swagger
 * /auth/demo:
 *   post:
 *     summary: Log in with the shared demo account
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Demo login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 */
router.post('/demo', authController.demoLogin);

/**
 * @swagger
 * /auth/refreshToken:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Unauthorized
 */
router.post('/refreshToken', authController.refreshToken);

router.post('/revokeRefreshTokens', isAuthenticated, authController.revokeRefreshTokens);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Current user (email + role for UI gating)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Unauthorized
 */
router.get('/me', isAuthenticated, authController.me);

export default router;