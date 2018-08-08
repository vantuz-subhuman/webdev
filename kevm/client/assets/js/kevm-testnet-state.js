const FAUCET_INTERVAL_MILLIS = 30000;

const STATE = {
    init: function() {
        if (!this.accounts) {
            this.accounts.push({pk: '0x' + Util.newRandomPrivateKey()});
        }
        $.each(this.accounts, (i, account) => {
            if (!account.pk) {
                console.error('Invalid account object with no PK found - ignoring.', account);
                return;
            }
            account.acc = Network.recoverAcc(account.pk);
        });
    },
    accounts: [{
        pk: '0xf4946488e7be562f9140ef497acf806860ab66458f41933e554ec7fc08f5dff8',
        acc: null
    }, {
        pk: '0xfccf05690b35be1dcff1c64e901667f99d1c904d7579faa97764c3e69cdb856b',
        acc: null
    }],
    selectedAccount: '0xC97bd1B1cfCC80F0BFEb451e3be964Bdde0B1508',
    faucet: {
        lastRequestMillis: 0,
        queue: [],
        pushRequest: function(address) {
            let request = {
                id: Util.newRandomHex(16),
                address: address
            };
            let queue = this.queue;
            if (queue.length > 0) {
                let last = queue[queue.length - 1];
                request.expectedRequestMillis = last.expectedRequestMillis + FAUCET_INTERVAL_MILLIS;
            } else {
                let currentMillis = new Date().getTime();
                request.expectedRequestMillis = Math.max(this.lastRequestMillis + FAUCET_INTERVAL_MILLIS, currentMillis);
            }
            queue.push(request);
            return request;
        }
    },
    editor: {
        autoCompile: false
    }
};