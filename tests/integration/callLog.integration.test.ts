import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
import CallLog from '../../src/models/CallLog';
import { CallStatus } from '../../src/enums/CallStatus.enum';

const app = require('../../src/app');

// Setup in-memory DB
setupTestDB();

describe('Call Log Integration Tests', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    // 1. Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'User One', email: 'user1@test.com', password: 'Password123!', phone: '+94771000001',
    });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // 2. Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'User Two', email: 'user2@test.com', password: 'Password123!', phone: '+94771000002',
    });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  describe('GET /api/call-logs', () => {
    it('should retrieve history mapping correctly for incoming and outgoing calls', async () => {
      // Create a Missed Incoming call for user 1 (Caller = User 2)
      await CallLog.create({
        caller: user2Id,
        receiver: user1Id,
        status: CallStatus.MISSED,
        startedAt: new Date(),
        isSeen: false
      });

      // Create an Outgoing Answered call for user 1 (Caller = User 1)
      await CallLog.create({
        caller: user1Id,
        receiver: user2Id,
        status: CallStatus.ENDED,
        startedAt: new Date(),
        answeredAt: new Date(),
        endedAt: new Date(),
        duration: 120,
        isSeen: true
      });

      const response = await request(app)
        .get('/api/call-logs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);

      // Verify the mapping matches the DTO
      const incomingMissed = response.body.find((log: any) => log.direction === 'INCOMING');
      const outgoingEnded = response.body.find((log: any) => log.direction === 'OUTGOING');

      expect(incomingMissed.status).toBe(CallStatus.MISSED);
      expect(incomingMissed.caller.userId).toBe(user2Id);
      expect(incomingMissed.receiver.userId).toBe(user1Id);

      expect(outgoingEnded.status).toBe(CallStatus.ENDED);
      expect(outgoingEnded.duration).toBe(120);
    });
  });

  describe('PUT /api/call-logs/seen', () => {
    it('should mark all missed calls as seen for the user', async () => {
      // Create 2 unseen missed calls for user 1
      await CallLog.create({ caller: user2Id, receiver: user1Id, status: CallStatus.MISSED, isSeen: false });
      await CallLog.create({ caller: user2Id, receiver: user1Id, status: CallStatus.MISSED, isSeen: false });
      
      const response = await request(app)
        .put('/api/call-logs/seen')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);

      // Verify DB
      const logs = await CallLog.find({ receiver: user1Id });
      expect(logs.length).toBe(2);
      expect(logs[0].isSeen).toBe(true);
      expect(logs[1].isSeen).toBe(true);
    });
  });

  describe('DELETE /api/call-logs/:id', () => {
    it('should delete a specific call log', async () => {
      const log = await CallLog.create({ caller: user1Id, receiver: user2Id, status: CallStatus.MISSED });

      const response = await request(app)
        .delete(`/api/call-logs/${log._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);

      const dbLog = await CallLog.findById(log._id);
      expect(dbLog).toBeNull();
    });

    it('should return 404 if log does not exist or does not belong to user', async () => {
      // User 2 deletes User 1's log (where User 2 is not a participant, wait, User 2 IS a participant above)
      // Let's create a log for user 1 and a non-existent user
      const log = await CallLog.create({ caller: user1Id, receiver: user1Id, status: CallStatus.MISSED });
      
      const response = await request(app)
        .delete(`/api/call-logs/${log._id}`)
        .set('Authorization', `Bearer ${user2Token}`); // User 2 trying to delete User 1's log

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/call-logs', () => {
    it('should clear all history for the user', async () => {
      await CallLog.create({ caller: user1Id, receiver: user2Id, status: CallStatus.MISSED });
      await CallLog.create({ caller: user2Id, receiver: user1Id, status: CallStatus.ENDED });
      
      // User 2's distinct log
      await CallLog.create({ caller: user2Id, receiver: user2Id, status: CallStatus.MISSED });

      const response = await request(app)
        .delete('/api/call-logs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);

      // User 1 logs should be deleted
      const user1Logs = await CallLog.find({ $or: [{ caller: user1Id }, { receiver: user1Id }] });
      expect(user1Logs.length).toBe(0);

      // User 2's distinct log should remain
      const user2Logs = await CallLog.find({ caller: user2Id, receiver: user2Id });
      expect(user2Logs.length).toBe(1);
    });
  });
});
