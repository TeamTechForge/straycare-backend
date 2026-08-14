// tests/helpers/mockRequestResponse.ts
import { Request, Response, NextFunction } from 'express';

export const mockRequest = (data: Partial<Request> = {}): Partial<Request> => {
  return {
    ...data,
  };
};

export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = (): NextFunction => jest.fn();
