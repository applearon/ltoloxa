#!/usr/bin/env bun
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, SocketData } from 'types.ts';
import { parseShort, parseString, parseTypes } from 'types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer } from 'loginHelpers.ts';
import { broadcast, parseClientData } from 'socketHelpers.ts';
const EventEmitter = require('node:events');
class Emitter extends EventEmitter {}
export const lto = new Emitter();
export class Server {
    static tickBased(port) {
        return new this(() => {}, () => {}, () => {}, () => {}, () => {}, port, true);
    }
    constructor(loginCallback, blockCallback, movementCallback, chatCallback, disconnectCallback, port: number, tickBased: boolean=false) {
        this.packetQueue = [];
        if (tickBased) {
        loginCallback = (packet,socket,data) => {
            this.packetQueue.push(["login" ,packet, socket]);
            };
        blockCallback = (packet,socket,data) => {
            this.packetQueue.push(["block" ,packet, socket]);
            };
        movementCallback = (packet,socket,data) => {
            this.packetQueue.push(["movement" ,packet, socket]);
            };
        chatCallback = (packet,socket,data) => {
            this.packetQueue.push(["chat" ,packet, socket]);
            };
        disconnectCallback = (packet,socket,data) => {
            this.packetQueue.push(["disconnect", socket]);
            };
        }
        Bun.listen<SocketData>({
          hostname: "0.0.0.0",
          port: port,
          socket: {
            async data(socket, data) {
                let packet = await parseClientData(socket, data) as ClientPacket;
                switch (packet.ID) {
                    case 0x00: { // login
                        let Pdata = packet.Data as CPlayerID;
                        if (Pdata.PVersion === 0x07) { // Assumes you want only classic v0.30
                            console.log(`${Pdata.username} attempting to join`);
                            await loginCallback(packet, socket, data);
                        } else {
                            console.log("Invalid Packet Version, closing connection");
                            socket.end();
                        }
                    } break;
                    case 0x05: { // place/break block
                        await blockCallback(packet, socket, data);
                    } break;
                    case 0x08: { // movement
                        await movementCallback(packet, socket, data);
                    } break;
                    case 0x0d: { // chat msg
                        await chatCallback(packet, socket, data);
                    } break;
                    default: {
                        console.log("Unmanaged Packet :(");
                    }
                }
            }, 
            async open(socket) {
                console.log("opened!");
                socket.data = {PlayerID: -1} as SocketData;
            },
            async close(socket) {
                console.log("We got closed :(");
                await disconnectCallback(socket);
            },
            drain(socket) {
                console.log("got drained");
            },
            error(socket, error) {
                console.error("AAAA: ", error);
            },
          },
        });
    }
    tickLoop(tickFunc, tickRate) {
        setTimeout(() => {
            tickFunc(this.packetQueue);
            this.packetQueue = [];
            this.tickLoop(tickFunc, tickRate);
        }, 1000/tickRate)
    }
}


