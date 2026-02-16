/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         email:
 *           type: string
 *           description: The user email
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the user was added
 *     Table:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the table
 *         name:
 *           type: string
 *           description: The name of the table
 *         capacity:
 *           type: integer
 *           description: The capacity of the table
 *         type:
 *           type: string
 *           enum: [RECTANGULAR, ROUND, HIGH]
 *           description: The type of the table
 *         x:
 *           type: number
 *           description: X coordinate for floor plan
 *         y:
 *           type: number
 *           description: Y coordinate for floor plan
 *     Booking:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the booking
 *         name:
 *           type: string
 *           description: Name of the person who booked
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         email:
 *           type: string
 *           description: Contact email
 *         size:
 *           type: integer
 *           description: Number of people
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: Start time of the reservation
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: End time of the reservation
 *         status:
 *           type: string
 *           enum: [CONFIRMED, CANCELLED, COMPLETED, NO_SHOW]
 *           description: Status of the booking
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
export {};