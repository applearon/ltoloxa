#!/usr/bin/env bun
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, SocketData } from 'types.ts';
import { parseShort, parseString, parseTypes } from 'types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer } from 'loginHelpers.ts';
import { broadcast, parseClientData } from 'socketHelpers.ts';
const EventEmitter = require('node:events');
class Emitter extends EventEmitter {}
export const lto = new Emitter();

Bun.listen<SocketData>({
  hostname: "0.0.0.0",
  port: 25565,
  socket: {
    async data(socket, data) {
        //console.log("sup", data);
        //console.log(typeof data);
        let packet = await parseClientData(socket, data) as ClientPacket;
        switch (packet.ID) {
            case 0x00: { // login
                let Pdata = packet.Data as CPlayerID;
                if (Pdata.PVersion === 0x07) { // Assumes you want only classic v0.30
                    console.log(`${Pdata.username} attempting to join`);
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
    }, // message received from client
    async open(socket) {
        console.log("opened!");
        socket.data = {PlayerID: 0} as SocketData;
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


