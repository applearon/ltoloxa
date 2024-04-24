import { parseTypes } from 'types.ts';
import type { World, CSetBlock, PlayerPos, Entity } from 'types.ts';
import { broadcast } from 'socketHelpers.ts';
import type { BunFile } from 'bun';
export async function returnChatMsg(string: string, playerID: number) {
    let pid = 0x0d;
    return parseTypes([pid, playerID, string], ['hex', 'hex', 'string']);
}

export async function buildWorld(World: World, func: Function) {
    let lx = World.x;
    let lz = World.z;
    let ly = World.y;
    let size = lx * ly * lz;
    let hexarr = size.toString(16).padStart(8, "0").match(/\d{2}/g);
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < hexarr!.length; i++) {
        buffer[i] = parseInt(hexarr![i],16);
        //writer.write(buffer);
    }
    for (let y = 0; y < ly; y++) {
        for (let z = 0; z < lz; z++) {
            for (let x = 0; x < lx; x++) {
                buffer[4+(y*lx*lz)+(z*lx)+x] = func(World, x, y, z);
            }
        }
    }
    updateDeltas(World, buffer);
    return buffer;
}

export async function updateDeltas(World: World, buffer: Uint8Array) {
    if (!World.deltas) return; // if deltas are not tracked don't do anything
    for (let i = 0; i < World.deltas.length; i++) {
        let d = World.deltas[i];
        let pos = 4+(d.y * World.x * World.z)+(d.z * World.x)+d.x;
        buffer[pos] = d.block;
    }
    // don't have to return buffer since it's pass by reference
}

export async function placeBlock(World: World, data: CSetBlock) {
    let resp = [0x06, data.x, data.y, data.z, data.block];
    broadcast(World.players, await parseTypes(resp, ['hex', 'short', 'short', 'short', 'hex']));
}

export async function posUpdate(ID: number, World: World, packet: PlayerPos) {
    let resp = [0x08, ID, packet.x, packet.y, packet.z, packet.yaw, packet.pitch];
    broadcast(World.players, await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']), [ID]);

}
export async function teleport(ID: number, World: World, pos: PlayerPos) {
    let resp = [0x08, ID, pos.x, pos.y, pos.z, pos.yaw, pos.pitch];
    broadcast(World.players, await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']), [ID]);
    resp[1] = 255;
    World.players.get(ID)!.socket.write(await parseTypes(resp, ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex']));
}

export async function getBlock(World: World, x: number, y: number, z: number) {
    if (World.deltas) {
        for (let i = World.deltas.length - 1; i > 0; i--) {
            let block = World.deltas[i];
            if (block.x == x && block.y == y && block.z == z) {
                return block.block;
            }
        }
    }
    let val = 4+(World.x * World.z * y) + (World.x * z) + x;
    if (World.buffer) {
        return World.buffer[val];
    } else {
        console.error("ERROR: World.buffer does not exist, returning air");
        return 0; // if panic return air
    }
}


// WARNING: Don't expose this as a command, as it literally writes to the system
export async function exportWorld(World: World, file: BunFile) {
    if (!World.buffer) {
        console.log("World.buffer does not exist, exiting");
        return;
    }
    let buffer = new Uint8Array(World.buffer);
    if (World.deltas) {
        for (let i = 0; i < World.deltas.length; i++) {
            buffer[4+(World.deltas[i].y * World.x * World.z) + (World.deltas[i].z * World.x) + World.deltas[i].x] = World.deltas[i].block;
            //console.log("hi", 4+(World.deltas[i].y * World.x * World.z) + (World.deltas[i].z * World.x) + World.deltas[i].x);
        }
    }
    await Bun.write(file, buffer);
}


export async function spawnEntity(World: World, Entity: Entity) {
    let resp = [0x07, Entity.ID, Entity.username, Entity.Position.x, Entity.Position.y, Entity.Position.z, Entity.Position.yaw, Entity.Position.pitch];
    let respTypes = ['hex', 'hex', 'string', 'FShort', 'FShort', 'FShort', 'hex', 'hex'];
    broadcast(World.players, await parseTypes(resp, respTypes));
}

