# ltoloxa Server
Library for building Minecraft classic servers

Simplfies creating a Minecraft Classic server by parsing the raw packets, and formatting them into easier to handle data types. Powered by [Bun](https://bun.sh)

`examples/` contain MC Classic servers utilizing ltoloxa.

![Example of a minigame server](./assets/minigame.png)


## Usage
```js
import type { ClientPacket, SocketData } from 'types.ts';
import { Server } from 'index.ts';
import type { Socket } from 'bun';

async function handleLogin(packet: ClientPacket, socket: Socket<SocketData>) {
};

async function handleBlock(packet: ClientPacket, socket: Socket<SocketData>) {
}

async function handlePos(packet: ClientPacket, socket: Socket<SocketData>) {
}

async function handleChat(packet: ClientPacket, socket: Socket<SocketData>) {
}

async function handleDisconnect(socket: Socket<SocketData>) {
}
let server = new Server(handleLogin, handleBlock, handlePos, handleChat, handleDisconnect, 25565);
```


Thanks to [wiki.vg](https://wiki.vg/Classic_Protocol) for providing the minecraft classic protocol.
