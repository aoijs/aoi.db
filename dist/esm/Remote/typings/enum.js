export var TransmitterOpCodes;
(function (TransmitterOpCodes) {
    TransmitterOpCodes[TransmitterOpCodes["Connect"] = 1] = "Connect";
    TransmitterOpCodes[TransmitterOpCodes["Ping"] = 2] = "Ping";
    TransmitterOpCodes[TransmitterOpCodes["Operation"] = 8] = "Operation";
    TransmitterOpCodes[TransmitterOpCodes["Analyze"] = 16] = "Analyze";
    TransmitterOpCodes[TransmitterOpCodes["Disconnect"] = 32] = "Disconnect";
})(TransmitterOpCodes || (TransmitterOpCodes = {}));
export var ReceiverOpCodes;
(function (ReceiverOpCodes) {
    ReceiverOpCodes[ReceiverOpCodes["AckConnect"] = 1] = "AckConnect";
    ReceiverOpCodes[ReceiverOpCodes["Pong"] = 2] = "Pong";
    ReceiverOpCodes[ReceiverOpCodes["ConnectionDenied"] = 4] = "ConnectionDenied";
    ReceiverOpCodes[ReceiverOpCodes["AckOperation"] = 8] = "AckOperation";
    ReceiverOpCodes[ReceiverOpCodes["AckAnalyze"] = 16] = "AckAnalyze";
    ReceiverOpCodes[ReceiverOpCodes["AckDisconnect"] = 32] = "AckDisconnect";
})(ReceiverOpCodes || (ReceiverOpCodes = {}));
export var Permissions;
(function (Permissions) {
    Permissions[Permissions["ROnly"] = 1] = "ROnly";
    Permissions[Permissions["WOnly"] = 2] = "WOnly";
    Permissions[Permissions["RW"] = 4] = "RW";
    Permissions[Permissions["Manage"] = 8] = "Manage";
    Permissions[Permissions["Admin"] = 16] = "Admin";
})(Permissions || (Permissions = {}));
//# sourceMappingURL=enum.js.map