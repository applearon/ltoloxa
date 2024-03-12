#!/usr/bin/env bun
import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from '../types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from '../loginHelpers.ts';
import { broadcast, parseClientData } from '../socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock } from '../utils.ts';
import { lto } from '../index.ts';
//const WorldSize = [512, 64, 512];
//let players = new Map();
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = { x: 512, y: 64, z: 512, players: new Map(), deltas: []} as World;
let server;
const getBlock = (World, x, y, z) => {
    let block = 0x00;
    if (y < World.y/2) {
        block = 0x01;
    } else if (y < (World.y/2)+4) {
        block = 0x03;
    } else if (y == (World.y/2)+4) {
        block = 0x02;
    }
    return block;
}

lto.on('login', async (packet, socket) => {
    socket.data = { PlayerID: await getID(World.players)};
    let resp = await returnServerID("ltoloxA Server", "Simple ltoloxA Server", false);
    socket.write(resp);
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket} as Player;
    World.players.set(socket.data.PlayerID, player);
    // now we send them da LEVELLLL
    let worldGZ = Bun.gzipSync(await buildWorld(World, getBlock));
    sendWorld(World, worldGZ, socket);
    spawnPlayer(socket, player, World.players)
    broadcast(World.players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
});

lto.on('block', async (packet, socket, data) => {
    console.log(`${World.players.get(socket.data.PlayerID).username} placed ${packet.Data.block} at (${packet.Data.x},${packet.Data.y},${packet.Data.z})`);
    placeBlock(World, packet);
    World.deltas.push(packet.Data);
})

lto.on('pos', async (packet, socket, data) => {
    let resp = [0x08, socket.data.PlayerID, data[2], data[3], data[4], data[5], data[6], data[7], packet.Data.yaw, packet.Data.pitch];
    broadcast(World.players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']), [socket.data.PlayerID]);
})

lto.on('chat', async (packet, socket, data) => {
    let msg = '<' + World.players.get(socket.data.PlayerID).username + '> ' + packet.Data.msg;
    broadcast(World.players, await returnChatMsg(msg, socket.data.PlayerID));
})

lto.on('disconnect', async (socket) => {
        if (socket.data !== undefined) {
            let ID = socket.data.PlayerID;
            let uname = World.players.get(ID).username;
            World.players.delete(ID);
            // despawn player packet:
            let resp = [0x0c, ID];
            broadcast(World.players, await parseTypes(resp, ['hex', 'hex']));
            broadcast(World.players, await returnChatMsg(uname + ' disconnected!', socket.data.PlayerID));
        }
})
