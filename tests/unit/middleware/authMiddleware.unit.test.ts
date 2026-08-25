import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { mockRequest, mockResponse, mockNext } from '../../helpers/mockRequestResponse';
const { verifyToken: authMiddleware } = require('../../../src/middleware/authMiddleware');

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

jest.mock('../../../src/models/User', () => ({
  findById: jest.fn()
}));
const User = require('../../../src/models/User');
import mongoose from 'mongoose';

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

  it('should call next and set req.user if token is valid', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const validUserId = new mongoose.Types.ObjectId().toString();
    const decodedPayload = { id: validUserId, role: 'general_user' };
    (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);
    
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: validUserId, isDeleted: false })
    });

    await authMiddleware(req as Request, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect((req as any).user).toEqual({ id: validUserId, role: 'general_user' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
