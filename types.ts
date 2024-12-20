import type { Socket } from "bun";
export interface SocketData {
    PlayerID: number,
}
export interface ClientPacket {
    ID: number,
    Data: CPlayerID | CMsg | CSetBlock  | PlayerPos,
}
export interface CPlayerID {
    PVersion: number,
    username: string,
    verifyKey: string,
}
export interface CSetBlock {
    x: number,
    y: number,
    z: number,
    block: number,
}
export interface CMsg {
    PlayerID: number,
    msg: string,
}
export interface PlayerPos {
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
}
export interface Entity {
    username: string,
    Position: PlayerPos,
    ID: number,
}
export interface Player {
    username: string,
    Position: PlayerPos,
    socket: Socket<SocketData>,
    op: boolean,
}
export interface World {
    x: number,
    y: number,
    z: number,
    name: string,
    motd: string,
    buffer?: Buffer,
    deltas?: Array<CSetBlock> | false,
    players: Map<number, Player>, 
}
export interface Entity {
    name: string,
    pos: PlayerPos,
    id: number,
}

export interface OutBoundPacket {
    players: Socket<SocketData>[],
    packet: Uint8Array
}
export async function parseShort(data: Uint8Array, begin: number) {
    // return the number of index begin (inclusive)
    //let byte = data[begin].concat(data[begin+1]);
    //let num = parseInt(byte, 16);
    //console.log("we at: ", data[begin], data[begin+1])
    return 256*data[begin]+data[begin+1];
}

export async function parseString(data: Uint8Array, begin: number) {
    // returns the string of index begin(inclusive)
    let str = '';
    for (let i=begin; i < begin+64; i++) {
        //console.log(data[i]);
        str = str.concat(String.fromCharCode(data[i]));
    }
    return str.trimEnd();
}

export async function parseTypes(items: Array<any>, types: Array<string>) {
    // items: array of any
    let out = [];
    for (const item in items) {
        switch (types[item]) {
            case 'string': {
                //console.log('Will be parsed as string');
                let str = items[item];
                if (str.length > 64) {
                    // too long idk what to do
                    console.log("WARNING: string length too much, cutting off");
                    str = str.substring(0,64);
                } else {
                    // add zeros
                    str = str.padEnd(64, " ");
                }
                for (let char in str.split("")) {
                    out.push(str[char].charCodeAt(0));
                }
            } break;
            case 'hex': {
                // do nothing
                out.push(items[item]);
            } break;
            case 'short': {
                let str = items[item].toString(16).padStart(4, "0").match(/.{2}/g);
                out.push(parseInt(str[0], 16));
                out.push(parseInt(str[1], 16));
            } break;
            case 'FShort': {
                //out.push(items[item]);
                let num = Math.round(items[item]* (2**5));
                let str = num.toString(16).padStart(4, '0'); 
                let b1 = str.substring(0,2);
                let b2 = str.substring(2);
                //console.log(b1, b2);
                out.push(parseInt(b1, 16));
                out.push(parseInt(b2, 16));
            } break;
            default: {
                console.log("assuming fine");
                out.push(items[item]);
            } break;
        } 
    }
    return new Uint8Array(out);
}

