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

    this.fromWei = function(wei, parse = false) {
        let res = this.web3.utils.fromWei('' + wei);
        return parse ? parseFloat(res) : res;
    }
}

function Web3NetworkConstructor(network, name) {

    AbstractNetworkConstructor.call(this, network, name);

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
            .then(r => cb(this.fromWei(r)));
    };

    this.faucetRequest = function(address, cb) {
        $.post('https://kevm-testnet.iohkdev.io:8099/faucet?address=' + address, cb);
    };

    this.prepareDeploy = function(address, contractResult, cb) {
        let contractInterface = JSON.parse(contractResult.interface);
        let contract = new this.web3.eth.Contract(contractInterface);
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
                                console.log('Creating contract from tx address!');
                                result.contract = new self.web3.eth.Contract(contractInterface, fullTx.contractAddress);
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

    function createTx({txHash, gas, contractAddress}) {
        txHash = txHash || Util.newRandomPrivateKey();
        gas = gas || 21000;
        return {
            blockHash: '0x' + Util.newRandomPrivateKey(),
            blockNumber: block++,
            gasUsed: gas,
            cumulativeGasUsed: gas,
            returnData: '0x',
            status: false,
            transactionHash: txHash,
            transactionIndex: 0,
            contractAddress: contractAddress
        }
    }

    this.getTransactionReceiptMined = function getTransactionReceiptMined(txHash, interval) {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                resolve(createTx({txHash: txHash}));
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
        let gasEstimate = contractResult.bytecode.length * 160;
        let self = this;
        cb({
            gasEstimate: gasEstimate,
            send: function ({from, gas, gasPrice}, cb) {
                setTimeout(function () {
                    let cost = self.fromWei(gasEstimate * gasPrice, true);
                    let balance = balances[from];
                    if (!balance || balance < cost) {
                        balances[from] = 0;
                        cb({reason: 'Run out of balance!'});
                        return;
                    } else {
                        balances[from] -= cost;
                    }
                    if (gas < gasEstimate) {
                        cb({reason: `Run out of gas! {required: ${gasEstimate}, provided: ${gas}}`});
                        return;
                    }
                    let contractAddress = '0x' + Util.newRandomHex(20);
                    let contractInterface = JSON.parse(contractResult.interface);
                    cb(null, {
                        tx: createTx({gas: gasEstimate, contractAddress: contractAddress}),
                        contract: new self.web3.eth.Contract(contractInterface, contractAddress)
                    })
                }, Util.randomInt(8000) + 1000)
            }
        });
    };
}