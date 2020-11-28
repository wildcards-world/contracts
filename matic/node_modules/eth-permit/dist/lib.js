"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexToUtf8 = void 0;
const utf8_1 = __importDefault(require("utf8"));
exports.hexToUtf8 = function (hex) {
    // if (!isHexStrict(hex))
    //     throw new Error('The parameter "'+ hex +'" must be a valid HEX string.');
    let str = "";
    let code = 0;
    hex = hex.replace(/^0x/i, '');
    // remove 00 padding from either side
    hex = hex.replace(/^(?:00)*/, '');
    hex = hex.split("").reverse().join("");
    hex = hex.replace(/^(?:00)*/, '');
    hex = hex.split("").reverse().join("");
    let l = hex.length;
    for (let i = 0; i < l; i += 2) {
        code = parseInt(hex.substr(i, 2), 16);
        // if (code !== 0) {
        str += String.fromCharCode(code);
        // }
    }
    return utf8_1.default.decode(str);
};
