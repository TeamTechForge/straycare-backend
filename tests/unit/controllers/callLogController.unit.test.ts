import { mockRequest, mockResponse } from '../../helpers/mockRequestResponse';
import callLogController from '../../../src/controllers/callLogController';
import CallLogService from '../../../src/services/callLogService';
import { Logger } from '../../../src/utils/logger';

jest.mock('../../../src/services/callLogService');
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Call Log Controller Unit Tests', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe('getHistory', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      await callLogController.getHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should retrieve call history for the authenticated user', async () => {
      req.user = { id: 'user1' };
      const mockHistory = [{ _id: 'log1', status: 'MISSED' }];
      (CallLogService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

      await callLogController.getHistory(req, res);

      expect(CallLogService.getHistory).toHaveBeenCalledWith('user1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should handle errors and return 500', async () => {
      req.user = { id: 'user1' };
      (CallLogService.getHistory as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await callLogController.getHistory(req, res);

      expect(Logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  describe('deleteLog', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = {}; // Prevent Cannot read property 'id' of undefined
      await callLogController.deleteLog(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should delete a log successfully and return 200', async () => {
      req.user = { id: 'user1' };
      req.params = { id: 'log1' };
      (CallLogService.deleteLog as jest.Mock).mockResolvedValue(true);

      await callLogController.deleteLog(req, res);

      expect(CallLogService.deleteLog).toHaveBeenCalledWith('log1', 'user1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Log deleted successfully' });
    });

    it('should return 404 if log is not found or user unauthorized', async () => {
      req.user = { id: 'user1' };
      req.params = { id: 'log1' };
      (CallLogService.deleteLog as jest.Mock).mockResolvedValue(false);

      await callLogController.deleteLog(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Log not found or unauthorized' });
    });

    it('should handle errors and return 500', async () => {
      req.user = { id: 'user1' };
      req.params = { id: 'log1' };
      (CallLogService.deleteLog as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await callLogController.deleteLog(req, res);

      expect(Logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('clearHistory', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      await callLogController.clearHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should clear all history for the user and return 200', async () => {
      req.user = { id: 'user1' };
      (CallLogService.clearHistory as jest.Mock).mockResolvedValue(undefined);

      await callLogController.clearHistory(req, res);

      expect(CallLogService.clearHistory).toHaveBeenCalledWith('user1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'History cleared successfully' });
    });

    it('should handle errors and return 500', async () => {
      req.user = { id: 'user1' };
      (CallLogService.clearHistory as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await callLogController.clearHistory(req, res);

      expect(Logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markSeen', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      await callLogController.markSeen(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should mark all missed calls as seen and return 200', async () => {
      req.user = { id: 'user1' };
      (CallLogService.markSeen as jest.Mock).mockResolvedValue(undefined);

      await callLogController.markSeen(req, res);

      expect(CallLogService.markSeen).toHaveBeenCalledWith('user1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Marked as seen' });
    });

    it('should handle errors and return 500', async () => {
      req.user = { id: 'user1' };
      (CallLogService.markSeen as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await callLogController.markSeen(req, res);

      expect(Logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
