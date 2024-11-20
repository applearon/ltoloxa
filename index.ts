#!/usr/bin/env bun
import type { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, SocketData, OutBoundPacket } from 'types.ts';
import { parseShort, parseString, parseTypes } from 'types.ts';
import { getID, returnServerID, sendWorld,spawnPlayer } from 'loginHelpers.ts';
import { simple_broadcast, broadcast, parseClientData } from 'socketHelpers.ts';
import type { Socket } from 'bun';

const EventEmitter = require('node:events');
class Emitter extends EventEmitter {}
export const lto = new Emitter();
export class Server {
    static tickBased(port: number) {
        return new this(() => {}, () => {}, () => {}, () => {}, () => {}, port, true);
    }
    public tick = 0;
    public packetQueue: Array<Array<string | ClientPacket | Socket<SocketData>>> = [];
    private outboundQueue: Map<number, OutBoundPacket[]> = new Map();
    constructor(loginCallback: (packet: ClientPacket, socket: Socket<SocketData>) => void, blockCallback: (packet: ClientPacket, socket: Socket<SocketData>) => void, movementCallback: (packet: ClientPacket, socket: Socket<SocketData>) => void, chatCallback: (packet: ClientPacket, socket: Socket<SocketData>) => void, disconnectCallback: (socket: Socket<SocketData>) => void, port: number, tickBased: boolean=false) {
        if (tickBased) {
        loginCallback = (packet,socket) => {
            this.packetQueue.push(["login" ,packet, socket]);
            };
        blockCallback = (packet,socket) => {
            this.packetQueue.push(["block" ,packet, socket]);
            };
        movementCallback = (packet,socket) => {
            this.packetQueue.push(["movement" ,packet, socket]);
            };
        chatCallback = (packet,socket) => {
            this.packetQueue.push(["chat" ,packet, socket]);
            };
        disconnectCallback = (socket) => {
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
                            await loginCallback(packet, socket);
                        } else {
                            console.log("Invalid Packet Version, closing connection");
                            socket.end();
                        }
                    } break;
                    case 0x05: { // place/break block
                        await blockCallback(packet, socket);
                    } break;
                    case 0x08: { // movement
                        await movementCallback(packet, socket);
                    } break;
                    case 0x0d: { // chat msg
                        await chatCallback(packet, socket);
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
    tickLoop(tickFunc: (any:any) => void, tickRate: number) {
        setTimeout(() => {
            this.tick++;
            tickFunc(this.packetQueue);
            let packets = this.outboundQueue.get(this.tick);
            if (packets !== undefined) {
                for (let packet of packets) {
                    //packet.players[0].write(packet.packet);
                    simple_broadcast(packet.players, packet.packet);
                }
                this.outboundQueue.delete(this.tick);
            }
            this.packetQueue = [];
            this.tickLoop(tickFunc, tickRate);
        }, 1000/tickRate)
    }
    queueBroadcast(ticks:number, players: Map<number, Player>, packet: Uint8Array) {
        this.queuePacket(ticks, Array.from(players.values()), packet);
    }
    queuePacket(ticks:number, players: Player[], packet: Uint8Array) {
        let resp = {players:players.map((a: Player) => a.socket), packet:packet} as OutBoundPacket;
        let time = this.outboundQueue.get(this.tick+ticks);
        if (time !== undefined) {
            time.push(resp);
        } else {
            this.outboundQueue.set(this.tick+ticks,[resp]);
        }
    }
}


