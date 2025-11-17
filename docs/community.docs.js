/**
 * @swagger
 * tags:
 *   name: Communities
 *   description: Community management and interaction
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Community:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The community ID
 *         name:
 *           type: string
 *           description: The community name
 *         description:
 *           type: string
 *           description: Community description
 *         profile:
 *           type: object
 *           properties:
 *             avatar:
 *               type: string
 *               description: URL to community avatar
 *             coverPhoto:
 *               type: string
 *               description: URL to community cover photo
 *             website:
 *               type: string
 *               description: Community website URL
 *             location:
 *               type: string
 *               description: Community location
 *         owner:
 *           type: string
 *           description: ID of the community owner
 *         moderators:
 *           type: array
 *           items:
 *             type: string
 *           description: List of moderator user IDs
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 description: User ID
 *               joinedAt:
 *                 type: string
 *                 format: date-time
 *               role:
 *                 type: string
 *                 enum: [member, moderator]
 *         settings:
 *           type: object
 *           properties:
 *             isPrivate:
 *               type: boolean
 *               default: false
 *             requireApproval:
 *               type: boolean
 *               default: false
 *             canPost:
 *               type: boolean
 *               default: true
 *             canComment:
 *               type: boolean
 *               default: true
 *             payment:
 *               type: object
 *               properties:
 *                 isPaidCommunity:
 *                   type: boolean
 *                   default: false
 *                 price:
 *                   type: number
 *                   default: 0
 *                 currency:
 *                   type: string
 *                   default: USD
 *                 subscriptionType:
 *                   type: string
 *                   enum: [one_time, monthly, yearly]
 *                   default: one_time
 *                 paymentAddress:
 *                   type: string
 *             postSettings:
 *               type: object
 *               properties:
 *                 allowImages:
 *                   type: boolean
 *                   default: true
 *                 allowVideos:
 *                   type: boolean
 *                   default: true
 *                 allowLinks:
 *                   type: boolean
 *                   default: true
 *                 requireApproval:
 *                   type: boolean
 *                   default: false
 *         memberCount:
 *           type: number
 *           description: Number of community members
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     CommunityPost:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The post ID
 *         content:
 *           type: string
 *           description: Post content
 *         author:
 *           $ref: '#/components/schemas/User'
 *         community:
 *           $ref: '#/components/schemas/Community'
 *         media:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url: 
 *                 type: string
 *               type: 
 *                 type: string
 *                 enum: [image, video, file]
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of user IDs who liked the post
 *         comments:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of comment IDs
 *         shares:
 *           type: number
 *           default: 0
 *         status:
 *           type: string
 *           enum: [pending, active, archived]
 *           default: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/communities:
 *   post:
 *     summary: Create a new community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Community created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Community'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: User doesn't have permission to create a community
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/communities:
 *   get:
 *     summary: Get all communities
 *     tags: [Communities]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for community name or description
 *     responses:
 *       200:
 *         description: List of communities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Community'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */

/**
 * @swagger
 * /api/communities/{id}:
 *   get:
 *     summary: Get community by ID
 *     tags: [Communities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Community details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Community'
 *       404:
 *         description: Community not found
 *       403:
 *         description: Not authorized to view this community (if private)
 */

/**
 * @swagger
 * /api/communities/{id}/profile:
 *   put:
 *     summary: Update community profile
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               website:
 *                 type: string
 *                 format: uri
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Community profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Community'
 *       403:
 *         description: Not authorized to update this community
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/upload-photo:
 *   post:
 *     summary: Upload community avatar or cover photo
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatar, cover]
 *         description: Type of photo to upload
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatar:
 *                       type: string
 *                     coverPhoto:
 *                       type: string
 *       400:
 *         description: No file uploaded or invalid file type
 *       403:
 *         description: Not authorized to update this community
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/settings:
 *   put:
 *     summary: Update community settings
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 properties:
 *                   isPrivate:
 *                     type: boolean
 *                   requireApproval:
 *                     type: boolean
 *                   canPost:
 *                     type: boolean
 *                   canComment:
 *                     type: boolean
 *                   payment:
 *                     type: object
 *                     properties:
 *                       isPaidCommunity:
 *                         type: boolean
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       subscriptionType:
 *                         type: string
 *                         enum: [one_time, monthly, yearly]
 *                       paymentAddress:
 *                         type: string
 *                   postSettings:
 *                     type: object
 *                     properties:
 *                       allowImages:
 *                         type: boolean
 *                       allowVideos:
 *                         type: boolean
 *                       allowLinks:
 *                         type: boolean
 *                       requireApproval:
 *                         type: boolean
 *     responses:
 *       200:
 *         description: Community settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Community'
 *       403:
 *         description: Only community owner can update settings
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/join:
 *   post:
 *     summary: Join a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully joined the community
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 requiresApproval:
 *                   type: boolean
 *                   description: True if the community requires admin approval
 *       400:
 *         description: Already a member of this community
 *       403:
 *         description: Community is private and requires approval
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/leave:
 *   post:
 *     summary: Leave a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully left the community
 *       400:
 *         description: Not a member of this community
 *       403:
 *         description: Community owner cannot leave (must transfer ownership first)
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/follow:
 *   post:
 *     summary: Follow a community (without joining chat)
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully followed the community
 *       400:
 *         description: Already following this community or already a member
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/unfollow:
 *   post:
 *     summary: Unfollow a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Successfully unfollowed the community
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/posts:
 *   post:
 *     summary: Create a post in community
 *     tags: [Community Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Post content
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Media files (images, videos)
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       403:
 *         description: Not authorized to post in this community
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}/posts:
 *   get:
 *     summary: Get community posts
 *     tags: [Community Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of community posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommunityPost'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       403:
 *         description: Not authorized to view posts in this community
 *       404:
 *         description: Community not found
 */

/**
 * @swagger
 * /api/communities/{id}:
 *   delete:
 *     summary: Delete a community
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     responses:
 *       200:
 *         description: Community deleted successfully
 *       403:
 *         description: Only the community owner can delete the community
 *       404:
 *         description: Community not found
 */
