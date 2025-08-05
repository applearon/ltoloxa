import type { Socket } from 'bun';
import { parseShort, parseString, parseTypes } from 'types.ts';
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, World, SocketData } from 'types.ts';

export async function broadcast(players: Map<number, Player>, data: Uint8Array, exclude:false|Array<number> = false) {
    for (let [key, value] of players) {
        if (exclude === false) {
        value.socket.write(data);
        } else if (!exclude.includes(key)) {
            value.socket.write(data);
        }
    }
}
export async function simple_broadcast(players: Array<Socket<SocketData>>, data: Uint8Array) {
    for (let player of players) {
        player.write(data);
    }
}

export async function parseMultiplePackets(socket: Socket<SocketData>, data: Uint8Array) {
    let i = 0;
    let packets = [];
    while (i < data.length) {
        let pid = data[i];
        let packet_len = 1;
        switch (pid) {
            case 0: {
                packet_len = 131
            } break;
            case 0x05: {
                packet_len = 9
            } break;
            case 0x08: {
                packet_len = 10
            } break;
            case 0x0d: {
                packet_len = 66
            } break;
            default: {
            }
        }
        packets.push(await parseClientData(socket, data.slice(i - data.length )))
        i= i + packet_len
    }
    return packets;
}
export async function parseClientData(socket: Socket<SocketData>, data: Uint8Array) {
    let packetdata = {} as ClientPacket;
    const pid = data[0];
    packetdata.ID = pid;
    switch (pid) {
        case 0: {
            const version = data[1];
            if (version == 0x07) {
                console.log("version is 0.30");
            } else {
                console.error("AAA VERSION IS WRONG");
            }
            const username = await parseString(data, 2);
            const verifyKey = await parseString(data, 2+64);
            packetdata.Data = {PVersion: version, username: username, verifyKey: verifyKey} as CPlayerID;
        } break;
        case 0x0d: {
            const playerID = data[1]; // should be 0xFF but whatever we assume it's fine ;p
            const msg = await parseString(data, 2);
            packetdata.Data = {PlayerID: playerID, msg: msg} as CMsg;
        } break;
        case 0x05: {
            // place/break block
            const x = await parseShort(data, 1);
            const y = await parseShort(data, 3);
            const z = await parseShort(data, 5);
            const Intent = data[7];
            let block;
            if (Intent == 0x00) {
                // detroy
                block = 0x00;
            } else {
                block = data[8];
            }
            packetdata.Data = {x: x, y: y, z: z, block: block} as CSetBlock;
        } break;
        case 0x08: {
            // movement
            const x = await parseShort(data, 2)/32;
            const y = await parseShort(data, 4)/32;
            const z = await parseShort(data, 6)/32;
            const yaw = data[8];
            const pitch = data[9];
            packetdata.Data = {x: x, y: y, z: z, yaw: yaw, pitch: pitch} as PlayerPos;
        } break;
        default: {
            console.log(data)
            // Handle unknown packets
            return packetdata;
        } break;
    }
    return packetdata
};

export async function despawnPlayer(ID: number, World: World) {
    broadcast(World.players, await parseTypes([0x0c, ID], ['hex', 'hex']));
}
