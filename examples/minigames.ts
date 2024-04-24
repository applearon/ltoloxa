#!/usr/bin/env bun
import { parseShort, parseString, parseTypes } from '../types.ts';
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player } from '../types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer } from '../loginHelpers.ts';
import { returnChatMsg } from '../utils.ts';
import { broadcast, parseClientData } from '../socketHelpers.ts';
import { lto } from '../index.ts';
//const level_data = Bun.file("appleWorld.gz");
let WorldSize = [256, 64, 256];
const miniGameSize = [512, 64, 512];
let players = new Map();
let spawnPos = {x: 8, y: 65, z: 8, yaw: 0x5a, pitch: 0} as PlayerPos;
let deltas = [];
let server;
async function buildMini(dimensions) {
    let lx = dimensions[0];
    let lz = dimensions[2];
    let ly = dimensions[1];
    let size = lx * ly * lz;
    let hexarr = size.toString(16).padStart(8, "0").match(/\d{2}/g);
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < hexarr.length; i++) {
        hexarr[i] = parseInt(hexarr[i],16);
        buffer[i] = hexarr[i];
        //writer.write(buffer);
    }
    for (let x = 0; x < lx; x++) {
        for (let z = 0; z < lz; z++) {
            for (let y = 0; y < ly; y++) {
                let block = 0x00;
                if (y < ly/2) {
                    block = 0x01;
                } else if (y < (ly/2)+5) {
                    block = 0x02;
                }
                buffer[4+(y*lx*lz)+(z*lx)+x] = block;
            }
        }
    }
    return buffer;
}
async function buildWorld(dimensions, deltas) {
    let lx = dimensions[0];
    let lz = dimensions[2];
    let ly = dimensions[1];
    let size = lx * ly * lz;
    let hexarr = size.toString(16).padStart(8, "0").match(/\d{2}/g);
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < hexarr.length; i++) {
        hexarr[i] = parseInt(hexarr[i],16);
        buffer[i] = hexarr[i];
        //writer.write(buffer);
    }
    for (let x = 0; x < lx; x++) {
        for (let z = 0; z < lz; z++) {
            for (let y = 0; y < ly; y++) {
                let block = 0x00;
                if ((x-128)*(x-128) + (z-128)*(z-128) < 16384) {
                    if (y % 10 == 0) {
                    block = 30;
                    }
                } else {
                    block = 33; 
                }
                buffer[4+(y*lx*lz)+(z*lx)+x] = block;
            }
        }
    }
    for (let i = 0; i < deltas.length; i++) {
        buffer[4+(deltas[i].y * lx * lz) + (deltas[i].z * lx) + deltas[i].x] = deltas[i].block;
    }
    return buffer;
}

lto.on('login', async (packet, socket, data) => {
    socket.data = { PlayerID: await getID(players), Lava: false};
    let resp = await returnServerID("AppleServer", "Aron's Javascript Server", false);
    socket.write(resp);
    let lobby = packet.Data.verifyKey.toString().split(':')[0].trim();
    let passwd = packet.Data.verifyKey.toString().split(':')[1];
    //let spawnPos = {x: 0.5, y: 33.6, z: 0, yaw: 0x5a, pitch: 0} as PlayerPos;
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket} as Player;
    players.set(socket.data.PlayerID, player);
    let worldGZ;
    switch (lobby) {
        case "mini": {
            worldGZ = Bun.gzipSync(await buildMini(miniGameSize));
            sendWorld(miniGameSize, worldGZ, socket);
            spawnPlayer(socket, player, players)
            broadcast(players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
        } break;
        default: {
            worldGZ = Bun.gzipSync(await buildWorld(WorldSize, deltas));
            // World, player, worldGZ, socket
            sendWorld(World, player, WorldGZ, socket);
            spawnPlayer(socket, player, players)
            broadcast(players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
        } break;
    }
});

lto.on('block', async (packet, socket, data) => {
    let resp = [0x06, data[1], data[2], data[3], data[4], data[5], data[6], packet.Data.block];
    broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']));
    deltas.push(packet.Data);
});
lto.on('pos', async (packet, socket, data) => {
    let x = (await parseShort(data, 2))/32;
    let y = (await parseShort(data, 4))/32;
    let z = (await parseShort(data, 6))/32;
                
    let resp = [0x08, socket.data.PlayerID, data[2], data[3], data[4], data[5], data[6], data[7], packet.Data.yaw, packet.Data.pitch];
    broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']), [socket.data.PlayerID]);
    if (socket.data.Lava) {
        //console.log('wava');
        //console.log(Math.floor(x), Math.floor(y)-2, Math.floor(z));
        let changes = {x: Math.round(x-0.5), y: Math.floor(y)-2, z: Math.round(z-0.5), block: 0x00} as CSetBlock;
        resp = await parseTypes([0x06, changes.x, changes.y ,changes.z , changes.block], ['hex', 'short', 'short', 'short', 'hex']);
        broadcast(players, resp);
        deltas.push(changes);
    }
});
lto.on('chat', async (packet, socket, data) => {
    if (packet.Data.msg.trim().startsWith('/lava')) {
        socket.write(await returnChatMsg('toggling wava!~', socket.data.PlayerID));
        socket.data.Lava = ! socket.data.Lava;
    } else {
        //server.write('MSG.' + packet.Data.msg);
        //console.log(players.get(socket.data.PlayerID));
        broadcast(players, await returnChatMsg(packet.Data.msg, socket.data.PlayerID));
    }
})

lto.on('disconnect', async (socket) => {
    if (socket.data !== undefined) {
        let ID = socket.data.PlayerID;
        let uname = players.get(ID).username;
        players.delete(ID);
        // despawn player packet:
        let resp = [0x0c, ID];
        broadcast(players, await parseTypes(resp, ['hex', 'hex']));
        broadcast(players, await returnChatMsg(uname + ' disconnected!', socket.data.PlayerID));
    }
});



