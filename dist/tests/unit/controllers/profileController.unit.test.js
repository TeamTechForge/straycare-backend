"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockRequestResponse_1 = require("../../helpers/mockRequestResponse");
// Mock catchAsync so it returns the raw async function which we can await in our tests
jest.mock('../../../src/utils/catchAsync', () => ({
    catchAsync: (fn) => fn,
}));
const { createGeneralProfile, createVolunteerProfile, getMyProfile, } = require('../../../src/controllers/profileController');
const GeneralUserProfile = require('../../../src/models/GeneralUserProfile');
const VolunteerProfile = require('../../../src/models/VolunteerProfile');
const User = require('../../../src/models/User');
const Rescuer = require('../../../src/models/Rescuer');
jest.mock('../../../src/models/GeneralUserProfile');
jest.mock('../../../src/models/VolunteerProfile');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Rescuer');
describe('Profile Controller', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = (0, mockRequestResponse_1.mockRequest)();
        res = (0, mockRequestResponse_1.mockResponse)();
        next = (0, mockRequestResponse_1.mockNext)();
        jest.clearAllMocks();
        req.user = { id: 'user123', role: 'general_user' };
    });
    describe('createGeneralProfile', () => {
        it('should create a general profile and update user successfully', async () => {
            req.body = { location: 'Colombo', bio: 'Hello', profileImage: 'img.png', name: 'John Doe' };
            GeneralUserProfile.findOneAndUpdate.mockResolvedValue({
                profileImage: 'img.png',
            });
            User.findByIdAndUpdate.mockResolvedValue(true);
            await createGeneralProfile(req, res, next);
            expect(GeneralUserProfile.findOneAndUpdate).toHaveBeenCalledWith({ userId: 'user123' }, { location: 'Colombo', bio: 'Hello', profileImage: 'img.png' }, { new: true, upsert: true, runValidators: true });
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
                name: 'John Doe',
                profileCompleted: true,
                profileImage: 'img.png',
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'General profile created' }));
        });
    });
    describe('createVolunteerProfile', () => {
        it('should create a volunteer profile and update both User and Rescuer', async () => {
            req.user.role = 'volunteer';
            req.body = { location: 'Kandy', bio: 'Helper', profileImage: 'vol.png', name: 'Jane', latitude: 7.29, longitude: 80.63 };
            VolunteerProfile.findOneAndUpdate.mockResolvedValue({ profileImage: 'vol.png' });
            User.findByIdAndUpdate.mockResolvedValue(true);
            User.findById.mockResolvedValue({ _id: 'user123', name: 'Jane', phone: '0771234567' });
            Rescuer.findOneAndUpdate.mockResolvedValue(true);
            await createVolunteerProfile(req, res, next);
            expect(VolunteerProfile.findOneAndUpdate).toHaveBeenCalled();
            expect(User.findByIdAndUpdate).toHaveBeenCalled();
            expect(User.findById).toHaveBeenCalledWith('user123');
            expect(Rescuer.findOneAndUpdate).toHaveBeenCalledWith({ userId: 'user123' }, {
                userId: 'user123',
                name: 'Jane',
                phone: '0771234567',
                avatar: 'vol.png',
                isAvailable: true,
                location: { latitude: 7.29, longitude: 80.63 },
            }, { upsert: true, new: true });
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });
    describe('getMyProfile', () => {
        it('should fetch the profile for a general_user', async () => {
            req.user.role = 'general_user';
            const mockProfile = { bio: 'General' };
            GeneralUserProfile.findOne.mockResolvedValue(mockProfile);
            await getMyProfile(req, res, next);
            expect(GeneralUserProfile.findOne).toHaveBeenCalledWith({ userId: 'user123' });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockProfile);
        });
        it('should return 404 if profile does not exist', async () => {
            GeneralUserProfile.findOne.mockResolvedValue(null);
            await getMyProfile(req, res, next);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Profile not found' });
        });
    });
});
//# sourceMappingURL=profileController.unit.test.js.map