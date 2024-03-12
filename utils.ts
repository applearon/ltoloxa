import { parseTypes } from './types.ts'
export async function returnChatMsg(string, playerID, players) {
    let pid = 0x0d;
    return parseTypes([pid, playerID, string], ['hex', 'hex', 'string']);
}

