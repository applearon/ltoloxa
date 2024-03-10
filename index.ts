#!/usr/bin/env bun
import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from './types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer, spawnPlayer } from './loginHelpers.ts';
import { broadcast, parseClientData } from './socketHelpers.ts';
//const level_data = Bun.file("appleWorld.gz");
const WorldSize = [512, 64, 512];
let players = new Map();
let spawnPos = {x: 256, y: 40, z: 256, yaw: 0x00, pitch: 0x00} as PlayerPos;
let deltas = [];
let server;

async function returnChatMsg(string, playerID, players, system = false) {
    let pid = 0x0d;
    let str;
    if (system === false) {
        str = ("<").concat(players.get(playerID).username, "> ", string);
    } else {
        str = string;
    }
    return parseTypes([pid, playerID, str], ['hex', 'hex', 'string']);

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

Bun.listen({
  hostname: "0.0.0.0",
  port: 25565,
  socket: {
    async data(socket, data) {
        //console.log("sup", data);
        //console.log(typeof data);
        let packet = await parseClientData(socket, data);
        switch (packet.ID) {
            case 0x00: { // login
                console.log("we got a player identification !");
                if (packet.Data.PVersion === 0x07) {
                    console.log("Valid Packet Version!");
                    console.log(`Username: ${packet.Data.username}`);
                    console.log(`Verification Key: ${packet.Data.verifyKey}`);
                    let resp = await returnServerID("AppleServer", "Aron's Javascript Server", false);
                    console.log("resp:");
                    console.log(await parseString(resp, 2));
                    socket.write(resp);
                    let player = {username: packet.Data.username, Position: spawnPos, socket: socket} as Player;
                    players.set(socket.data.PlayerID, player);
                    // now we send them da LEVELLLL
                    let worldGZ = Bun.gzipSync(await buildWorld(WorldSize, deltas));
                    sendWorld(WorldSize, worldGZ, socket);
                    spawnPlayer(socket, player, players)
                    broadcast(players, await returnChatMsg(packet.Data.username + ' has joined!', socket.data.PlayerID, players, true));

                } else {
                    console.log("Invalid Packet Version!!!");
                    socket.end();
                }
            } break;
            case 0x05: { // place/break block
                console.log(`${players.get(socket.data.PlayerID).username} placed ${packet.Data.block} at (${packet.Data.x},${packet.Data.y},${packet.Data.z})`);
                //let resp = [0x06, packet.Data.x, packet.Data.y, packet.Data.z, packet.Data.block];
                let resp = [0x06, data[1], data[2], data[3], data[4], data[5], data[6], packet.Data.block];
                broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']));
                deltas.push(packet.Data);
                //broadcast(players, await parseTypes(resp, ['hex', 'FShort', 'FShort', 'FShort', 'hex']));
            } break;
            case 0x08: { // movement
                //console.log(`${players.get(socket.data.PlayerID).username} moved to (${packet.Data.x},${packet.Data.y},${packet.Data.z})`)
                let x = (await parseShort(data, 2))/32;
                let y = (await parseShort(data, 4))/32;
                let z = (await parseShort(data, 6))/32;
                
                let resp = [0x08, socket.data.PlayerID, data[2], data[3], data[4], data[5], data[6], data[7], packet.Data.yaw, packet.Data.pitch];
                broadcast(players, await parseTypes(resp, ['hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex', 'hex']), [socket.data.PlayerID]);
            } break;
            case 0x0d: { // chat msg
                console.log(`player ${socket.data.PlayerID} says ${packet.Data.msg}`);
                broadcast(players, await returnChatMsg(packet.Data.msg, socket.data.PlayerID, players))
            } break;
            default: {
                let tmp = 0;
                console.log("Unmanaged Packet :(");

            }
        }
        //let bytes = [0x00, 0x07, 0x20, 0x68,0x69, 0x20,0x20, 0x68, 0x65, 0x6C, 0x6F,0x20,0x00];
        //let level_init = new Uint8Array([0x02]);
        //let level_fin_init = new Uint8Array([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        //let spawn_player = new Uint8Array([0x07, 0x0f]);
        //socket.write(new Uint8Array(bytes));
        //socket.write(level_init);
        //socket.write(level_fin_init);
        //socket.write(spawn_player);
    }, // message received from client
    async open(socket) {
        console.log("opened!");
        socket.data = { PlayerID: await getID(players)};
    }, // socket opened
    async close(socket) {
        console.log("We got closed :(");
        let ID = socket.data.PlayerID;
        players.delete(ID);
        // despawn player packet:
        let resp = [0x0c, ID];
        broadcast(players, await parseTypes(resp, ['hex', 'hex']));
    }, // socket closed
    drain(socket) {
        console.log("got drained");
    }, // socket ready for more data
    error(socket, error) {
        console.error("AAAA: ", error);
    }, // error handler
  },
});



