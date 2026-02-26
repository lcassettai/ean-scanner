"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddScansDto = exports.CreateSessionDto = exports.ScanItemDto = void 0;
class ScanItemDto {
    ean;
    quantity;
}
exports.ScanItemDto = ScanItemDto;
class CreateSessionDto {
    name;
    type;
    scans;
}
exports.CreateSessionDto = CreateSessionDto;
class AddScansDto {
    scans;
}
exports.AddScansDto = AddScansDto;
//# sourceMappingURL=create-session.dto.js.map