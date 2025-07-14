import express from 'express';
import multer from 'multer';
import { editPhoto } from '../controllers/photoEditController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/edit', upload.single('photo'), editPhoto);

export default router;