#!/usr/bin/env bun
import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from '../../types.ts';
import { getID, returnServerID, sendWorld, spawnPlayer } from '../../loginHelpers.ts';
import { broadcast, parseClientData, despawnPlayer } from '../../socketHelpers.ts';
import { returnChatMsg, buildWorld, placeBlock, posUpdate, exportWorld } from '../../utils.ts';
import { lto } from '../../index.ts';
let spawnPos = {x: 32, y: 34, z: 32, yaw: 0x00, pitch: 0x00} as PlayerPos;
let World = {
    x: 65, y: 64, z: 65,
    name: "ltoloxA Server",
    motd: "Simple ltoloxA Server",
    players: new Map(),
    deltas: [],
} as World;
let opKey = 'ApplismPog'; // Verification Password
const getBlock = (World, x, y, z) => { // generate plain island
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

lto.on('login', async (packet, socket) => {
    socket.data = { PlayerID: await getID(World.players)};
    let player = {username: packet.Data.username, Position: spawnPos, socket: socket, op: (packet.Data.verifyKey == opKey) } as Player;
    World.players.set(socket.data.PlayerID, player);
    //let worldGZ = Bun.gzipSync(await buildWorld(World, getBlock));
    World.buf = await Bun.file("appleWorld").arrayBuffer() 
    let worldGZ = Bun.gzipSync(World.buf);
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
    posUpdate(socket.data.PlayerID, World, packet.Data, data); // passing data to be more efficient 
})

lto.on('chat', async (packet, socket, data) => {
    let player = World.players.get(socket.data.PlayerID);
    let txt = packet.Data.msg.toString().split(' ');
    if (packet.Data.msg.indexOf("/") === 0) {
        let cmd = txt.shift();
        switch (cmd) {
            case "/export": {
                if (player.op) {
                    const out = Bun.file('./appleWorld');
                    await exportWorld(World, out);
                    socket.write(await returnChatMsg("Exported world!", socket.data.PlayerID));
                } else {
                    socket.write(await returnChatMsg("Permission Denied.", socket.data.PlayerID));
                }
            } break;
            case "/fill": {
                if (player.op) {
                if (txt.length === 7) {
                    let p1 = [parseInt(txt[0]), parseInt(txt[1]), parseInt(txt[2])];
                    let p2 = [parseInt(txt[3]), parseInt(txt[4]), parseInt(txt[5])];
                    //console.log(p1, p2, txt[6]);
                    for (let x = p1[0]; x <= p2[0]; x++) {
                        for (let y = p1[1]; y <= p2[1]; y++) {
                            for (let z = p1[2]; z <= p2[2]; z++) {
                                let placePacket = {x: x, y: y, z:z, block: txt[6]} as CSetBlock;
                                placeBlock(World, placePacket);
                                World.deltas.push(placePacket);
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
        let msg = '<' + World.players.get(socket.data.PlayerID).username + '> ' + packet.Data.msg;
        broadcast(World.players, await returnChatMsg(msg, socket.data.PlayerID));
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
