import { parseTypes } from './types.ts'
export async function returnChatMsg(string, playerID) {
    let pid = 0x0d;
    return parseTypes([pid, playerID, string], ['hex', 'hex', 'string']);
}

export async function buildWorld(World, func) {
    let lx = World.x;
    let lz = World.z;
    let ly = World.y;
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
                if ((x-128)*(x-128) + (z-128)*(z-128) < 16384) {
                    if (y % 10 == 0) {
                    block = 30;
                    }
                } else {
                    block = 33; 
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

