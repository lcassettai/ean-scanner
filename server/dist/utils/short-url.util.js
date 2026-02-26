"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShortCode = generateShortCode;
exports.generateAccessCode = generateAccessCode;
const crypto_1 = require("crypto");
function generateShortCode() {
    return (0, crypto_1.randomBytes)(3).toString('hex');
}
function generateAccessCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
//# sourceMappingURL=short-url.util.js.map