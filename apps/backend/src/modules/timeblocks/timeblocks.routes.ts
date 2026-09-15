import { Router } from "express";
import { requireAuth, requireScopes } from "../../middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate.middleware";
import { TimeBlockController } from "./timeblocks.controller";
import { createTimeBlockSchema, idParamSchema, updateTimeBlockSchema, updateTimeBlockSettingsSchema, createTimeBlockExceptionSchema, exceptionIdParamSchema, timeBlockExceptionRangeSchema } from "./timeblocks.validator";

const router = Router();
const controller = new TimeBlockController();

router.use(requireAuth);
router.get("/settings", requireScopes("timeblocks:read"), controller.getSettings);
router.patch("/settings", requireScopes("timeblocks:write"), validateBody(updateTimeBlockSettingsSchema), controller.updateSettings);
router.get("/", requireScopes("timeblocks:read"), controller.list);
router.get("/active", requireScopes("timeblocks:read"), controller.active);
router.get("/today", requireScopes("timeblocks:read"), controller.today);
router.get("/exceptions", requireScopes("timeblocks:read"), validateQuery(timeBlockExceptionRangeSchema), controller.listAllExceptions);
router.post("/", requireScopes("timeblocks:write"), validateBody(createTimeBlockSchema), controller.create);
router.patch("/:id", requireScopes("timeblocks:write"), validateParams(idParamSchema), validateBody(updateTimeBlockSchema), controller.update);
router.delete("/:id", requireScopes("timeblocks:write"), validateParams(idParamSchema), controller.delete);
router.post("/:id/exception", requireScopes("timeblocks:write"), validateParams(idParamSchema), validateBody(createTimeBlockExceptionSchema), controller.exception);
router.get("/:id/exceptions", requireScopes("timeblocks:read"), validateParams(idParamSchema), controller.listExceptions);
router.delete("/:id/exceptions/:exceptionId", requireScopes("timeblocks:write"), validateParams(exceptionIdParamSchema), controller.deleteException);

export default router;
