import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/errors/handler";
import { calendarDateToDate } from "../../utils/calendar-date";
import { timeBlockService } from "./timeblocks.service";
import type { CreateTimeBlockDto, UpdateTimeBlockDto, UpdateTimeBlockSettingsDto } from "./timeblocks.validator";

type IdParams = { id: string };
type ExceptionIdParams = { id: string; exceptionId: string };

function userId(req: Request) {
  if (!req.user) throw new AppError("UNAUTHORIZED");
  return req.user.id;
}

export class TimeBlockController {
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.getSettings(userId(req))); } catch (error) { next(error); }
  };

  updateSettings = async (req: Request<{}, {}, UpdateTimeBlockSettingsDto>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.updateSettings(userId(req), req.body)); } catch (error) { next(error); }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.list(userId(req))); } catch (error) { next(error); }
  };

  active = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.activeNow(userId(req))); } catch (error) { next(error); }
  };

  today = async (req: Request, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.today(userId(req))); } catch (error) { next(error); }
  };

  create = async (req: Request<{}, {}, CreateTimeBlockDto>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.create(userId(req), req.body), 201); } catch (error) { next(error); }
  };

  update = async (req: Request<IdParams, {}, UpdateTimeBlockDto>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.update(userId(req), req.params.id, req.body)); } catch (error) { next(error); }
  };

  delete = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.delete(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  exception = async (req: Request<IdParams, {}, import("./timeblocks.validator").CreateTimeBlockExceptionDto>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.createException(userId(req), req.params.id, req.body)); } catch (error) { next(error); }
  };

  listExceptions = async (req: Request<IdParams>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.listExceptions(userId(req), req.params.id)); } catch (error) { next(error); }
  };

  listAllExceptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = typeof req.query.from === "string" ? calendarDateToDate(req.query.from) : undefined;
      const to = typeof req.query.to === "string" ? calendarDateToDate(req.query.to) : undefined;
      res.success(await timeBlockService.listAllExceptions(userId(req), from, to));
    } catch (error) { next(error); }
  };

  deleteException = async (req: Request<ExceptionIdParams>, res: Response, next: NextFunction) => {
    try { res.success(await timeBlockService.deleteException(userId(req), req.params.id, req.params.exceptionId)); } catch (error) { next(error); }
  };
}
