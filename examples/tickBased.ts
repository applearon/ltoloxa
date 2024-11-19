#!/usr/bin/env bun
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, World, SocketData } from 'types.ts';
import { parseTypes } from 'types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from 'loginHelpers.ts';
import { broadcast, parseClientData, despawnPlayer } from 'socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock, posUpdate, teleport } from 'utils.ts';
import { Server } from 'index.ts';
import type { Socket } from 'bun';
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = {
    x: 512, y: 64, z: 512,
    name: "ltoloxA Server",
    motd: "Simple ltoloxA Server",
    players: new Map(),
    deltas: [] as CSetBlock[],
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

async function handleLogin(packet: ClientPacket, socket: Socket<SocketData>) {
    socket.data = { PlayerID: await getID(World.players)} as SocketData;
    let data = packet.Data as CPlayerID;
    let player = {username: data.username, Position: spawnPos, socket: socket, op: false} as Player;
    World.players.set(socket.data.PlayerID, player);
    let worldGZ = Bun.gzipSync(await buildWorld(World, getBlock));
    sendWorld(World, player, worldGZ, socket);
    spawnPlayer(socket, player, World.players);
    broadcast(World.players, await returnChatMsg(data.username + ' has joined!', socket.data.PlayerID));
};

async function handleBlock(packet: ClientPacket, socket: Socket<SocketData>, data: Uint8Array) {
    let pData = packet.Data as CSetBlock;
    console.log(`${World.players.get(socket.data.PlayerID)!.username} placed ${pData.block} at (${pData.x},${pData.y},${pData.z})`);
    placeBlock(World, pData);
    if (! World.deltas) {return};
    World.deltas.push(pData);
}

async function handlePos(packet: ClientPacket, socket: Socket<SocketData>, data: Uint8Array) {
    let pData = packet.Data as PlayerPos;
    posUpdate(socket.data.PlayerID, World, pData);
    World.players.get(socket.data.PlayerID)!.Position = pData;
}

async function handleChat(packet: ClientPacket, socket: Socket<SocketData>, data: Uint8Array) {
    let Player = World.players.get(socket.data.PlayerID);
    let pData = packet.Data as CMsg;
    let msg = '<' + Player!.username + '> ' + pData.msg;
    switch(pData.msg.split(" ")[0]) {
        case "/pos": {
            socket.write(await returnChatMsg("================", socket.data.PlayerID));
            socket.write(await returnChatMsg("x: " + Player!.Position.x, socket.data.PlayerID));
            socket.write(await returnChatMsg("y: " + Player!.Position.y, socket.data.PlayerID));
            socket.write(await returnChatMsg("z: " + Player!.Position.z, socket.data.PlayerID));
            socket.write(await returnChatMsg("Yaw: " + Player!.Position.yaw, socket.data.PlayerID));
            socket.write(await returnChatMsg("Pitch: " + Player!.Position.pitch, socket.data.PlayerID));
            socket.write(await returnChatMsg("================", socket.data.PlayerID));
        } break;
        case "/tp": {
            let msg = pData.msg.split(" ");
            if (msg.length != 4 || isNaN(Number(msg[1])) || isNaN(Number(msg[2])) || isNaN(Number(msg[3]))) {
                socket.write(await returnChatMsg("Usage: /tp x y z", socket.data.PlayerID));
            } else {
                Player!.Position.x = Number(msg[1]);
                Player!.Position.y = Number(msg[2]);
                Player!.Position.z = Number(msg[3]);
                teleport(socket.data.PlayerID, World, Player!.Position);

            }
        } break;
        case "/reset": {
            let placePacket = {x: 0, y: 0, z:0, block: 0} as CSetBlock;
            let resp = [0x06, 0, 0, 0, 0];
            let typeArr = ['hex', 'short', 'short', 'short', 'hex'];
            let typeOut = []
            let outArr = [];
            //broadcast(World.players, await parseTypes(resp, ['hex', 'short', 'short', 'short', 'hex']));
            for (let x = 0; x < World.x; x++) {
                //placePacket.x = x
                resp[1] = x;
                for (let y =0; y < World.y; y++) {
                    //placePacket.y = y;
                    resp[2] = y;
                    for (let z=0; z < World.z; z++) {
                        //placePacket.z = z;
                        resp[3] = z;
                        outArr = outArr.concat(resp);
                        typeOut = typeOut.concat(typeArr);
                        //placeBlock(World, placePacket);
                    }
                await broadcast(World.players, await parseTypes(outArr, typeOut));
                outArr = [];
                typeOut = [];
                }
                console.log(x);
            }
        }
        default: {
            broadcast(World.players, await returnChatMsg(msg, socket.data.PlayerID));
        }
    }
}

async function handleDisconnect(socket: Socket<SocketData>) {
        if (socket.data.PlayerID !== -1) {
            let ID = socket.data.PlayerID;
            let uname = World.players.get(ID)!.username;
            World.players.delete(ID);
            // despawn player packet:
            despawnPlayer(ID, World);
            broadcast(World.players, await returnChatMsg(uname + ' disconnected!', socket.data.PlayerID));
        }
}
let server = Server.tickBased(25565);
async function tick(arr) {
    for (let packet of arr) {
        switch(packet[0]) {
            case "login": {
                handleLogin(packet[1], packet[2]);
            } break;
            case "block": {
                handleBlock(packet[1], packet[2]);
            } break;
            case "movement": {
                handlePos(packet[1], packet[2]);
            } break;
            case "chat": {
                handleChat(packet[1], packet[2]);
            } break;
            case "disconnect": {
                handleDisconnect(packet[1]);
            } break;
        }
    }
}
server.tickLoop(tick, 20)
