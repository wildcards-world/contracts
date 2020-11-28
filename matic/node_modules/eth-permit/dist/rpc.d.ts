export declare const send: (provider: any, method: string, params?: any[] | undefined) => Promise<any>;
export interface RSV {
    r: string;
    s: string;
    v: number;
}
export declare const signData: (provider: any, fromAddress: string, typeData: any) => Promise<RSV>;
export declare const setChainIdOverride: (id: number) => void;
export declare const getChainId: (provider: any) => Promise<any>;
export declare const call: (provider: any, to: string, data: string) => Promise<any>;
