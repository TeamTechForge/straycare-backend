import { mockRequest, mockResponse, mockNext } from '../../helpers/mockRequestResponse';

// Mock catchAsync to return the raw async function so we can await it in tests
jest.mock('../../../src/utils/catchAsync', () => ({
  catchAsync: (fn: any) => fn,
}));

const { search } = require('../../../src/controllers/searchController');
const NGOProfile = require('../../../src/models/NGOProfile');
const VetProfile = require('../../../src/models/VetProfile');

jest.mock('../../../src/models/NGOProfile');
jest.mock('../../../src/models/VetProfile');

describe('Search Controller Unit Tests', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  it('should return empty array if query is missing', async () => {
    req.query = {};
    await search(req, res, next);
    expect(res.json).toHaveBeenCalledWith([]);
    expect(NGOProfile.aggregate).not.toHaveBeenCalled();
    expect(VetProfile.aggregate).not.toHaveBeenCalled();
  });

  it('should return empty array if query is only whitespace (invalid query)', async () => {
    req.query = { q: '   ' };
    await search(req, res, next);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should return empty array if database yields no results', async () => {
    req.query = { q: 'unknown' };
    NGOProfile.aggregate.mockResolvedValue([]);
    VetProfile.aggregate.mockResolvedValue([]);

    await search(req, res, next);

    expect(NGOProfile.aggregate).toHaveBeenCalled();
    expect(VetProfile.aggregate).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should return NGO results correctly', async () => {
    req.query = { q: 'shelter' };
    const mockNgo = { name: 'Happy Shelter', type: 'Animal Shelter' };
    NGOProfile.aggregate.mockResolvedValue([mockNgo]);
    VetProfile.aggregate.mockResolvedValue([]);

    await search(req, res, next);

    expect(res.json).toHaveBeenCalledWith([mockNgo]);
  });

  it('should return Vet results correctly', async () => {
    req.query = { q: 'dr smith' };
    const mockVet = { name: 'Dr. Smith', type: 'Veterinarian' };
    NGOProfile.aggregate.mockResolvedValue([]);
    VetProfile.aggregate.mockResolvedValue([mockVet]);

    await search(req, res, next);

    expect(res.json).toHaveBeenCalledWith([mockVet]);
  });

  it('should combine and sort mixed results correctly', async () => {
    req.query = { q: 'care' };
    // "care" is at the start for A, in the middle for B
    const mockNgo = { name: 'Animal Care NGO' }; // substring match (starts with 'animal')
    const mockVet = { name: 'Care Vet Clinic' }; // exact start match

    NGOProfile.aggregate.mockResolvedValue([mockNgo]);
    VetProfile.aggregate.mockResolvedValue([mockVet]);

    await search(req, res, next);

    // Sorting logic prioritizes items starting with the query, then substring matches.
    // So 'Care Vet Clinic' should appear before 'Animal Care NGO'.
    expect(res.json).toHaveBeenCalledWith([mockVet, mockNgo]);
  });

  it('should pass errors to next() if a database failure occurs', async () => {
    req.query = { q: 'error' };
    const dbError = new Error('Database connection lost');
    NGOProfile.aggregate.mockRejectedValue(dbError);

    await expect(search(req, res, next)).rejects.toThrow('Database connection lost');
  });
});
