import multer from "multer";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith("image")) {
            cb(null, "uploads/images/");
        } else if (file.mimetype.startsWith("video")) {
            cb(null, "uploads/videos/");
        } else {
            cb(new Error("Unsupported file format"), false);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

export default upload;  // ✅ Correct for ES Modules
