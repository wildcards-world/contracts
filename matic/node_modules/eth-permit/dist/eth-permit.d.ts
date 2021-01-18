import { RSV } from './rpc';
interface DaiPermitMessage {
    holder: string;
    spender: string;
    nonce: number;
    expiry: number | string;
    allowed?: boolean;
}
interface ERC2612PermitMessage {
    owner: string;
    spender: string;
    value: number | string;
    nonce: number | string;
    deadline: number | string;
}
interface Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
}
export declare const signDaiPermit: (provider: any, token: string | Domain, holder: string, spender: string, expiry?: number | undefined, nonce?: number | undefined) => Promise<DaiPermitMessage & RSV>;
export declare const signERC2612Permit: (provider: any, token: string | Domain, owner: string, spender: string, value?: string | number, deadline?: number | undefined, nonce?: number | undefined) => Promise<ERC2612PermitMessage & RSV>;
export {};
