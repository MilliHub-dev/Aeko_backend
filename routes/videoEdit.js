import express from 'express';
import multer from 'multer';
import { editVideo } from '../controllers/videoEditController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/edit', upload.single('video'), editVideo);

export default router;