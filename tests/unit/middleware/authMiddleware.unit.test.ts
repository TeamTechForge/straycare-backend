import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { mockRequest, mockResponse, mockNext } from '../../helpers/mockRequestResponse';
import authMiddleware from '../../../src/middleware/authMiddleware';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext() as jest.Mock;
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should return 401 if no authorization header is provided', () => {
    req.headers = {};

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', () => {
    req.headers = { authorization: 'Basic some-token' };

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    authMiddleware(req as Request, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith('invalid-token', 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and set req.user if token is valid', () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const decodedPayload = { id: 'user123', role: 'general_user' };
    (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);

    authMiddleware(req as Request, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual({ id: 'user123', role: 'general_user' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
