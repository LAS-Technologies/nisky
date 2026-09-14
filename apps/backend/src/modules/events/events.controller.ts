import type { Request, Response, NextFunction } from "express";
import { eventsService } from "./events.service";
import { parseEventDate } from "./events.util";

export class EventsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const fromDate = parseEventDate(req.query.from as string);
      const toDate = parseEventDate(req.query.to as string);
      const events = await eventsService.list(req.user!.id, fromDate, toDate);
      res.success(events);
    } catch (error) {
      next(error);
    }
  }

  async today(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await eventsService.today(req.user!.id);
      res.success(events);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.create(req.user!.id, req.body);
      res.status(201).success(event);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.update(req.user!.id, req.params.id as string, req.body);
      res.success(event);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await eventsService.delete(req.user!.id, req.params.id as string);
      res.success({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async listExceptions(req: Request, res: Response, next: NextFunction) {
    try {
      const exceptions = await eventsService.listExceptions(req.user!.id, req.params.id as string);
      res.success(exceptions);
    } catch (error) {
      next(error);
    }
  }

  async createException(req: Request, res: Response, next: NextFunction) {
    try {
      const exception = await eventsService.createException(req.user!.id, req.params.id as string, req.body);
      res.status(201).success(exception);
    } catch (error) {
      next(error);
    }
  }

  async deleteException(req: Request, res: Response, next: NextFunction) {
    try {
      await eventsService.deleteException(req.user!.id, req.params.id as string, req.params.exceptionId as string);
      res.success({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const eventsController = new EventsController();
