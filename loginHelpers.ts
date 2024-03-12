import { ClientPacket, CPlayerID, CSetBlock, CMsg, PlayerPos, Player, parseShort, parseString, parseTypes } from './types.ts';
import { broadcast } from './socketHelpers.ts';

export async function getID(players) {
    let vals = [...Array(128).keys()];; // 0->127
    let id = 0;
    for (let [key, val] of players) {
        vals[key] = -1;
        console.log("hi", key);
    }
    for (let i = 0; i < vals.length; i++) {
        if (vals[i] != -1) {
            id = vals[i];
            break;
        }
    }
    //for (let i=0; i < players.length; i++) {
    //    if (players[i].PlayerID == id) {
    //        id++;
    //    }
    //}
    console.log("This player is id: ", id);
    return id;
}

export async function returnServerID(name, motd, isOp: bool) {
    let pid = 0x00;
    let PVersion = 0x07;
    let serverName = new TextEncoder().encode(name);
    let serverMotd = new TextEncoder().encode(motd);
    let UserType = (isOp) ? 0x64 : 0x00;
    return parseTypes([pid, PVersion, name, motd, UserType], ['hex', 'hex', 'string', 'string', 'hex']);
    //return new Uint8Array([pid, PVersion, serverName, serverMotd, UserType]);
    
}

export async function sendWorld(World, worldGZ, socket) {
    // TODO
    socket.write(new Uint8Array([0x02]));
    // Get them chunkkks
    //let array = await new Uint8Array(await level_data.arrayBuffer());
    let array = worldGZ;
    //console.log(array);
    let pos = 0;
    for (let i = 0; i < Math.ceil(array.length/1024)-1; i++) {
        //console.log(array[i*1024]);
        pos = i+1;
        let info = [0x03, 0x04, 0x00];
        let byteInfo = ['hex', 'hex', 'hex']; // technically a short
        for (let j = 0; j < 1024; j++) {
            info.push(array[i*1024 + j]);
            byteInfo.push('hex');
        }
        info.push(i); // this is the percent complete
        byteInfo.push('hex');
        //console.log("sending wave ", info.length);
        socket.write(await parseTypes(info, byteInfo));
    }
    // now we send the final one
    let leftover = (array.length - pos*1024).toString(16).padStart(4, '0');
    console.log('leftovers: ', parseInt(leftover.substring(2,4), 16));
    console.log(array.length - pos*1024);
    let info = [0x03, parseInt(leftover.substring(0,2), 16), parseInt(leftover.substring(2,4), 16) ];
    let byteInfo = ['hex', 'hex', 'hex'];
    for (let i = 0; i < 1024; i++) {
        // array.length - pos*1024
        if (i < array.length - pos*1024) {
            info.push(array[pos*1024+i]);
        } else {
            info.push(0x00);
        }
        byteInfo.push('hex');
    }
    info.push(0xff);
    byteInfo.push('hex');
    
    socket.write(await parseTypes(info, byteInfo));
    
    //socket.write(new Uint8Array([0x04, 0x01, 0x00, 0x00, 0x64, 0x01, 0x00]));
    
    socket.write(await parseTypes([0x04, World.x, World.y, World.z], ['hex', 'short', 'short', 'short']));
}

export async function spawnPlayer(socket, player, players) {
    let resp = [0x07, socket.data.PlayerID, player.username, player.Position.x, player.Position.y, player.Position.Z, player.Position.yaw, player.Position.pitch];
    let respTypes = ['hex', 'hex', 'string', 'FShort', 'FShort', 'FShort', 'hex', 'hex'];
    broadcast(players, await parseTypes(resp, respTypes), [socket.data.PlayerID]);
    resp[1] = 0xFF;
    socket.write(await parseTypes(resp, respTypes));
    socket.write(await parseTypes([0x08, 0xFF, player.Position.x, player.Position.y, player.Position.z, player.Position.yaw, player.Position.pitch ], ['hex', 'hex', 'FShort', 'FShort', 'FShort', 'hex', 'hex'])); 
    // we inform client of players currently online
    for (let [key, value] of players) {
    if (key == socket.data.PlayerID) {
        continue;
    }
        let resp = [0x07, key, value.username, value.Position.x, value.Position.y, value.Position.z, value.Position.yaw, value.Position.pitch];
        socket.write(await parseTypes(resp, respTypes));
    }

}
