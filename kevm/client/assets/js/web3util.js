function UtilConstructor() {

    this.randomInt = function(max) {
        return Math.floor(Math.random() * Math.floor(max));
    };

    this.newRandomHex = function(len = 32) {
        return ncrypto.randomBytes(len).toString('hex');
    };

    this.newRandomPrivateKey = function() {
        return this.newRandomHex();
    };

    this.removeFirstIf = function(arr, callback) {
        let i = 0;
        while (i < arr.length) {
            let el = arr[i];
            if (callback(el, i)) {
                arr.splice(i, 1);
                return [el, i];
            }
            i++;
        }
        return [undefined, -1];
    };

    this.arrayIfNot = function(v, packNull = false) {
        return v === undefined || (v === null && !packNull) || Array.isArray(v) ? v : [v];
    };

    this.sha1 = function (data) {
        return ncrypto.Hash('sha1').update(data).digest('hex');
    };

    String.prototype.dropTail = function(len) {
        return this.substr(0,this.length-len)
    }
}

const Util = Object.freeze(new UtilConstructor());

function AbstractNetworkConstructor(network, name) {

    if (!network) {
        throw 'Network is required!';
    }

    this.network = network;
    this.name = name || network;
    this.web3 = new Web3(network);

    this.recoverAcc = function(pk) {
        let acc = this.web3.eth.accounts.privateKeyToAccount(pk);
        console.log('Recovered address: ' + acc.address);
        return this.web3.eth.accounts.wallet.add(acc);
    };

    this.removeAcc = function(address) {
        if (this.web3.eth.accounts.wallet.remove(address)) {
            console.log('Removed account from wallet: ' + address);
        }
    };
}

function Web3NetworkConstructor(network, name) {

    AbstractNetworkConstructor.call(this, network, name);

    this.fullContractAwait = 5000;

    this.web3.eth.getBlockNumber()
        .then(console.log);

    this.getTransactionReceiptMined = function getTransactionReceiptMined(txHash, interval) {
        const self = this.web3.eth;
        const transactionReceiptAsync = function(resolve, reject) {
            self.getTransactionReceipt(txHash, (error, receipt) => {
                if (error) {
                    reject(error);
                } else if (receipt == null) {
                    setTimeout(
                        () => transactionReceiptAsync(resolve, reject),
                        interval ? interval : 3000);
                } else {
                    resolve(receipt);
                }
            });
        };
        if (Array.isArray(txHash)) {
            return Promise.all(txHash.map(
                oneTxHash => self.getTransactionReceiptMined(oneTxHash, interval)));
        } else if (typeof txHash === "string") {
            return new Promise(transactionReceiptAsync);
        } else {
            throw new Error("Invalid Type: " + txHash);
        }
    };

    this.getBalance = function(address, cb) {
        // cb('' + Math.round(Math.random() * 100) / 100);
        this.web3.eth.getBalance(address)
            .then(r => cb(this.web3.utils.fromWei(r)));
    };

    this.faucetRequest = function(address, cb) {
        $.post('https://kevm-testnet.iohkdev.io:8099/faucet?address=' + address, cb);
    };

    this.prepareDeploy = function(address, contractResult, cb) {
        let contract = new this.web3.eth.Contract(JSON.parse(contractResult.interface));
        console.log('Contract > ', contract);
        let deploy = contract.deploy({data: '0x' + contractResult.bytecode});
        let self = this;
        deploy.estimateGas({from: address, value: 0}).then(function (gas) {
            cb({
                gasEstimate: gas,
                send: function (params, cb) {
                    let result = {tx: null, contract: null};
                    let status = {done: false};
                    function buildCallback(fullTx, fullContract) {
                        if (status.done) {
                            return;
                        }
                        if (fullTx) {
                            result.tx = fullTx;
                            if (!result.contract) {
                                setTimeout(function () {
                                    if (!status.done) {
                                        console.warn('Failed to wait for promised full-contract. Falling back to tx-address');
                                        contract.options.address = contract._address = fullTx.contractAddress;
                                        buildCallback(null, contract);
                                    }
                                }, self.fullContractAwait);
                                return;
                            }
                        } else if (fullContract) {
                            result.contract = fullContract;
                            if (!result.tx) { return; }
                        } else {
                            return;
                        }
                        status.done = true;
                        cb(null, result);
                    }
                    try {
                        deploy.send(params, function (error, txHash) {
                            if (error) {
                                cb({reason: 'Contract deploy returned an error', cause: error});
                            } else {
                                console.log('Contract deploy tx: ', txHash);
                                self.getTransactionReceiptMined(txHash)
                                    .then(function (tx) {
                                        buildCallback(tx);
                                    }, function (err) {
                                        cb({reason: 'Failed to wait for contract tx', cause: err});
                                    });
                            }
                        }).then(function (deployedContract) {
                            buildCallback(null, deployedContract);
                        }, function (err) {
                            // ignore this error for now
                        });
                    } catch (e) {
                        cb({reason: 'Failed to deploy contract', cause: e});
                    }
                }
            });
        }, (err) => cb(null, err));
    };
}

function MockNetworkConstructor() {

    AbstractNetworkConstructor.call(this, 'https://localhost', 'Mock');

    let block = 208796;
    let balances = {};

    this.getTransactionReceiptMined = function getTransactionReceiptMined(txHash, interval) {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                resolve({
                    blockHash: '0x' + Util.newRandomPrivateKey(),
                    blockNumber: block++,
                    returnData: '0x',
                    status: false,
                    transactionHash: txHash,
                    transactionIndex: 0
                });
            }, Util.randomInt(9000) + 1000);
        });
    };

    this.getBalance = function(address, cb) {
        cb('' + (balances[address] || 0));
    };

    this.faucetRequest = function(address, cb) {
        setTimeout(function () {
            balances[address] = (balances[address] || 0) + 0.01;
            cb('0x' + Util.newRandomHex());
        }, Util.randomInt(4000) + 1000);
    };

    this.prepareDeploy = function(address, contractResult, cb) {
        cb({
            gasEstimate: contractResult.bytecode.length * 200,
            send: function (params, cb) {
                console.log(params);
                // TODO
            }
        });
    };
}