import { Router } from "express";
import { attachSessionId, requireAuth } from "../../middlewares/auth.middleware";
import { clearPresenceOnLogout } from "../../middlewares/presence.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import { AuthController } from "./auth.controller";
import { loginRateLimit } from "./login-rate-limit.middleware";
import { changePasswordSchema, loginSchema, registerSchema } from "./auth.validator";
import patRoutes from "./pat.routes";

const router = Router();
const controller = new AuthController();

router.post("/login", validateBody(loginSchema), loginRateLimit, controller.login);
router.post("/register", validateBody(registerSchema), controller.register);
router.post("/refresh", controller.refresh);
router.get("/config", controller.config);
router.get("/me", requireAuth, controller.me);
router.post("/logout", clearPresenceOnLogout, controller.logout);
router.patch("/password", requireAuth, attachSessionId, validateBody(changePasswordSchema), controller.changePassword);
router.use("/pat", patRoutes);

export default router;
