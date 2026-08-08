"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockNext = exports.mockResponse = exports.mockRequest = void 0;
const mockRequest = (data = {}) => {
    return {
        ...data,
    };
};
exports.mockRequest = mockRequest;
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};
exports.mockResponse = mockResponse;
const mockNext = () => jest.fn();
exports.mockNext = mockNext;
//# sourceMappingURL=mockRequestResponse.js.map