#!/usr/bin/env bun
import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from '../types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from '../loginHelpers.ts';
import { broadcast, parseClientData, despawnPlayer } from '../socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock, posUpdate } from '../utils.ts';
import { lto } from '../index.ts';
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = {
    x: 512, y: 64, z: 512,
    name: "ltoloxA Server",
    motd: "Simple ltoloxA Server",
    players: new Map(),
    deltas: [],
} as World;
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
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket, op: false} as Player;
    World.players.set(socket.data.PlayerID, player);
    let worldGZ = Bun.gzipSync(await buildWorld(World, getBlock));
    sendWorld(World, player, worldGZ, socket);
    spawnPlayer(socket, player, World.players);
    broadcast(World.players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
});

lto.on('block', async (packet, socket, data) => {
    console.log(`${World.players.get(socket.data.PlayerID).username} placed ${packet.Data.block} at (${packet.Data.x},${packet.Data.y},${packet.Data.z})`);
    placeBlock(World, packet);
    World.deltas.push(packet.Data);
})

lto.on('pos', async (packet, socket, data) => {
    posUpdate(socket.data.PlayerID, World, packet, data); // passing data to be more efficient 
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
            despawnPlayer(ID, World);
            broadcast(World.players, await returnChatMsg(uname + ' disconnected!', socket.data.PlayerID));
        }
})
