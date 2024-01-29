export enum TransmitterOpCodes {
    Connect = 1<<0,
    Ping = 1<<1,
    Operation = 1<<3,
    Analyze = 1<<4,
    Disconnect = 1<<5,
}

export enum ReceiverOpCodes {
    AckConnect = 1<<0,
    Pong = 1<<1,
    ConnectionDenied = 1<<2,
    AckOperation = 1<<3,
    AckAnalyze = 1<<4,
    AckDisconnect = 1<<5,
}