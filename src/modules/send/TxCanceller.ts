import * as sdk from "boa-sdk-ts";

import { logger, Logger } from "../common/Logger";
import { Config } from "../common/Config";
import { prepare, wait } from "../utils/Process";
import { WK } from "../utils/WK";

export class TxCanceller {
    private boa_client: sdk.BOAClient;
    private config: Config;
    private tx_hash: sdk.Hash;

    constructor(tx_hash: string) {
        this.config = Config.getInstance();
        this.boa_client = new sdk.BOAClient(
            this.config.server.stoa_endpoint.toString(),
            this.config.server.agora_endpoint.toString()
        );
        this.tx_hash = new sdk.Hash(tx_hash);
    }

    public makeCancelTx(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                let height: sdk.JSBI = sdk.JSBI.BigInt(0);

                try {
                    height = await this.boa_client.getBlockHeight();
                } catch (e) {
                    logger.error(e);
                    return resolve({
                        status: false,
                        error: e,
                    });
                }

                if (sdk.JSBI.greaterThan(height, sdk.JSBI.BigInt(0))) {
                    let original_tx: sdk.Transaction;
                    let cancel_tx: sdk.Transaction;
                    try {
                        original_tx = await this.boa_client.getPendingTransaction(this.tx_hash);
                        let utxos = await this.boa_client.getUTXOInfo(original_tx.inputs.map((m) => m.utxo));
                        let canceller = new sdk.TxCanceller(original_tx, utxos, WK._keys);
                        let res = canceller.build();
                        if (res.code !== sdk.TxCancelResultCode.Success || res.tx === undefined) {
                            return resolve({
                                status: false,
                                error: `취소 트랜잭션을 생성하는 데 실패하였습니다.(${res.code})`,
                            });
                        }
                        cancel_tx = res.tx;
                    } catch (e) {
                        return resolve({
                            status: false,
                            error: "보류중인 트랜잭션을 찾을 수 없습니다. 다시 트랜잭션을 전송해 주세요.",
                        });
                    }

                    let h = sdk.hashFull(cancel_tx).toString();
                    logger.info(`TX_HASH (send / ${height.toString()}) : ${h}`);
                    try {
                        await this.boa_client.sendTransaction(cancel_tx);
                    } catch (e) {
                        return resolve({
                            status: false,
                            error: e,
                        });
                    }

                    return resolve({
                        status: true,
                        cancel_tx: cancel_tx,
                        cancel_tx_hash: sdk.hashFull(cancel_tx).toString(),
                        cancel_tx_size: cancel_tx.getNumberOfBytes(),
                        original_tx: original_tx,
                        original_tx_hash: sdk.hashFull(original_tx).toString(),
                        original_tx_size: original_tx.getNumberOfBytes(),
                    });
                } else {
                    return resolve({
                        status: false,
                        error: "The block height is 0",
                    });
                }
            } catch (e) {
                return resolve({
                    status: false,
                    error: e,
                });
            }
        });
    }
    send(): Promise<any> {
        return new Promise<any>(async (resolve) => {
            await prepare();
            WK.make();
            let res = await this.makeCancelTx();
            resolve(res);
        });
    }
    /*
    public cancelTransaction(): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                let height: sdk.JSBI = sdk.JSBI.BigInt(0);

                try {
                    height = await this.boa_client.getBlockHeight();
                } catch (e) {
                    logger.error(e);
                    return resolve({
                        status: false,
                        error: e,
                    });
                }

                if (sdk.JSBI.greaterThan(height, sdk.JSBI.BigInt(0))) {
                    let res: sdk.IWalletResult;
                    try {
                        let wallet = new sdk.Wallet(WK._keys[0], {
                            agoraEndpoint: this.config.server.agora_endpoint.toString(),
                            stoaEndpoint: this.config.server.stoa_endpoint.toString(),
                            fee: sdk.WalletFeeOption.Medium,
                        });
                        res = await wallet.cancelWithHash(this.tx_hash, (addresses: sdk.PublicKey[]) => {
                            return WK._keys.filter(
                                (w) => addresses.find((m) => Buffer.compare(w.address.data, m.data) === 0) !== undefined
                            );
                        });
                        if (
                            res.code === sdk.WalletResultCode.Success &&
                            res.tx !== undefined &&
                            res.original_tx !== undefined
                        ) {
                            let h = sdk.hashFull(res.tx).toString();
                            logger.info(`TX_HASH (send / ${height.toString()}) : ${h}`);
                            return resolve({
                                status: true,
                                cancel_tx: res.tx,
                                cancel_tx_hash: sdk.hashFull(res.tx).toString(),
                                cancel_tx_size: res.tx.getNumberOfBytes(),
                                original_tx: res.original_tx,
                                original_tx_hash: sdk.hashFull(res.original_tx).toString(),
                                original_tx_size: res.original_tx.getNumberOfBytes(),
                            });
                        } else {
                            return resolve({
                                status: false,
                                error: res.message,
                            });
                        }
                    } catch (e) {
                        return resolve({
                            status: false,
                            error: "보류중인 트랜잭션을 찾을 수 없습니다. 다시 트랜잭션을 전송해 주세요.",
                        });
                    }
                } else {
                    return resolve({
                        status: false,
                        error: "The block height is 0",
                    });
                }
            } catch (e) {
                return resolve({
                    status: false,
                    error: e,
                });
            }
        });
    }

    send(): Promise<any> {
        return new Promise<any>(async (resolve) => {
            await prepare();
            WK.make();
            let res = await this.cancelTransaction();
            resolve(res);
        });
    }
    */
}
