const Web3Util = Object.freeze(new Web3UtilConstructor('https://kevm-testnet.iohkdev.io:8546'));

const FAUCET_INTERVAL_MILLIS = 30000;

const STATE = {
    init: function() {
        if (!this.accounts) {
            this.accounts.push({pk: '0x' + newRandomPrivateKey()});
        }
        $.each(this.accounts, (i, account) => {
            if (!account.pk) {
                console.error('Invalid account object with no PK found - ignoring.', account);
                return;
            }
            account.acc = Web3Util.recoverAcc(account.pk);
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
                id: ncrypto.randomBytes(16).toString('hex'),
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
    }
};

function val(el, v) {
    return v ? el.val(v) : el.val();
}

function text(el, v) {
    return v ? el.text(v) : el.text();
}

const VIEW = {
    init: function() {
        this.AccSelector.el_selector = $('#account-selector');
        this.AccSelector.el_balance = $('#balance');
        this.AccSelector.el_reload = $('#balance-reload');
        this.AddAccountModal.el_modal = $('#account-add-modal');
        this.AddAccountModal.el_pk_input = $('#account-add-pk');
        this.AddAccountModal.el_pk_input_err = $('#account-add-pk-err');
        this.AddAccountModal.el_submit_btn = $('#account-add-btn');
        this.RemoveAccountModal.el_modal = $('#account-remove-modal');
        this.RemoveAccountModal.el_address_input = $('#account-remove-address');
        this.RemoveAccountModal.el_init_btn = $('#account-remove-init-btn');
        this.RemoveAccountModal.el_submit_btn = $('#account-remove-btn');
        this.GetCoinsModal.el_modal = $('#account-coins-modal');
        this.GetCoinsModal.el_address_input = $('#account-coins-address');
        this.GetCoinsModal.el_submit_btn = $('#account-coins-btn');
        this.GetCoinsModal.el_queue_list = $('#account-coins-queue-list');
    },
    AccSelector: {
        el_selector: null,
        el_balance: null,
        el_reload: null,
        selectedAddress: function (a) {
            return val(this.el_selector, a);
        },
        addAddress: function (address) {
            this.el_selector.append(
                $('<option></option>')
                    .attr('key', address)
                    .text(address));
        },
        addAndSelectAddress: function (address) {
            this.addAddress(address);
            this.selectedAddress(address);
        },
        balance: function (b) {
            return text(this.el_balance, b ? b + ' ETH' : undefined);
        }
    },
    AddAccountModal: {
        el_modal: null,
        el_pk_input: null,
        el_pk_input_err: null,
        el_submit_btn: null,
        privateKey: function (pk) {
            return val(this.el_pk_input, pk);
        },
        markInputError: function(error) {
            if (error) {
                this.el_pk_input_err.text('This account is already added');
                this.el_pk_input.addClass('is-invalid');
                this.submitEnabled(false);
            } else {
                this.el_pk_input.removeClass('is-invalid');
                this.submitEnabled(true);
            }
        },
        hasInputError: function() {
            return this.el_pk_input.hasClass('is-invalid');
        },
        submitEnabled: function (v) {
            this.el_submit_btn.attr('disabled', !v);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        }
    },
    RemoveAccountModal: {
        el_init_btn: null,
        el_modal: null,
        el_address_input: null,
        el_submit_btn: null,
        address: function (a) {
            return val(this.el_address_input, a);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        }
    },
    GetCoinsModal: {
        el_modal: null,
        el_address_input: null,
        el_submit_btn: null,
        el_queue_list: null,
        address: function (a) {
            return val(this.el_address_input, a);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        },
        addQueueRequest: function (req) {
            if (!req) {return;}
            this.el_queue_list.append(
                $(`<li class="account-coins-queue-list-item list-group-item d-flex justify-content-between align-items-center" req="${req.id}"></li>`)
                    .append($(`<span>${req.address}</span>`))
                    .append($(`<span class="badge badge-info badge-pill account-coins-queue-list-item-time">${new Date(req.expectedRequestMillis).toLocaleTimeString()}</span>`)));
        },
        findRequestItem: function(req) {
            return this.el_queue_list.find(`li[req="${req.id}"]`);
        },
        markRequestBeginning: function(req) {
            if (!req) {return;}
            let item = this.findRequestItem(req);
            item.addClass('active');
            $('<img src="assets/Dual_Ring-3s-64px.gif" width="24px"/>')
                .insertBefore(item.find('.account-coins-queue-list-item-time'));
        },
        removeQueueRequest: function(req) {
            if (!req) {return;}
            this.findRequestItem(req).remove();
        },
    },
};

// const solc = {
//     currentVersion: 0,
//     versions: [],
//     compilers: {},
//     selectedVersion: function() {
//         if (!this.versions) {
//             throw "no solc versions available yet!";
//         }
//         if (this.currentVersion < 0) {
//             throw "no solc version is selected!"
//         }
//         if (this.currentVersion > this.versions.length) {
//             throw "illegal solc version is selected: " + this.currentVersion;
//         }
//         return this.versions[this.currentVersion];
//     },
//     compile: function(source, optimise=1) {
//         version = this.selectedVersion();
//         compiler = this.compilers[version[1]];
//         if (!compiler) {
//             throw "solc compiler not found for version: " + version;
//         }
//         return compiler.compile(source, optimise);
//     }
// };

function appendAccountToWorkspace(acc) {
    STATE.accounts.push({
        pk: acc.privateKey,
        acc: acc
    });
    STATE.selectedAccount = acc.address;
    VIEW.AccSelector.addAndSelectAddress(acc.address);
}

function addAccountRandomizeKey() {
    VIEW.AddAccountModal.privateKey(Web3Util.newRandomPrivateKey());
}

function accountRemoveSetAddress(address = STATE.selectedAccount) {
    VIEW.RemoveAccountModal.address(address);
}

function accountCoinsSetAddress(address = STATE.selectedAccount) {
    VIEW.GetCoinsModal.address(address);
}

function updateBalance(address = STATE.selectedAccount) {
    if (VIEW.AccSelector.selectedAddress() === address) {
        VIEW.AccSelector.balance('...');
    }
    Web3Util.getBalance(address, r => {
        if (VIEW.AccSelector.selectedAddress() === address) {
            VIEW.AccSelector.balance(r);
        }
    });
}

function queueFaucetRequest(address) {
    let request = STATE.faucet.pushRequest(address);
    if (STATE.faucet.queue.length === 1) {
        function requestWorker(req) {
            let timeout = req.expectedRequestMillis - new Date().getTime();
            setTimeout(function () {
                let currentMillis = new Date().getTime();
                if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                    return;
                }
                console.log('Requesting faucet for: ', req);
                STATE.faucet.lastRequestMillis = req.requestMillis = currentMillis;
                VIEW.GetCoinsModal.markRequestBeginning(req);
                // mock request
                setTimeout(function () {
                    if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                        return;
                    }
                    console.log('Finished faucet request for: ', req);
                    VIEW.GetCoinsModal.removeQueueRequest(req);
                    STATE.faucet.queue.splice(0,1);
                    if (STATE.faucet.queue.length > 0) {
                        requestWorker(STATE.faucet.queue[0]);
                    }
                }, 5000);
            }, timeout);
        }
        requestWorker(request);
    }
    VIEW.GetCoinsModal.addQueueRequest(request);
}

$(function() {

    STATE.init();
    VIEW.init();

    $.each(STATE.accounts, (i, account) => {
        VIEW.AccSelector.addAddress(account.acc.address)
    });

    if (STATE.selectedAccount) {
        VIEW.AccSelector.selectedAddress(STATE.selectedAccount);
    } else {
        STATE.selectedAccount = VIEW.AccSelector.selectedAddress();
        console.log('Init selected account: ', STATE.selectedAccount);
    }

    function onAccountSelectorChange() {
        let addr = VIEW.AccSelector.selectedAddress();
        STATE.selectedAccount = addr;
        updateBalance(addr);
    }

    updateBalance();
    VIEW.AccSelector.el_selector.change(onAccountSelectorChange);
    VIEW.AccSelector.el_reload.click(() => updateBalance());

    VIEW.AddAccountModal.el_pk_input.on('change paste keyup', function (e) {
        let val = VIEW.AddAccountModal.privateKey();
        if (val.length === 64 && Web3Util.web3.utils.isHex(val)) {
            VIEW.AddAccountModal.markInputError();
        } else {
            VIEW.AddAccountModal.markInputError('Invalid Ethereum private key');
            return;
        }
        if (STATE.accounts.find(a => a.acc.privateKey.endsWith(val))) {
            VIEW.AddAccountModal.markInputError('This account is already added');
        }
    });

    function updateRemoveAccountAvailability() {
        VIEW.RemoveAccountModal.el_init_btn.attr('disabled', STATE.accounts.length < 2);
    }

    VIEW.AddAccountModal.el_submit_btn.click(function (e) {
        if (VIEW.AddAccountModal.hasInputError()) {
            return;
        }
        let acc;
        try {
            acc = Web3Util.recoverAcc('0x' + VIEW.AddAccountModal.privateKey());
        } catch (e) {
            console.error('Failed to create account from a private key!', {pk: VIEW.AddAccountModal.privateKey(), err: e});
            VIEW.AddAccountModal.markInputError('Invalid key: failed to create an account');
            return;
        }
        appendAccountToWorkspace(acc);
        updateRemoveAccountAvailability();
        VIEW.AddAccountModal.closeModal();
    });

    updateRemoveAccountAvailability();
    VIEW.RemoveAccountModal.el_submit_btn.click(function (e) {
        let address = VIEW.RemoveAccountModal.address();
        if (confirm('Delete account ' + address + "?")) {
            console.log('Removing account: ' + address);
            $('#account-selector option[key=' + address + ']').remove();
            STATE.accounts = $.grep(STATE.accounts, (a) => a.acc.address !== address);
            onAccountSelectorChange();
            updateRemoveAccountAvailability();
        }
        VIEW.RemoveAccountModal.closeModal();
    });

    VIEW.GetCoinsModal.el_submit_btn.click(function (e) {
        queueFaucetRequest(VIEW.GetCoinsModal.address());
    })

    // $.post('https://kevm-testnet.iohkdev.io:8099/faucet?address=' + acc.address, function (data) {
    //     console.log('Waiting for tx: ' + data);
    //     web3.eth.getTransactionReceiptMined(data).then(function (tx) {
    //         console.log('Faucet tx: ', tx);
    //         getBalance(acc, r => console.log('Balance2: ' + r));
    //     });
    // });

    // BrowserSolc.getVersions((a,b) => {
    //     solc.versions = Object.freeze(Object.entries(b));
    //     let version = solc.selectedVersion();
    //     console.log('Solc version: ', version);
    //     BrowserSolc.loadVersion(version[1], c => {
    //         solc.compilers[version[1]] = c;
    //     });
    // });
});