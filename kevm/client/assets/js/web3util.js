function Web3UtilConstructor(network) {

    this.currentNetwork = network;
    this.web3 = new Web3(network);

    this.web3.eth.getTransactionReceiptMined = function getTransactionReceiptMined(txHash, interval) {
        const self = this;
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

    this.newRandomPrivateKey = function() {
        return ncrypto.randomBytes(32).toString('hex');
    };

    this.getBalance = function(address, cb) {
        cb('' + Math.round(Math.random() * 100) / 100);
        // this.web3.eth.getBalance(address)
        //     .then(r => cb(this.web3.utils.fromWei(r)));
    };

    this.recoverAcc = function(pk) {
        let acc = this.web3.eth.accounts.privateKeyToAccount(pk);
        console.log('Recovered address: ' + acc.address);
        return this.web3.eth.accounts.wallet.add(acc);
    }
}