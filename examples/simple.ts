#!/usr/bin/env bun
import { parseShort, parseString, parseTypes } from '../types.ts';
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, World, SocketData } from '../types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from '../loginHelpers.ts';
import { broadcast, parseClientData, despawnPlayer } from '../socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock, posUpdate, teleport } from '../utils.ts';
import { lto } from '../index.ts';
import type { Socket } from 'bun';
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = {
    x: 512, y: 64, z: 512,
    name: "ltoloxA Server",
    motd: "Simple ltoloxA Server",
    players: new Map(),
    deltas: [],
} as World;
const getBlock = (World: World, x: number, y: number, z: number) => {
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

lto.on('login', async (packet: ClientPacket, socket: Socket) => {
    socket.data = { PlayerID: await getID(World.players)} as SocketData;
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket, op: false} as Player;
    World.players.set(socket.data.PlayerID, player);
    let worldGZ = Bun.gzipSync(await buildWorld(World, getBlock));
    sendWorld(World, player, worldGZ, socket);
    spawnPlayer(socket, player, World.players);
    broadcast(World.players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID));
});

lto.on('block', async (packet, socket, data) => {
    console.log(`${World.players.get(socket.data.PlayerID).username} placed ${packet.Data.block} at (${packet.Data.x},${packet.Data.y},${packet.Data.z})`);
    placeBlock(World, packet.Data);
    World.deltas.push(packet.Data);
})

lto.on('pos', async (packet, socket, data) => {
    posUpdate(socket.data.PlayerID, World, packet.Data);
    World.players.get(socket.data.PlayerID).Position = packet.Data;
})

lto.on('chat', async (packet, socket, data) => {
    let Player = World.players.get(socket.data.PlayerID);
    let msg = '<' + Player.username + '> ' + packet.Data.msg;
    switch(packet.Data.msg.split(" ")[0]) {
        case "/pos": {
            socket.write(await returnChatMsg("================", socket.data.PlayerID));
            socket.write(await returnChatMsg("x: " + Player.Position.x, socket.data.PlayerID));
            socket.write(await returnChatMsg("y: " + Player.Position.y, socket.data.PlayerID));
            socket.write(await returnChatMsg("z: " + Player.Position.z, socket.data.PlayerID));
            socket.write(await returnChatMsg("Yaw: " + Player.Position.yaw, socket.data.PlayerID));
            socket.write(await returnChatMsg("Pitch: " + Player.Position.pitch, socket.data.PlayerID));
            socket.write(await returnChatMsg("================", socket.data.PlayerID));
        } break;
        case "/tp": {
            let msg = packet.Data.msg.split(" ");
            if (msg.length != 4 || isNaN(msg[1]) || isNaN(msg[2]) || isNaN(msg[3])) {
                socket.write(await returnChatMsg("Usage: /tp x y z", socket.data.PlayerID));
            } else {
                Player.Position.x = Number(msg[1]);
                Player.Position.y = Number(msg[2]);
                Player.Position.z = Number(msg[3]);
                teleport(socket.data.PlayerID, World, Player.Position);

            }
        } break;
        default: {
            broadcast(World.players, await returnChatMsg(msg, socket.data.PlayerID));
        }
    }
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
