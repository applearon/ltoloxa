import { parseTypes } from './types.ts';
import { broadcast } from './socketHelpers.ts';
export async function returnChatMsg(string, playerID) {
    let pid = 0x0d;
    return parseTypes([pid, playerID, string], ['hex', 'hex', 'string']);
}

export async function buildWorld(World, func) {
    let lx = World.x;
    let lz = World.z;
    let ly = World.y;
    let size = lx * ly * lz;
    let hexarr = size.toString(16).padStart(8, "0").match(/\d{2}/g);
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < hexarr.length; i++) {
        hexarr[i] = parseInt(hexarr[i],16);
        buffer[i] = hexarr[i];
        //writer.write(buffer);
    }
    for (let y = 0; y < ly; y++) {
        for (let z = 0; z < lz; z++) {
            for (let x = 0; x < lx; x++) {
                buffer[4+(y*lx*lz)+(z*lx)+x] = func(World, x, y, z);
            }
        }
    }
    for (let i = 0; i < World.deltas.length; i++) {
        buffer[4+(World.deltas[i].y * lx * lz) + (World.deltas[i].z * lx) + World.deltas[i].x] = World.deltas[i].block;
    }
    return buffer;
}

export async function placeBlock(World, data) {
    let resp = [0x06, data.x, data.y, data.z, data.block];
    broadcast(World.players, await parseTypes(resp, ['hex', 'short', 'short', 'short', 'hex']));
}

export async function posUpdate(ID, World, packet) {
    let resp = [0x08, ID, packet.x, packet.y, packet.z, packet.yaw, packet.pitch];
    broadcast(World.players, await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']), [ID]);

}
export async function teleport(ID, World, pos) {
    let resp = [0x08, ID, pos.x, pos.y, pos.z, pos.yaw, pos.pitch];
    broadcast(World.players, await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']), [ID]);
    resp[1] = 255;
    World.players.get(ID).socket.write(await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']));
}

export async function getBlock(World, x, y, z) {
    for (let i = World.deltas.length - 1; i > 0; i--) {
        let block = World.deltas[i];
        if (block.x == x && block.y == y && block.z == z) {
            return block.block;
        }
    }
    let val = 4+(World.x * World.z * y) + (World.x * z) + x;
    let buf = new Uint8Array(World.buf);
    return buf[val];
}


// WARNING: Don't expose this as a command, as it literally writes to the system
export async function exportWorld(World, file) {
    let buffer = new Uint8Array(World.buf);
    for (let i = 0; i < World.deltas.length; i++) {
        buffer[4+(World.deltas[i].y * World.x * World.z) + (World.deltas[i].z * World.x) + World.deltas[i].x] = World.deltas[i].block;
        //console.log("hi", 4+(World.deltas[i].y * World.x * World.z) + (World.deltas[i].z * World.x) + World.deltas[i].x);
    }
    await Bun.write(file, buffer);
}


export async function spawnEntity(World, Entity: Entity) {
    let resp = [0x07, socket.data.PlayerID, player.username, player.Position.x, player.Position.y, player.Position.Z, player.Position.yaw, player.Position.pitch];
    let respTypes = ['hex', 'hex', 'string', 'FShort', 'FShort', 'FShort', 'hex', 'hex'];
    broadcast(players, await parseTypes(resp, respTypes), [socket.data.PlayerID]);
    resp[1] = 0xFF;
    socket.write(await parseTypes(resp, respTypes));
    socket.write(await parseTypes([0x08, 0xFF, player.Position.x, player.Position.y, player.Position.z, player.Position.yaw, player.Position.pitch ], ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex'])); 
    // we inform client of players currently online
    for (let [key, value] of players) {
    if (key == socket.data.PlayerID) {
        continue;
    }
        let resp = [0x07, key, value.username, value.Position.x, value.Position.y, value.Position.z, value.Position.yaw, value.Position.pitch];
        socket.write(await parseTypes(resp, respTypes));
    }

}

