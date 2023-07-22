export enum TransmitterOpCodes {
    Connect = 1<<0,
    Ping = 1<<1,

    
}

export enum ReceiverOpCodes {
    Connect = 1<<0,
    Pong = 1<<1,
}