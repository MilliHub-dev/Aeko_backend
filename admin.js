import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSMongoose from "@adminjs/mongoose";
import express from "express";
import mongoose from "mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import Status from "./models/Status.js";
import Debate from "./models/Debate.js";
import Ad from "./models/Ad.js";

AdminJS.registerAdapter(AdminJSMongoose);

const admin = new AdminJS({
  resources: [
    { resource: User, options: { properties: { password: { isVisible: false } } } },
    { resource: Post },
    { resource: Status },
    { resource: Debate },
    { resource: Ad },
  ],
  rootPath: "/admin",
});

const adminRouter = AdminJSExpress.buildRouter(admin);
export { admin, adminRouter };
