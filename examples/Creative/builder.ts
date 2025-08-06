#!/usr/bin/env bun
import type { Socket } from 'bun';
import { parseShort, parseString, parseTypes } from 'types.ts';
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, World, SocketData } from 'types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from 'loginHelpers.ts';
import { broadcast, parseClientData, despawnPlayer } from 'socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock, posUpdate, exportWorld, getBlock, updateDeltas } from 'utils.ts';
import { Server } from 'index.ts';
let spawnPos = {x: 32, y: 34, z: 32, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = {
    x: 65, y: 64, z: 65,
    name: "ltoloxA Server",
    motd: "Simple ltoloxA Server",
    players: new Map(),
    deltas: [],
} as World;
let opKey = 'ILoveApplism'; // Verification Password
const blockAt = (World: World, x: number, y: number, z: number) => { // generate plain island
    let block = 0x00;
    if (y < World.y/2) {
        block = 0x00;
    } else if (y < (World.y/2)+4) {
        block = 0x00;
    } else if (y == (World.y/2)+4) {
        block = 0x00;
    }
    let cx = x-32;
    let cz = z-32;
    let rad = y-17;
    if (rad > 1 && y <= 32 && (cx*cx+cz*cz) < rad*rad) {
        if (y == 32) {
            block = 0x02;
        } else if (y >= 27) {
            block = 0x03;
        } else {
            block = 0x01;
        }
    }
    return block;
}

async function handleLogin(packet: ClientPacket, socket: Socket<SocketData>) {
    socket.data = { PlayerID: await getID(World.players)};
    let pData = packet.Data as CPlayerID;
    let player = {username: pData.username, Position: spawnPos, socket: socket, op: (pData.verifyKey == opKey) } as Player;
    World.players.set(socket.data.PlayerID, player);
    //let worldGZ = Bun.gzipSync(await buildWorld(World, blockAt));
    let buffer = new Uint8Array(await Bun.file("appleWorld").arrayBuffer());
    updateDeltas(World, buffer);
    World.buffer = new Buffer(buffer);
    let worldGZ = Bun.gzipSync(World.buffer);
    await sendWorld(World, player, worldGZ, socket);
    await spawnPlayer(socket, player, World.players);
    await broadcast(World.players, await returnChatMsg(pData.username + ' has joined!', socket.data.PlayerID));
};

async function handleBlock(packet: ClientPacket, socket: Socket<SocketData>) {
    let pData = packet.Data as CSetBlock;
    if (World.players.get(socket.data.PlayerID)!.op) {
        console.log(`${World.players.get(socket.data.PlayerID)!.username} placed ${pData.block} at (${pData.x},${pData.y},${pData.z}), replacing ${await getBlock(World, pData.x, pData.y, pData.z)}`);
        placeBlock(World, pData);
        if (!World.deltas) return;
        World.deltas.push(pData);
    } else {
        let old = await getBlock(World, pData.x, pData.y, pData.z);
        let block = {x: pData.x, y: pData.y, z: pData.z, block: old} as CSetBlock;
        placeBlock(World, block);
    }
}

async function handlePos(packet: ClientPacket, socket: Socket<SocketData>) {
    posUpdate(socket.data.PlayerID, World, packet.Data as PlayerPos); // passing data to be more efficient 
}

async function handleChat(packet: ClientPacket, socket: Socket<SocketData>) {
    let player = World.players.get(socket.data.PlayerID);
    let pData = packet.Data as CMsg;
    let txt = pData.msg.toString().split(' ');
    if (pData.msg.indexOf("/") === 0) {
        let cmd = txt.shift();
        switch (cmd) {
            case "/export": {
                if (player!.op) {
                    const out = Bun.file('./appleWorld');
                    await exportWorld(World, out);
                    socket.write(await returnChatMsg("Exported world!", socket.data.PlayerID));
                } else {
                    socket.write(await returnChatMsg("Permission Denied.", socket.data.PlayerID));
                }
            } break;
            case "/fill": {
                if (player!.op) {
                if (txt.length === 7) {
                    let p1 = [parseInt(txt[0]), parseInt(txt[1]), parseInt(txt[2])];
                    let p2 = [parseInt(txt[3]), parseInt(txt[4]), parseInt(txt[5])];
                    //console.log(p1, p2, txt[6]);
                    for (let x = p1[0]; x <= p2[0]; x++) {
                        for (let y = p1[1]; y <= p2[1]; y++) {
                            for (let z = p1[2]; z <= p2[2]; z++) {
                                let placePacket = {x: x, y: y, z:z, block: parseInt(txt[6])} as CSetBlock;
                                placeBlock(World, placePacket);
                                if (World.deltas) {
                                    World.deltas.push(placePacket);
                                }
                            //console.log(`Placing at ${x}x${y}${z}`);
                            }
                        }
                    }
                } else {
                    socket.write(await returnChatMsg("Usage: /fill x1 y1 z1 x2 y1 z2 BLOCKID", socket.data.PlayerID));
                }
                } else {
                    socket.write(await returnChatMsg("Permission Denied.", socket.data.PlayerID));
                }
            } break;
            default: {
                socket.write(await returnChatMsg("Unknown Command", socket.data.PlayerID));
            }
        }
    } else {
        let msg = '<' + World.players.get(socket.data.PlayerID)!.username + '> ' + pData.msg;
        broadcast(World.players, await returnChatMsg(msg, socket.data.PlayerID));
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

let server = new Server(handleLogin, handleBlock, handlePos, handleChat, handleDisconnect, 25565);
