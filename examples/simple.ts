#!/usr/bin/env bun
import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from '../types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer, spawnPlayer } from '../loginHelpers.ts';
import { broadcast, parseClientData } from '../socketHelpers.ts';
import { returnChatMsg } from '../utils.ts';
import { lto } from '../index.ts';
const WorldSize = [512, 64, 512];
let players = new Map();
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let deltas = [];
let server;
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
                if (y < ly/2) {
                    block = 0x01;
                } else if (y < (ly/2)+4) {
                    block = 0x03;
                } else if (y == (ly/2)+4) {
                    block = 0x02;
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

lto.on('login', async (packet, socket) => {
    socket.data = { PlayerID: await getID(players)};
    let resp = await returnServerID("ltoloxA Server", "Simple ltoloxA Server", false);
    socket.write(resp);
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket} as Player;
    players.set(socket.data.PlayerID, player);
    // now we send them da LEVELLLL
    let worldGZ = Bun.gzipSync(await buildWorld(WorldSize, deltas));
    sendWorld(WorldSize, worldGZ, socket);
    spawnPlayer(socket, player, players)
    broadcast(players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
});

lto.on('block', async (packet, socket, data) => {
    console.log(`${players.get(socket.data.PlayerID).username} placed ${packet.Data.block} at (${packet.Data.x},${packet.Data.y},${packet.Data.z})`);
    let resp = [0x06, data[1], data[2], data[3], data[4], data[5], data[6], packet.Data.block];
    broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']));
    deltas.push(packet.Data);
})

lto.on('pos', async (packet, socket, data) => {
    let resp = [0x08, socket.data.PlayerID, data[2], data[3], data[4], data[5], data[6], data[7], packet.Data.yaw, packet.Data.pitch];
    broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']), [socket.data.PlayerID]);
})

lto.on('chat', async (packet, socket, data) => {
    let msg = '<' + players.get(socket.data.PlayerID).username + '> ' + packet.Data.msg;
    broadcast(players, await returnChatMsg(msg, socket.data.PlayerID));
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
})
