import dotenv from "dotenv";
import { validateAuthConfiguration } from "../utils/authConfig.js";

dotenv.config();
validateAuthConfiguration();
