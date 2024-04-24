#!/usr/bin/env bun
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player } from './types.ts';
import { parseShort, parseString, parseTypes } from './types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer } from './loginHelpers.ts';
import { broadcast, parseClientData } from './socketHelpers.ts';

const EventEmitter = require('node:events');
class Emitter extends EventEmitter {}
export const lto = new Emitter();

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
                if (packet.Data.PVersion === 0x07) {
                    console.log(`${packet.Data.username} attempting to join`);
                    lto.emit('login', packet, socket, data);
                } else {
                    console.log("Invalid Packet Version, closing connection");
                    socket.end();
                }
            } break;
            case 0x05: { // place/break block
                lto.emit('block', packet, socket, data);
            } break;
            case 0x08: { // movement
                lto.emit('pos', packet, socket, data);
            } break;
            case 0x0d: { // chat msg
                lto.emit('chat', packet, socket, data);
            } break;
            default: {
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
        //socket.data = { PlayerID: await getID(players)};
    }, // socket opened
    async close(socket) {
        console.log("We got closed :(");
        lto.emit('disconnect', socket);
    }, // socket closed
    drain(socket) {
        console.log("got drained");
    }, // socket ready for more data
    error(socket, error) {
        console.error("AAAA: ", error);
    }, // error handler
  },
});


