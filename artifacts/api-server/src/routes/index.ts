import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./auth";
import { sessionsRouter } from "./sessions";
import { statsRouter } from "./stats";
import { tasksRouter } from "./tasks";
import { adminRouter } from "./admin";
import { aiRouter } from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(statsRouter);
router.use(tasksRouter);
router.use(adminRouter);
router.use(aiRouter);

export default router;
