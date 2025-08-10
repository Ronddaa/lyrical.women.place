import { Router } from "express";

import unifiedusersRouter from "./unifiedusers.js";

const router = Router();

router.use("/unifiedusers", unifiedusersRouter);

export default router;
