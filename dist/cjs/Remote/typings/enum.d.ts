export declare enum TransmitterOpCodes {
    Connect = 1,
    Ping = 2,
    Operation = 8,
    Analyze = 16,
    Disconnect = 32
}
export declare enum ReceiverOpCodes {
    AckConnect = 1,
    Pong = 2,
    ConnectionDenied = 4,
    AckOperation = 8,
    AckAnalyze = 16,
    AckDisconnect = 32
}
export declare enum Permissions {
    ROnly = 1,
    WOnly = 2,
    RW = 4,
    Manage = 8,
    Admin = 16
}
//# sourceMappingURL=enum.d.ts.map