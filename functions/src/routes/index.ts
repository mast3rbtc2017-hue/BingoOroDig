import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import gamesRouter from "./games";
import cardsRouter from "./cards";
import chatRouter from "./chat";
import transactionsRouter from "./transactions";
import statsRouter from "./stats";
import rouletteRouter from "./roulette";
import notificationsRouter from "./notifications";
import rafflesRouter from "./raffles";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(gamesRouter);
router.use(cardsRouter);
router.use(chatRouter);
router.use(transactionsRouter);
router.use(statsRouter);
router.use(rouletteRouter);
router.use(notificationsRouter);
router.use(rafflesRouter);

export default router;
