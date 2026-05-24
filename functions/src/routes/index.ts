import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import roomsRouter from "./rooms";
import gamesRouter from "./games";
import cardsRouter from "./cards";
import chatRouter from "./chat";
import transactionsRouter from "./transactions";
import statsRouter from "./stats";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(roomsRouter);
router.use(gamesRouter);
router.use(cardsRouter);
router.use(chatRouter);
router.use(transactionsRouter);
router.use(statsRouter);

export default router;
