"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiverOpCodes = exports.TransmitterOpCodes = void 0;
var TransmitterOpCodes;
(function (TransmitterOpCodes) {
    TransmitterOpCodes[TransmitterOpCodes["Connect"] = 1] = "Connect";
    TransmitterOpCodes[TransmitterOpCodes["Ping"] = 2] = "Ping";
})(TransmitterOpCodes || (exports.TransmitterOpCodes = TransmitterOpCodes = {}));
var ReceiverOpCodes;
(function (ReceiverOpCodes) {
    ReceiverOpCodes[ReceiverOpCodes["Connect"] = 1] = "Connect";
    ReceiverOpCodes[ReceiverOpCodes["Pong"] = 2] = "Pong";
})(ReceiverOpCodes || (exports.ReceiverOpCodes = ReceiverOpCodes = {}));
//# sourceMappingURL=enum.js.map