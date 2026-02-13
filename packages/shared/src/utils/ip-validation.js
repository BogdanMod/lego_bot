"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIPv4 = isIPv4;
exports.isIPv6 = isIPv6;
exports.isIP = isIP;
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_HEX_REGEX = /^[0-9a-f:]+$/i;
function isIPv4(value) {
    if (!IPV4_REGEX.test(value)) {
        return false;
    }
    const parts = value.split('.').map((part) => Number(part));
    return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
}
function isIPv6(value) {
    if (!value || !IPV6_HEX_REGEX.test(value) || !value.includes(':')) {
        return false;
    }
    const sections = value.split('::');
    if (sections.length > 2) {
        return false;
    }
    const leftParts = sections[0] ? sections[0].split(':') : [];
    const rightParts = sections[1] ? sections[1].split(':') : [];
    const parts = [...leftParts, ...rightParts].filter((part) => part.length > 0);
    if (sections.length === 1 && parts.length !== 8) {
        return false;
    }
    if (sections.length === 2 && parts.length >= 8) {
        return false;
    }
    return parts.every((part) => part.length <= 4 && /^[0-9a-f]{1,4}$/i.test(part));
}
function isIP(value) {
    if (isIPv4(value)) {
        return 4;
    }
    if (isIPv6(value)) {
        return 6;
    }
    return 0;
}
//# sourceMappingURL=ip-validation.js.map